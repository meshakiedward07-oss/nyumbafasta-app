import { NextRequest, NextResponse } from 'next/server'
import { requireAdvertiserAuth } from '@/lib/security/advertiserAuth'
import { createAdminClient } from '@/lib/supabase/server'
import { checkSlotAvailability } from '@/lib/ads/fetcher'
import { validateCtaValue } from '@/lib/ads/ctaValidation'
import { getDistricts, getWards } from '@/lib/data/tanzania-locations'
import { rateLimit, getClientIp } from '@/lib/security/rateLimit'
import { auditLog } from '@/lib/security/auditLog'

export async function GET(req: NextRequest) {
  try {
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

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET app/api/v1/advertising/campaigns]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
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
      target_region, target_district, target_wards, target_category,
    } = body

    // For WhatsApp CTA, fall back to the advertiser's registered WhatsApp number
    const resolvedCtaValue: string = cta_value
      || (cta_type === 'whatsapp' ? (auth.advertiser.whatsapp_number ?? '') : '')

    if (!plan_id || !ad_type || !title || !cta_type || !resolvedCtaValue || !target_region) {
      return NextResponse.json({ error: 'Tafadhali jaza sehemu zote zinazohitajika' }, { status: 400 })
    }

    const ctaCheck = validateCtaValue(cta_type, resolvedCtaValue)
    if (!ctaCheck.ok) {
      return NextResponse.json({ error: ctaCheck.error }, { status: 400 })
    }

    const admin = createAdminClient()

    // Verify plan exists and matches ad_type
    const { data: plan, error: planErr } = await admin
      .from('ad_subscription_plans')
      .select('id, ad_type, price_tzs, duration_days, slot_limit, placements, geo_scope')
      .eq('id', plan_id)
      .eq('is_active', true)
      .single()

    if (planErr || !plan) {
      return NextResponse.json({ error: 'Mpango haukupatikana au hauko active' }, { status: 404 })
    }
    if (plan.ad_type !== ad_type) {
      return NextResponse.json({ error: `Mpango huu ni wa ${plan.ad_type}, siyo ${ad_type}` }, { status: 400 })
    }

    // ── Geo targeting validation (kata/wilaya, added 2026-09-01) ─────────────
    // The chosen plan's geo_scope dictates what's required/allowed here —
    // trust the plan, not the client, for which scope is being purchased.
    const geoScope: 'region' | 'district' | 'ward' = (plan as { geo_scope?: string }).geo_scope as 'region' | 'district' | 'ward' ?? 'region'
    let finalDistrict: string | null = null
    let finalWards: string[] | null = null

    if (geoScope === 'district' || geoScope === 'ward') {
      if (!target_district || typeof target_district !== 'string') {
        return NextResponse.json({ error: 'Wilaya inahitajika kwa mpango huu' }, { status: 400 })
      }
      const validDistricts = getDistricts(target_region)
      if (!validDistricts.includes(target_district)) {
        return NextResponse.json({ error: 'Wilaya siyo sahihi kwa mkoa huu' }, { status: 400 })
      }
      finalDistrict = target_district
    }

    if (geoScope === 'ward') {
      const wardsInput: unknown = target_wards
      if (!Array.isArray(wardsInput) || wardsInput.length === 0) {
        return NextResponse.json({ error: 'Chagua angalau kata moja' }, { status: 400 })
      }
      const validWards = getWards(target_region, finalDistrict!)
      const cleanWards = [...new Set(wardsInput.filter((w): w is string => typeof w === 'string'))]
      const invalid = cleanWards.filter(w => !validWards.includes(w))
      if (invalid.length > 0) {
        return NextResponse.json({ error: `Kata zisizo sahihi: ${invalid.join(', ')}` }, { status: 400 })
      }
      finalWards = cleanWards
    }

    // Ward-scope pricing is PER WARD — total = plan.price_tzs × number of
    // wards selected (a 2-kata campaign costs double a 1-kata one). Computed
    // here (not trusted from the client) and reused identically at payment
    // time in pay/initiate/route.ts.
    const totalPrice = geoScope === 'ward' ? plan.price_tzs * (finalWards?.length ?? 1) : plan.price_tzs

    // Check slot availability — scoped to the exact geo pool being bought
    // (region-wide / this one district / each of these specific wards), so
    // a kata-scoped campaign never competes with the region-wide pool. This
    // is informational only now, NOT a hard block: since the auto-queue
    // system (lib/ads/slotManager.ts, "Option C" chosen 2026-09-01) handles
    // a full slot gracefully at the actual go-live moment (queues it,
    // auto-activates FIFO once a slot frees), rejecting campaign creation
    // itself here would just be redundant friction working against that —
    // an advertiser can always start the review+payment process; if the
    // slot is still full once approved+paid, they queue instead of going
    // live immediately. Still register a courtesy ad_waiting_list entry
    // (region+ad_type granularity) so the existing "slot opened" WhatsApp
    // ping still fires for people who haven't gone through payment yet.
    const slot = await checkSlotAvailability({
      ad_type,
      region: target_region,
      plan_slot_limit: plan.slot_limit,
      district: finalDistrict,
      wards: finalWards,
    })

    if (!slot.available) {
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
        cta_value:         ctaCheck.value,
        target_region,
        target_district:   finalDistrict,
        target_wards:      finalWards,
        target_category:   target_category || null,
        allowed_placements: allowed,
        status:            'pending_review',
        payment_status:    'pending',
      })
      .select()
      .single()

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

    auditLog({
      action: 'ad_campaign_created',
      user_id: auth.userId,
      target_id: campaign?.id,
      target_type: 'ad_campaign',
      ip_address: getClientIp(req),
      severity: 'info',
    }).catch(() => {})

    return NextResponse.json({ ok: true, campaign }, { status: 201 })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST app/api/v1/advertising/campaigns]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
