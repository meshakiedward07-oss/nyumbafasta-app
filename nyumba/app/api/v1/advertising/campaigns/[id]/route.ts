import { NextRequest, NextResponse } from 'next/server'
import { requireAdvertiserAuth } from '@/lib/security/advertiserAuth'
import { createAdminClient } from '@/lib/supabase/server'
import { validateCtaValue } from '@/lib/ads/ctaValidation'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdvertiserAuth()
    if (!auth.ok) return auth.response

    const { id } = await params
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('ad_campaigns')
      .select('*, plan:plan_id (*)')
      .eq('id', id)
      .eq('advertiser_id', auth.advertiser.id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Kampeni haikupatikana' }, { status: 404 })
    return NextResponse.json({ campaign: data })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET app/api/v1/advertising/campaigns/[id]]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdvertiserAuth()
    if (!auth.ok) return auth.response

    const { id } = await params
    const admin = createAdminClient()

    const { data: existing } = await admin
      .from('ad_campaigns')
      .select('id, status, cta_type, cta_value')
      .eq('id', id)
      .eq('advertiser_id', auth.advertiser.id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Kampeni haikupatikana' }, { status: 404 })
    if (existing.status === 'active') {
      return NextResponse.json({ error: 'Kampeni inayoendelea haiwezi kubadilishwa' }, { status: 403 })
    }

    const body = await req.json()
    const allowed = ['title', 'body_text', 'image_url', 'video_url', 'cta_type', 'cta_value',
                     'target_region', 'target_district', 'target_category']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Hakuna mabadiliko' }, { status: 400 })
    }

    // Validate cta_value against the FINAL cta_type (either may be edited
    // independently) — this route used to blind-copy cta_value straight from
    // the request body with no check at all, so an approved campaign's
    // 'website' CTA could be swapped to a javascript: URI post-approval and
    // rendered as a raw <a href> to every site visitor (stored XSS, found in
    // the 2026-09-01 ads-system audit; see lib/ads/ctaValidation.ts).
    if ('cta_type' in updates || 'cta_value' in updates) {
      const finalType  = (updates.cta_type  as string | undefined) ?? existing.cta_type
      const finalValue = (updates.cta_value as string | undefined) ?? existing.cta_value
      const ctaCheck   = validateCtaValue(finalType, finalValue)
      if (!ctaCheck.ok) {
        return NextResponse.json({ error: ctaCheck.error }, { status: 400 })
      }
      updates.cta_value = ctaCheck.value
    }

    // Re-queue for review when the owner edits an already-reviewed campaign.
    // Previously only 'rejected' campaigns were re-queued — an 'approved'
    // (paid-pending) campaign could have its creative, CTA, or *target_region*
    // changed after admin sign-off with no re-review at all, and once paid it
    // activates immediately (see lib/ads/processAdPayment.ts) — including
    // into a region/slot admin never actually vetted it for.
    if (existing.status === 'rejected' || existing.status === 'approved') {
      updates.status    = 'pending_review'
      updates.admin_note = null
    }

    const { data, error } = await admin
      .from('ad_campaigns')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ campaign: data })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[PATCH app/api/v1/advertising/campaigns/[id]]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdvertiserAuth()
    if (!auth.ok) return auth.response

    const { id } = await params
    const admin = createAdminClient()

    const { data: existing } = await admin
      .from('ad_campaigns')
      .select('id, status, payment_status')
      .eq('id', id)
      .eq('advertiser_id', auth.advertiser.id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Kampeni haikupatikana' }, { status: 404 })
    if (existing.payment_status === 'completed') {
      return NextResponse.json({ error: 'Kampeni iliyolipwa haiwezi kufutwa. Wasiliana na msaada.' }, { status: 403 })
    }

    const { error } = await admin.from('ad_campaigns').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[DELETE app/api/v1/advertising/campaigns/[id]]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
