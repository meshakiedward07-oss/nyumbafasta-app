import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'
import type { PlanFeatures } from '@/lib/types/property'

const DEFAULT_FEATURES: PlanFeatures = {
  max_properties:             2,
  max_units:                  5,
  max_members:                2,
  has_reports:                false,
  has_maintenance:            true,
  has_communication_hub:      true,
  has_vendor_directory:       false,
  has_staff_assisted_listing: false,
  has_priority_support:       false,
  trial_days:                 14,
}

// GET /api/v1/admin/subscription-plans
export async function GET() {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('subscription_plans')
      .select('*')
      .order('price_tzs', { ascending: true })

    if (error) throw error
    return NextResponse.json(
      { plans: data ?? [] },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    )
  } catch (err) {
    console.error('[GET /admin/subscription-plans]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/admin/subscription-plans
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const body = await req.json()
    const { name, description, price_tzs, billing_cycle, is_public, features } = body

    if (!name?.trim())                    return NextResponse.json({ error: 'Jina la mpango linahitajika' }, { status: 400 })
    if (typeof price_tzs !== 'number' || price_tzs < 0) return NextResponse.json({ error: 'Bei lazima iwe 0 au zaidi' }, { status: 400 })

    const validCycles = ['monthly', 'quarterly', 'annual']
    if (billing_cycle && !validCycles.includes(billing_cycle)) {
      return NextResponse.json({ error: 'Mzunguko wa bili si sahihi' }, { status: 400 })
    }

    const mergedFeatures: PlanFeatures = { ...DEFAULT_FEATURES, ...(features ?? {}) }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('subscription_plans')
      .insert({
        name:          name.trim(),
        description:   description?.trim() || null,
        price_tzs:     price_tzs,
        billing_cycle: billing_cycle ?? 'monthly',
        is_active:     true,
        is_public:     is_public !== false,
        is_default:    false,
        features:      mergedFeatures,
        created_by:    auth.userId,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ plan: data }, { status: 201 })
  } catch (err) {
    console.error('[POST /admin/subscription-plans]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
