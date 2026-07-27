import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/admin/fundi-subscription-plans
// Returns all plans (including inactive) for admin management
export async function GET(_req: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('fundi_subscription_plans')
      .select('*')
      .order('display_order', { ascending: true })

    if (error) throw error
    return NextResponse.json({ plans: data ?? [] })
  } catch (err) {
    console.error('[GET /admin/fundi-subscription-plans]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/admin/fundi-subscription-plans
// Body: { name, description?, price_tzs, billing_cycle?, max_job_forms?, features?, is_active?, is_default?, display_order? }
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const body = await req.json()
    const {
      name, description, price_tzs, billing_cycle = 'monthly',
      max_job_forms = 10, features = {}, is_active = true,
      is_default = false, display_order = 0,
    } = body

    if (!name?.trim()) return NextResponse.json({ error: 'Jina la mpango linahitajika' }, { status: 400 })
    if (price_tzs == null || isNaN(Number(price_tzs)) || Number(price_tzs) < 0) {
      return NextResponse.json({ error: 'Bei sahihi inahitajika' }, { status: 400 })
    }
    if (!['monthly', 'quarterly', 'annual'].includes(billing_cycle)) {
      return NextResponse.json({ error: 'billing_cycle lazima iwe monthly, quarterly, au annual' }, { status: 400 })
    }

    const admin = createAdminClient()

    // If this plan is set as default, clear any existing default first
    if (is_default) {
      await admin
        .from('fundi_subscription_plans')
        .update({ is_default: false })
        .eq('is_default', true)
    }

    const { data, error } = await admin
      .from('fundi_subscription_plans')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        price_tzs:     Number(price_tzs),
        billing_cycle,
        max_job_forms: Number(max_job_forms),
        features,
        is_active,
        is_default,
        display_order: Number(display_order),
        created_by: auth.userId,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ plan: data }, { status: 201 })
  } catch (err) {
    console.error('[POST /admin/fundi-subscription-plans]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
