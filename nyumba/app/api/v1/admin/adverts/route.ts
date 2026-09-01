import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'
import {
  notifyAdvertiserApproved,
  notifyAdvertiserRejected,
  notifyAdvertiserPaymentSuccess,
  notifyAdvertiserQueued,
} from '@/lib/ads/adNotifications'
import { activateOrQueueCampaign } from '@/lib/ads/slotManager'
import { sendMail } from '@/lib/email/resend'
import { adCampaignApprovedEmail, adCampaignRejectedEmail } from '@/lib/email/templates'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? 'pending_review'
    const page   = parseInt(searchParams.get('page') ?? '1', 10)
    const limit  = parseInt(searchParams.get('limit') ?? '20', 10)
    const from   = (page - 1) * limit
    const to     = from + limit - 1

    const admin = createAdminClient()

    const { data, error, count } = await admin
      .from('ad_campaigns')
      .select(`
        *,
        advertiser:advertiser_id (id, business_name, contact_phone, whatsapp_number, email, city, status),
        plan:plan_id (name, ad_type, price_tzs, duration_days, geo_scope)
      `, { count: 'exact' })
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ campaigns: data ?? [], total: count ?? 0, page, limit })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET app/api/v1/admin/adverts]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// Bulk action: approve / reject multiple campaigns
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const body = await req.json()
    const { ids, action, reason } = body as { ids: string[]; action: 'approve' | 'reject'; reason?: string }

    if (!ids?.length || !action) {
      return NextResponse.json({ error: 'ids na action zinahitajika' }, { status: 400 })
    }
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action lazima iwe approve au reject' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: campaigns } = await admin
      .from('ad_campaigns')
      .select('id, ad_type, target_region, target_district, target_wards, payment_status, plan:plan_id (duration_days, slot_limit), advertiser:advertiser_id (id, business_name, whatsapp_number, user_id, email)')
      .in('id', ids)

    // Tracks, per campaign id, whether an alreadyPaid approve activated it
    // or had to queue it (slot full) — read by the notifications loop below.
    const queuedIds = new Set<string>()

    if (action === 'reject') {
      const { error } = await admin.from('ad_campaigns').update({
        status: 'rejected', admin_note: reason || null, updated_at: new Date().toISOString(),
      }).in('id', ids)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      // Approve per-campaign, sequentially — deliberate: activateOrQueueCampaign
      // re-checks real slot availability on every call, so bulk-approving
      // several campaigns for the same (ad_type, region) correctly activates
      // only as many as actually fit and queues the rest, rather than
      // overselling a tight slot_limit (found in the 2026-09-01 ads-system
      // audit; see slotManager.ts).
      const now = new Date()
      for (const c of campaigns ?? []) {
        const alreadyPaid = c.payment_status === 'completed'
        if (alreadyPaid) {
          const plan = c.plan as unknown as { duration_days?: number; slot_limit?: number } | null
          await admin.from('ad_campaigns').update({
            admin_note: reason || null, updated_at: now.toISOString(),
          }).eq('id', c.id)
          const result = await activateOrQueueCampaign(
            admin,
            {
              id: c.id, ad_type: c.ad_type, target_region: c.target_region,
              target_district: c.target_district, target_wards: c.target_wards,
            },
            plan?.slot_limit ?? 1,
            plan?.duration_days ?? 30,
          )
          if (!result.activated) queuedIds.add(c.id)
        } else {
          await admin.from('ad_campaigns').update({
            status: 'approved', admin_note: reason || null, updated_at: now.toISOString(),
          }).eq('id', c.id)
        }
      }
    }

    // Notifications (non-blocking) — WhatsApp + in-app + email per campaign
    for (const c of campaigns ?? []) {
      const adv = c.advertiser as unknown as {
        business_name: string; whatsapp_number: string | null; user_id: string | null; email: string | null
      }
      const alreadyPaid = action === 'approve' && c.payment_status === 'completed'
      const queued      = queuedIds.has(c.id)

      // WhatsApp
      if (adv?.whatsapp_number) {
        if (alreadyPaid) {
          if (queued) {
            notifyAdvertiserQueued(adv.whatsapp_number, adv.business_name, c.ad_type, c.target_region).catch(() => {})
          } else {
            const durationDays = (c.plan as unknown as { duration_days?: number } | null)?.duration_days ?? 30
            const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
            notifyAdvertiserPaymentSuccess(adv.whatsapp_number, adv.business_name, c.ad_type, expiresAt).catch(() => {})
          }
        } else if (action === 'approve') {
          notifyAdvertiserApproved(adv.whatsapp_number, adv.business_name, c.ad_type).catch(() => {})
        } else {
          notifyAdvertiserRejected(adv.whatsapp_number, adv.business_name, reason ?? 'Haifikii vigezo vyetu').catch(() => {})
        }
      }

      // In-app
      if (adv?.user_id) {
        const notif = alreadyPaid
          ? (queued
              ? { title: '⏳ Malipo Yamepokelewa — Foleni', body: `Kampeni yako imelipwa lakini nafasi zimejaa. Itaanza kiotomatiki mara nafasi itakapopatikana.`, type: 'ad_campaign_queued' }
              : { title: '💳 Malipo Yamekamilika!', body: 'Kampeni yako inaonekana sasa kwa wateja.', type: 'ad_payment_success' })
          : action === 'approve'
            ? { title: '✅ Tangazo Lako Limeidhibitiwa!', body: 'Tangazo lako limeidhibitiwa. Lipa ili lianze kuonekana kwa wateja.', type: 'ad_campaign_approved' }
            : { title: '❌ Tangazo Lilikataliwa', body: reason ? `Tangazo lako lilikataliwa. Sababu: ${reason}` : 'Tangazo lako halijakidhi vigezo vyetu.', type: 'ad_campaign_rejected' }

        admin.from('notifications').insert({
          user_id: adv.user_id,
          title:   notif.title,
          body:    notif.body,
          type:    notif.type,
          is_read: false,
        }).then(() => {}, () => {})
      }

      // Email — skipped for the alreadyPaid case (adCampaignApprovedEmail's
      // copy says "pay to activate", false once already paid; WhatsApp +
      // in-app above already cover it correctly).
      if (adv?.email && ((action === 'approve' && !alreadyPaid) || action === 'reject')) {
        const tpl = action === 'approve'
          ? adCampaignApprovedEmail(adv.business_name, c.ad_type)
          : adCampaignRejectedEmail(adv.business_name, reason)
        sendMail({ to: adv.email!, ...tpl }).catch(() => {})
      }
    }

    return NextResponse.json({ ok: true, updated: ids.length })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[PATCH app/api/v1/admin/adverts]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
