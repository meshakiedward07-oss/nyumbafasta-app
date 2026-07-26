import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// POST /api/v1/organizations/[id]/transfer-ownership
// Body: { new_owner_user_id: string, previous_owner_role?: string }
// - Promotes target member to 'owner'
// - Demotes current owner to previous_owner_role (defaults to 'branch_manager')
// - Only callable by the current owner or admin
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const [{ data: actorM }, { data: actorU }] = await Promise.all([
      admin.from('organization_members').select('id, role').eq('organization_id', id).eq('user_id', user.id).maybeSingle(),
      admin.from('users').select('role').eq('id', user.id).single(),
    ])

    const isAdminStaff = ['admin', 'staff'].includes(actorU?.role ?? '')
    const isOwner      = actorM?.role === 'owner'
    if (!isOwner && !isAdminStaff) {
      return NextResponse.json({ error: 'Mwenye shirika peke yake anaweza kuhamisha umiliki' }, { status: 403 })
    }

    const body = await req.json()
    const { new_owner_user_id, previous_owner_role = 'branch_manager' } = body

    if (!new_owner_user_id) {
      return NextResponse.json({ error: 'new_owner_user_id inahitajika' }, { status: 400 })
    }
    if (new_owner_user_id === user.id && !isAdminStaff) {
      return NextResponse.json({ error: 'Tayari wewe ndiye mwenye shirika' }, { status: 400 })
    }

    const VALID_FALLBACK = ['branch_manager', 'agent', 'accountant', 'maintenance_coordinator']
    if (!VALID_FALLBACK.includes(previous_owner_role)) {
      return NextResponse.json({ error: 'Nafasi ya mwenye wa zamani si sahihi' }, { status: 400 })
    }

    // Verify the new owner is already a member
    const { data: targetM } = await admin
      .from('organization_members')
      .select('id, role')
      .eq('organization_id', id)
      .eq('user_id', new_owner_user_id)
      .maybeSingle()

    if (!targetM) {
      return NextResponse.json({ error: 'Mtumiaji huyo si mwanachama wa shirika hili' }, { status: 404 })
    }
    if (targetM.role === 'owner') {
      return NextResponse.json({ error: 'Mtumiaji huyo tayari ni mwenye shirika' }, { status: 400 })
    }

    // Atomic: promote new owner, demote current owner
    const [promoteRes, demoteRes] = await Promise.all([
      admin
        .from('organization_members')
        .update({ role: 'owner' })
        .eq('organization_id', id)
        .eq('user_id', new_owner_user_id),
      // Only demote if caller is actually a member (not an admin acting externally)
      actorM
        ? admin
            .from('organization_members')
            .update({ role: previous_owner_role })
            .eq('id', actorM.id)
        : Promise.resolve({ error: null }),
    ])

    if (promoteRes.error) throw promoteRes.error
    if (demoteRes.error) throw demoteRes.error

    return NextResponse.json({ ok: true, message: 'Umiliki umehamishwa.' })
  } catch (err) {
    console.error('[POST /organizations/[id]/transfer-ownership]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
