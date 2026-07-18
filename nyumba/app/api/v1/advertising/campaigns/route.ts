import { NextRequest, NextResponse } from 'next/server'
import { requireAdvertiserAuth } from '@/lib/security/advertiserAuth'
import { createAdminClient } from '@/lib/supabase/server'
import { checkSlotAvailability } from '@/lib/ads/fetcher'
import { normalizePhone } from '@/lib/utils/phone'
import { rateLimit } from '@/lib/security/rateLimit'

export async function GET(req: NextRequest) {
  const auth = await requireAdvertiserAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const admin = createAdminClient()
  let q = admin
    .from('ad_campaigns')
    .select(`
      *,
      plan:plan_id (name, ad_type, price_tzs, duration_days, slot_limit)
    `)
    .eq('advertiser_id', auth.advertiser.id)
    .order('created_at', { ascending: false })

  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaigns: data ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdvertiserAuth()
  if (!auth.ok) return auth.response

  // Rate limit: 20 campaign creations per hour per user
  const rl = await rateLimit(`adv_campaigns:${auth.userId}`, 20, 60 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Maombi mengi. Jaribu tena baadaye.' }, { status: 429 })
  }

  if (auth.advertiser.status !== 'active') {
    return NextResponse.json(
      { error: 'Akaunti yako bado haijaidhinishwa. Subiri idhini ya admin.' },
      { status: 403 }
    )
  }

  const body = await req.json()
  const {
    plan_id, ad_type, title, body_text,
    image_url, video_url, cta_type, cta_value,
    target_region, target_district, target_category,
  } = body

  // For WhatsApp CTA, fall back to the advertiser's registered WhatsApp number
  const resolvedCtaValue: string = cta_value
    || (cta_type === 'whatsapp' ? (auth.advertiser.whatsapp_number ?? '') : '')

  if (!plan_id || !ad_type || !title || !cta_type || !resolvedCtaValue || !target_region) {
    return NextResponse.json({ error: 'Tafadhali jaza sehemu zote zinazohitajika' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify plan exists and matches ad_type
  const { data: plan, error: planErr } = await admin
    .from('ad_subscription_plans')
    .select('id, ad_type, price_tzs, duration_days, slot_limit, placements')
    .eq('id', plan_id)
    .eq('is_active', true)
    .single()

  if (planErr || !plan) {
    return NextResponse.json({ error: 'Mpango haukupatikana au hauko active' }, { status: 404 })
  }
  if (plan.ad_type !== ad_type) {
    return NextResponse.json({ error: `Mpango huu ni wa ${plan.ad_type}, siyo ${ad_type}` }, { status: 400 })
  }

  // Check slot availability
  const slot = await checkSlotAvailability({
    ad_type,
    region: target_region,
    plan_slot_limit: plan.slot_limit,
  })

  if (!slot.available) {
    // Add to waiting list
    const { data: existing } = await admin
      .from('ad_waiting_list')
      .select('id')
      .eq('advertiser_id', auth.advertiser.id)
      .eq('ad_type', ad_type)
      .eq('region', target_region)
      .maybeSingle()

    if (!existing) {
      await admin.from('ad_waiting_list').insert({
        advertiser_id: auth.advertiser.id,
        plan_id,
        ad_type,
        region: target_region,
        status: 'waiting',
      })
    }

    return NextResponse.json(
      {
        error: `Nafasi zimejaa kwa ${ad_type} katika ${target_region} (${slot.active}/${slot.limit}). Umewekwa kwenye orodha ya kusubiri.`,
        waiting_list: true,
        slot,
      },
      { status: 409 }
    )
  }

  // Copy placements from plan at creation time (denormalized so existing campaigns
  // are not affected if the plan is later edited)
  const allowed = (plan as { placements?: string[] }).placements ?? [ad_type]

  const { data: campaign, error: insertErr } = await admin
    .from('ad_campaigns')
    .insert({
      advertiser_id:     auth.advertiser.id,
      plan_id,
      ad_type,
      title,
      body_text:         body_text || null,
      image_url:         image_url || null,
      video_url:         video_url || null,
      cta_type,
      cta_value: ['whatsapp', 'call'].includes(cta_type)
        ? normalizePhone(resolvedCtaValue)
        : resolvedCtaValue,
      target_region,
      target_district:   target_district || null,
      target_category:   target_category || null,
      allowed_placements: allowed,
      status:            'pending_review',
      payment_status:    'pending',
    })
    .select()
    .single()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, campaign }, { status: 201 })
}
