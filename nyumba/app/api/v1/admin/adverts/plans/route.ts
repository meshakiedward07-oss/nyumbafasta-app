import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('ad_subscription_plans')
      .select('id, name, ad_type, price_tzs, duration_days, slot_limit, display_order, is_active, visibility, description')
      .order('display_order', { ascending: true })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ plans: data ?? [] })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET app/api/v1/admin/adverts/plans]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const body = await req.json()
    const {
      name, ad_type, bundle_types, description,
      price_tzs, duration_days, slot_limit,
      features, display_order, is_active, placements, visibility,
    } = body

    if (!name || !ad_type || !price_tzs || !duration_days || !slot_limit) {
      return NextResponse.json(
        { error: 'name, ad_type, price_tzs, duration_days, slot_limit zinahitajika' },
        { status: 400 }
      )
    }

    const resolvedBundleTypes = Array.isArray(bundle_types) && bundle_types.length > 0
      ? bundle_types
      : [ad_type]

    const resolvedPlacements = Array.isArray(placements) && placements.length > 0
      ? placements
      : [ad_type]

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('ad_subscription_plans')
      .insert({
        name,
        ad_type,
        bundle_types:  resolvedBundleTypes,
        description:   description || null,
        price_tzs,
        duration_days,
        slot_limit,
        features:      features || [],
        placements:    resolvedPlacements,
        visibility:    visibility ?? 'new_campaign',
        display_order: display_order ?? 99,
        is_active:     is_active ?? true,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ plan: data }, { status: 201 })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST app/api/v1/admin/adverts/plans]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
