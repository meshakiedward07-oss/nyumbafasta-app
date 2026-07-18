import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth, requireAdminUser } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'
import { auditLog } from '@/lib/security/auditLog'

// GET — all advertisers with campaign stats
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'all'
  const page   = parseInt(searchParams.get('page') ?? '1', 10)
  const limit  = parseInt(searchParams.get('limit') ?? '30', 10)
  const from   = (page - 1) * limit
  const to     = from + limit - 1

  const admin = createAdminClient()

  let query = admin
    .from('advertisers')
    .select(`
      id, business_name, business_category, contact_phone, whatsapp_number,
      email, city, district, description, logo_url, website_url,
      status, rejection_reason, created_at, updated_at,
      reviewed_at
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status !== 'all') query = query.eq('status', status)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch campaign counts per advertiser in one query
  const ids = (data ?? []).map(a => a.id)
  const campaignCounts: Record<string, number> = {}
  if (ids.length > 0) {
    const { data: counts } = await admin
      .from('ad_campaigns')
      .select('advertiser_id')
      .in('advertiser_id', ids)

    for (const row of counts ?? []) {
      campaignCounts[row.advertiser_id] = (campaignCounts[row.advertiser_id] ?? 0) + 1
    }
  }

  const advertisers = (data ?? []).map(a => ({
    ...a,
    campaign_count: campaignCounts[a.id] ?? 0,
  }))

  return NextResponse.json({ advertisers, total: count ?? 0, page, limit })
}

// PATCH — approve, reject, suspend, or activate an advertiser
export async function PATCH(req: NextRequest) {
  const adminUser = await requireAdminUser()
  if (!adminUser) {
    return NextResponse.json({ error: 'Ruhusa ya admin inahitajika' }, { status: 403 })
  }

  const body = await req.json()
  const { id, action, reason } = body as { id: string; action: string; reason?: string }

  if (!id || !action) {
    return NextResponse.json({ error: 'id na action zinahitajika' }, { status: 400 })
  }
  if (!['approve', 'reject', 'suspend', 'activate'].includes(action)) {
    return NextResponse.json({ error: 'action haijulikani' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch advertiser first for notification data
  const { data: advertiser, error: fetchErr } = await admin
    .from('advertisers')
    .select('id, business_name, whatsapp_number, email, user_id, status')
    .eq('id', id)
    .single()

  if (fetchErr || !advertiser) {
    return NextResponse.json({ error: 'Mfanyabiashara hakupatikana' }, { status: 404 })
  }

  const statusMap: Record<string, string> = {
    approve:  'active',
    reject:   'rejected',
    suspend:  'suspended',
    activate: 'active',
  }

  const updates: Record<string, unknown> = {
    status:      statusMap[action],
    updated_at:  new Date().toISOString(),
    reviewed_at: new Date().toISOString(),
  }
  if (action === 'reject') updates.rejection_reason = reason ?? null
  if (action === 'activate') updates.rejection_reason = null

  const { data, error } = await admin
    .from('advertisers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Non-blocking side effects ────────────────────────────────────────────

  const auditActionMap: Record<string, import('@/lib/security/auditLog').AuditAction> = {
    approve:  'advertiser_approved',
    reject:   'advertiser_rejected',
    suspend:  'advertiser_suspended',
    activate: 'advertiser_activated',
  }

  auditLog({
    action:      auditActionMap[action],
    user_id:     adminUser.id,
    target_id:   id,
    target_type: 'advertiser',
    metadata:    { business_name: advertiser.business_name, reason, previous_status: advertiser.status },
    severity:    action === 'suspend' ? 'warning' : 'info',
  }).catch(() => {})

  // In-app notification to advertiser
  if (advertiser.user_id) {
    const notifMap: Record<string, { title: string; body: string; type: string }> = {
      approve:  {
        title: '✅ Akaunti Imeidhinishwa!',
        body:  'Akaunti yako ya NyumbaFasta Ads imeidhinishwa. Unda tangazo lako la kwanza sasa!',
        type:  'advertiser_approved',
      },
      activate: {
        title: '✅ Akaunti Imeanzishwa Tena',
        body:  'Akaunti yako ya NyumbaFasta Ads imeanzishwa tena. Unaweza kuendelea kuunda matangazo.',
        type:  'advertiser_activated',
      },
      reject: {
        title: '❌ Maombi Yameshughulikiwa',
        body:  reason
          ? `Akaunti yako haikuidhinishwa. Sababu: ${reason}`
          : 'Akaunti yako haikuidhinishwa. Wasiliana nasi kwa maelezo zaidi.',
        type:  'advertiser_rejected',
      },
      suspend: {
        title: '⚠️ Akaunti Imesimamishwa',
        body:  reason
          ? `Akaunti yako imesimamishwa. Sababu: ${reason}`
          : 'Akaunti yako imesimamishwa kwa muda. Wasiliana nasi.',
        type:  'advertiser_suspended',
      },
    }
    const notif = notifMap[action]
    if (notif) {
      admin.from('notifications').insert({
        user_id: advertiser.user_id,
        title:   notif.title,
        body:    notif.body,
        type:    notif.type,
        is_read: false,
      }).then(() => {}, () => {})
    }
  }

  // WhatsApp notification
  if (advertiser.whatsapp_number) {
    ;(async () => {
      const wa = advertiser.whatsapp_number!
      const { notifyAccountApproved, notifyAccountRejected, notifyAccountSuspended } =
        await import('@/lib/ads/adNotifications')
      if (action === 'approve' || action === 'activate') {
        await notifyAccountApproved(wa, advertiser.business_name)
      } else if (action === 'reject') {
        await notifyAccountRejected(wa, advertiser.business_name, reason)
      } else if (action === 'suspend') {
        await notifyAccountSuspended(wa, advertiser.business_name, reason)
      }
    })().catch(() => {})
  }

  // Email notification
  if (advertiser.email && process.env.RESEND_API_KEY) {
    ;(async () => {
      const { emailBase, advertiserApprovedEmail, advertiserRejectedEmail } =
        await import('@/lib/email/templates')
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)

      if (action === 'approve' || action === 'activate') {
        const { subject, html } = advertiserApprovedEmail(advertiser.business_name)
        await resend.emails.send({
          from: 'NyumbaFasta <noreply@nyumbafasta.co>',
          to:   advertiser.email,
          subject, html,
        })
      } else if (action === 'reject') {
        const { subject, html } = advertiserRejectedEmail(advertiser.business_name, reason)
        await resend.emails.send({
          from: 'NyumbaFasta <noreply@nyumbafasta.co>',
          to:   advertiser.email,
          subject, html,
        })
      } else if (action === 'suspend') {
        await resend.emails.send({
          from:    'NyumbaFasta <noreply@nyumbafasta.co>',
          to:      advertiser.email,
          subject: '⚠️ Akaunti Yako Imesimamishwa — NyumbaFasta Ads',
          html:    emailBase(
            `<span style="font-size:22px;font-weight:700;color:#111827;margin:0 0 12px;display:block">Habari ${advertiser.business_name},</span>
             <span style="font-size:15px;color:#4b5563;line-height:1.7;margin:0 0 16px;display:block">Akaunti yako ya NyumbaFasta Ads imesimamishwa kwa muda.${reason ? `<br><strong>Sababu:</strong> ${reason}` : ''}</span>
             <span style="font-size:15px;color:#4b5563;line-height:1.7;margin:0;display:block">Wasiliana nasi: <a href="https://wa.me/255665831694" style="color:#1D9E75">WhatsApp</a></span>`,
            'Akaunti imesimamishwa'
          ),
        })
      }
    })().catch(() => {})
  }

  return NextResponse.json({ ok: true, advertiser: data })
}
