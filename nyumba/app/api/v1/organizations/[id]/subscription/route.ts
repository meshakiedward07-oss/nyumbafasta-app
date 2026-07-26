import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// GET /api/v1/organizations/[id]/subscription
// Returns the org's current subscription + all public plans for the upgrade picker
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()

    // Verify the caller is a member of this org (or admin/staff)
    const [{ data: membership }, { data: userRow }] = await Promise.all([
      admin.from('organization_members').select('role').eq('organization_id', id).eq('user_id', user.id).maybeSingle(),
      admin.from('users').select('role').eq('id', user.id).single(),
    ])
    const isAdminStaff = ['admin', 'staff'].includes(userRow?.role ?? '')
    if (!membership && !isAdminStaff) {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    }

    const [
      { data: subscription },
      { data: plans },
      { count: propCount },
      { count: unitCount },
      { count: memberCount },
    ] = await Promise.all([
      admin.from('organization_subscriptions').select('*, plan:subscription_plans(*)').eq('org_id', id).maybeSingle(),
      admin.from('subscription_plans').select('*').eq('is_active', true).eq('is_public', true).order('price_tzs', { ascending: true }),
      admin.from('listings').select('id', { count: 'exact', head: true }).eq('managing_org_id', id),
      admin.from('property_units').select('id', { count: 'exact', head: true }).eq('org_id', id),
      admin.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', id),
    ])

    return NextResponse.json({
      subscription: subscription ?? null,
      plans: plans ?? [],
      usage: { properties: propCount ?? 0, units: unitCount ?? 0, members: memberCount ?? 0 },
    })
  } catch (err) {
    console.error('[GET /organizations/[id]/subscription]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
