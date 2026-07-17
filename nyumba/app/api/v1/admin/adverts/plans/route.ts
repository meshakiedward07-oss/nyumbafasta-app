import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ad_subscription_plans')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plans: data ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const {
    name, ad_type, description,
    price_tzs, duration_days, slot_limit,
    features, display_order, is_active,
  } = body

  if (!name || !ad_type || !price_tzs || !duration_days || !slot_limit) {
    return NextResponse.json({ error: 'name, ad_type, price_tzs, duration_days, slot_limit zinahitajika' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ad_subscription_plans')
    .insert({
      name, ad_type,
      description:    description || null,
      price_tzs,
      duration_days,
      slot_limit,
      features:       features || [],
      display_order:  display_order ?? 99,
      is_active:      is_active ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plan: data }, { status: 201 })
}
