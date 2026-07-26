import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string; memberId: string }> }

const VALID_ROLES = ['owner', 'branch_manager', 'agent', 'maintenance_coordinator', 'accountant']

// PATCH /api/v1/organizations/[id]/members/[memberId] — change a member's role
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id, memberId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const [{ data: actorM }, { data: actorU }] = await Promise.all([
      admin.from('organization_members').select('role').eq('organization_id', id).eq('user_id', user.id).maybeSingle(),
      admin.from('users').select('role').eq('id', user.id).single(),
    ])
    const isAdminStaff = ['admin', 'staff'].includes(actorU?.role ?? '')
    const isOwner      = actorM?.role === 'owner'
    if (!isOwner && !isAdminStaff) {
      return NextResponse.json({ error: 'Mwenye shirika peke yake anaweza kubadilisha nafasi' }, { status: 403 })
    }

    const { role } = await req.json()
    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Nafasi si sahihi' }, { status: 400 })
    }

    // Fetch the target membership record
    const { data: target } = await admin
      .from('organization_members')
      .select('id, role, user_id')
      .eq('id', memberId)
      .eq('organization_id', id)
      .maybeSingle()

    if (!target) return NextResponse.json({ error: 'Mwanachama hajapatikana' }, { status: 404 })

    // Prevent demoting the last owner
    if (target.role === 'owner' && role !== 'owner') {
      const { count } = await admin
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', id)
        .eq('role', 'owner')
      if ((count ?? 0) <= 1) {
        return NextResponse.json({ error: 'Lazima kuwe na mwenye shirika mmoja angalau. Hamisha umiliki kwanza.' }, { status: 400 })
      }
    }

    const { data, error } = await admin
      .from('organization_members')
      .update({ role })
      .eq('id', memberId)
      .select('id, role, joined_at, user:users(id, full_name, phone, avatar_url)')
      .single()

    if (error) throw error
    return NextResponse.json({ member: data })
  } catch (err) {
    console.error('[PATCH /organizations/[id]/members/[memberId]]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
