import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'
import {
  notifyAdvertiserApproved,
  notifyAdvertiserRejected,
} from '@/lib/ads/adNotifications'
import { sendMail } from '@/lib/email/resend'
import { adCampaignApprovedEmail, adCampaignRejectedEmail } from '@/lib/email/templates'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('ad_campaigns')
    .select(`
      *,
      advertiser:advertiser_id (*),
      plan:plan_id (*),
      payments:ad_payments (id, amount, status, paid_at, provider, phone_number)
    `)
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Kampeni haikupatikana' }, { status: 404 })
  return NextResponse.json({ campaign: data })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await req.json()
  const { action, reason, status, admin_note } = body

  const admin = createAdminClient()

  // Load campaign for notification data and payment status
  const { data: campaign } = await admin
    .from('ad_campaigns')
    .select('id, ad_type, payment_status, title, plan:plan_id (duration_days), advertiser:advertiser_id (id, business_name, whatsapp_number, user_id, email)')
    .eq('id', id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Kampeni haikupatikana' }, { status: 404 })

  let updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (action === 'approve') {
    // If advertiser already paid, activate immediately — don't leave them in 'approved' limbo
    const alreadyPaid = campaign.payment_status === 'completed'
    const durationDays = (campaign.plan as unknown as { duration_days?: number } | null)?.duration_days ?? 30
    updates = alreadyPaid
      ? {
          ...updates,
          status: 'active',
          admin_note: reason || null,
          starts_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString(),
        }
      : { ...updates, status: 'approved', admin_note: reason || null }
  } else if (action === 'reject') {
    updates = { ...updates, status: 'rejected', admin_note: reason || null }
  } else if (action === 'suspend') {
    updates = { ...updates, status: 'suspended', admin_note: reason || null }
  } else if (action === 'activate') {
    updates = { ...updates, status: 'active' }
  } else if (status) {
    updates = { ...updates, status }
  }

  if (admin_note !== undefined) updates.admin_note = admin_note

  const { data, error } = await admin
    .from('ad_campaigns')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const adv = campaign.advertiser as unknown as {
    id: string; business_name: string; whatsapp_number: string | null; user_id: string | null; email: string | null
  }

  // WhatsApp notifications (non-blocking)
  if (adv?.whatsapp_number) {
    if (action === 'approve') {
      notifyAdvertiserApproved(adv.whatsapp_number, adv.business_name, campaign.ad_type).catch(() => {})
    } else if (action === 'reject') {
      notifyAdvertiserRejected(adv.whatsapp_number, adv.business_name, reason ?? 'Haifikii vigezo vyetu').catch(() => {})
    }
  }

  // In-app notification (non-blocking)
  if (adv?.user_id && (action === 'approve' || action === 'reject' || action === 'suspend')) {
    const notifMap: Record<string, { title: string; body: string; type: string }> = {
      approve: {
        title: '✅ Tangazo Lako Limeidhibitiwa!',
        body:  'Tangazo lako limeidhibitiwa. Lipa ili lianze kuonekana kwa wateja.',
        type:  'ad_campaign_approved',
      },
      reject: {
        title: '❌ Tangazo Lilikataliwa',
        body:  reason ? `Tangazo lako lilikataliwa. Sababu: ${reason}` : 'Tangazo lako halijakidhi vigezo vyetu.',
        type:  'ad_campaign_rejected',
      },
      suspend: {
        title: '⚠️ Tangazo Limesimamishwa',
        body:  reason ? `Tangazo lako limesimamishwa. Sababu: ${reason}` : 'Tangazo lako limesimamishwa kwa muda.',
        type:  'ad_campaign_suspended',
      },
    }
    const notif = notifMap[action]
    if (notif) {
      admin.from('notifications').insert({
        user_id: adv.user_id,
        title:   notif.title,
        body:    notif.body,
        type:    notif.type,
        is_read: false,
      }).then(() => {}, () => {})
    }
  }

  // Email notification (non-blocking)
  if (adv?.email && (action === 'approve' || action === 'reject')) {
    const tpl = action === 'approve'
      ? adCampaignApprovedEmail(adv.business_name, campaign.ad_type)
      : adCampaignRejectedEmail(adv.business_name, reason)
    sendMail({ to: adv.email!, ...tpl }).catch(() => {})
  }

  return NextResponse.json({ campaign: data })
}
