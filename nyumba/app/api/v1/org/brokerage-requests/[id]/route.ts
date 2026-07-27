import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/v1/org/brokerage-requests/[id]
// Org-side action: only 'cancel' is allowed (pending requests only).
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const { id }   = await params
    const { action } = await req.json()

    if (action !== 'cancel') {
      return NextResponse.json({ error: 'Kitendo kinachokubalika: "cancel" tu' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Verify org membership
    const { data: membership } = await admin
      .from('organization_members')
      .select('org_id, role')
      .eq('user_id', user.id)
      .in('role', ['owner', 'branch_manager'])
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Huhitaji ruhusa ya kufuta ombi hili' }, { status: 403 })
    }

    // Fetch request — must belong to this org and be pending
    const { data: request } = await admin
      .from('brokerage_requests')
      .select('id, status, org_id')
      .eq('id', id)
      .eq('org_id', membership.org_id)
      .maybeSingle()

    if (!request) return NextResponse.json({ error: 'Ombi halipatikani' }, { status: 404 })
    if (request.status !== 'pending') {
      return NextResponse.json({ error: 'Unaweza kufuta maombi yaliyo katika hali ya "pending" tu' }, { status: 409 })
    }

    const { data, error } = await admin
      .from('brokerage_requests')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ request: data })
  } catch (err) {
    console.error('[PATCH /org/brokerage-requests/[id]]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
