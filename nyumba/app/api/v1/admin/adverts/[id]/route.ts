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

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
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

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET app/api/v1/admin/adverts/[id]]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const { id } = await params
    const body = await req.json()
    const { action, reason, status, admin_note } = body

    const admin = createAdminClient()

    // Load campaign for notification data and payment status
    const { data: campaign } = await admin
      .from('ad_campaigns')
      .select('id, ad_type, target_region, target_district, target_wards, payment_status, title, plan:plan_id (duration_days, slot_limit), advertiser:advertiser_id (id, business_name, whatsapp_number, user_id, email)')
      .eq('id', id)
      .single()

    if (!campaign) return NextResponse.json({ error: 'Kampeni haikupatikana' }, { status: 404 })

    const adv = campaign.advertiser as unknown as {
      id: string; business_name: string; whatsapp_number: string | null; user_id: string | null; email: string | null
    }

    // Approve-and-already-paid is handled separately from the generic
    // update below: it must go through activateOrQueueCampaign so a full
    // slot queues the campaign (status='queued') instead of overselling it
    // — found in the 2026-09-01 ads-system audit. See slotManager.ts.
    const alreadyPaid = action === 'approve' && campaign.payment_status === 'completed'
    let queuedInstead = false

    if (alreadyPaid) {
      const plan = campaign.plan as unknown as { duration_days?: number; slot_limit?: number } | null
      await admin.from('ad_campaigns').update({
        admin_note: reason || null,
        updated_at: new Date().toISOString(),
      }).eq('id', id)

      const result = await activateOrQueueCampaign(
        admin,
        {
          id: campaign.id, ad_type: campaign.ad_type, target_region: campaign.target_region,
          target_district: campaign.target_district, target_wards: campaign.target_wards,
        },
        plan?.slot_limit ?? 1,
        plan?.duration_days ?? 30,
      )
      queuedInstead = !result.activated
    }

    let updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (action === 'approve' && !alreadyPaid) {
      updates = { ...updates, status: 'approved', admin_note: reason || null }
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

    // alreadyPaid already applied its own update above via
    // activateOrQueueCampaign — only run the generic update for every other
    // action/branch.
    let data: unknown = null
    if (!alreadyPaid) {
      const { data: updated, error } = await admin
        .from('ad_campaigns')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      data = updated
    } else {
      const { data: fresh } = await admin.from('ad_campaigns').select('*').eq('id', id).single()
      data = fresh
    }

    // WhatsApp notifications (non-blocking)
    if (adv?.whatsapp_number) {
      if (alreadyPaid) {
        const durationDays = (campaign.plan as unknown as { duration_days?: number } | null)?.duration_days ?? 30
        if (queuedInstead) {
          notifyAdvertiserQueued(adv.whatsapp_number, adv.business_name, campaign.ad_type, campaign.target_region).catch(() => {})
        } else {
          const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
          notifyAdvertiserPaymentSuccess(adv.whatsapp_number, adv.business_name, campaign.ad_type, expiresAt).catch(() => {})
        }
      } else if (action === 'approve') {
        notifyAdvertiserApproved(adv.whatsapp_number, adv.business_name, campaign.ad_type).catch(() => {})
      } else if (action === 'reject') {
        notifyAdvertiserRejected(adv.whatsapp_number, adv.business_name, reason ?? 'Haifikii vigezo vyetu').catch(() => {})
      }
    }

    // In-app notification (non-blocking)
    if (adv?.user_id && (action === 'approve' || action === 'reject' || action === 'suspend')) {
      const notifMap: Record<string, { title: string; body: string; type: string }> = {
        approve: alreadyPaid
          ? (queuedInstead
              ? { title: '⏳ Malipo Yamepokelewa — Foleni', body: `Kampeni yako "${campaign.title}" imelipwa lakini nafasi zimejaa. Itaanza kiotomatiki mara nafasi itakapopatikana.`, type: 'ad_campaign_queued' }
              : { title: '💳 Malipo Yamekamilika!', body: `Kampeni yako "${campaign.title}" inaonekana sasa kwa wateja.`, type: 'ad_payment_success' })
          : {
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

    // Email notification (non-blocking). Skipped for the alreadyPaid
    // approve case — adCampaignApprovedEmail's copy says "pay to activate",
    // which is false once payment is already done (WhatsApp + in-app above
    // already cover that case correctly).
    if (adv?.email && ((action === 'approve' && !alreadyPaid) || action === 'reject')) {
      const tpl = action === 'approve'
        ? adCampaignApprovedEmail(adv.business_name, campaign.ad_type)
        : adCampaignRejectedEmail(adv.business_name, reason)
      sendMail({ to: adv.email!, ...tpl }).catch(() => {})
    }

    return NextResponse.json({ campaign: data })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[PATCH app/api/v1/admin/adverts/[id]]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
