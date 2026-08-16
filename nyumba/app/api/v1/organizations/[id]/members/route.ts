import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgFeatures, checkLimit } from '@/lib/subscription/featureGate'

type Params = { params: Promise<{ id: string }> }

// GET /api/v1/organizations/[id]/members
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data: m } = await admin.from('organization_members').select('id, role').eq('organization_id', id).eq('user_id', user.id).maybeSingle()
    const { data: u } = await admin.from('users').select('role').eq('id', user.id).single()
    const isAdminStaff = ['admin', 'staff'].includes(u?.role ?? '')
    if (!m && !isAdminStaff) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    // Only org owners and platform admins/staff receive sensitive contact fields
    const isPrivileged = m?.role === 'owner' || isAdminStaff
    const userSelect = isPrivileged
      ? 'id, full_name, email, phone, avatar_url'
      : 'id, full_name, avatar_url'

    const { data, error } = await admin
      .from('organization_members')
      .select(`id, role, joined_at, user:users(${userSelect})`)
      .eq('organization_id', id)
      .order('joined_at', { ascending: true })

    if (error) throw error
    return NextResponse.json({ members: data ?? [] })
  } catch (err) {
    console.error('[GET /organizations/[id]/members]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/organizations/[id]/members — add member (owner only)
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data: m } = await admin.from('organization_members').select('role').eq('organization_id', id).eq('user_id', user.id).maybeSingle()
    const { data: u } = await admin.from('users').select('role').eq('id', user.id).single()
    const isAdminStaff = ['admin', 'staff'].includes(u?.role ?? '')
    const canManage = m?.role === 'owner' || isAdminStaff
    if (!canManage) return NextResponse.json({ error: 'Mwenye shirika peke yake anaweza kuongeza wanachama' }, { status: 403 })

    // Feature gate: check max_members limit
    if (!isAdminStaff) {
      const [features, { count: memberCount }] = await Promise.all([
        getOrgFeatures(id),
        admin.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', id),
      ])
      const gate = checkLimit(memberCount ?? 0, features.max_members, 'wanachama')
      if (!gate.ok) return NextResponse.json({ error: gate.error, upgrade_required: true }, { status: gate.status })
    }

    const body = await req.json()
    const { role, phone, email } = body
    let { user_id } = body

    if (!role) return NextResponse.json({ error: 'role inahitajika' }, { status: 400 })
    if (!['owner', 'branch_manager', 'agent', 'maintenance_coordinator', 'accountant'].includes(role)) {
      return NextResponse.json({ error: 'Nafasi si sahihi' }, { status: 400 })
    }

    if (role === 'owner' && !isAdminStaff) {
      return NextResponse.json({ error: 'Nafasi ya mwenye shirika inaweza tu kuwekwa na admin' }, { status: 403 })
    }

    // Accept phone or email lookup in addition to user_id
    if (!user_id && (phone || email)) {
      let lookupQuery = admin.from('users').select('id')
      if (phone) lookupQuery = lookupQuery.eq('phone', phone.trim())
      else       lookupQuery = lookupQuery.eq('email', email.trim().toLowerCase())
      const { data: found } = await lookupQuery.maybeSingle()
      if (!found) {
        return NextResponse.json({
          error: phone
            ? `Hakuna mtumiaji mwenye namba ${phone}. Mwalikeni wajiandikishe kwanza.`
            : `Hakuna mtumiaji mwenye barua pepe hiyo. Mwalikeni wajiandikishe kwanza.`,
        }, { status: 404 })
      }
      user_id = found.id
    }

    if (!user_id) return NextResponse.json({ error: 'user_id, phone, au email inahitajika' }, { status: 400 })

    const { data: existing } = await admin.from('organization_members').select('id').eq('organization_id', id).eq('user_id', user_id).maybeSingle()
    if (existing) return NextResponse.json({ error: 'Mtumiaji tayari ni mwanachama' }, { status: 409 })

    const { data, error } = await admin
      .from('organization_members')
      .insert({ organization_id: id, user_id, role, invited_by: user.id })
      .select('id, role, joined_at, user:users(id, full_name, email, phone, avatar_url)')
      .single()

    if (error) throw error
    return NextResponse.json({ member: data }, { status: 201 })
  } catch (err) {
    console.error('[POST /organizations/[id]/members]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// DELETE /api/v1/organizations/[id]/members?user_id=xxx
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const targetUserId = req.nextUrl.searchParams.get('user_id')
    if (!targetUserId) return NextResponse.json({ error: 'user_id inahitajika' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data: m } = await admin.from('organization_members').select('role').eq('organization_id', id).eq('user_id', user.id).maybeSingle()
    const { data: u } = await admin.from('users').select('role').eq('id', user.id).single()
    const isSelf   = targetUserId === user.id
    const isOwner  = m?.role === 'owner'
    const isAdmin  = ['admin', 'staff'].includes(u?.role ?? '')

    if (!isSelf && !isOwner && !isAdmin) return NextResponse.json({ error: 'Huna ruhusa ya kuondoa mwanachama' }, { status: 403 })

    // Prevent sole owner from removing themselves or being removed
    const { data: targetMember } = await admin
      .from('organization_members')
      .select('role')
      .eq('organization_id', id)
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (targetMember?.role === 'owner') {
      const { count: ownerCount } = await admin
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', id)
        .eq('role', 'owner')
      if ((ownerCount ?? 0) <= 1) {
        return NextResponse.json({ error: 'Haiwezekani kuondoa mwenye shirika wa pekee. Weka mwenye mwingine kwanza.' }, { status: 409 })
      }
    }

    const { error } = await admin.from('organization_members').delete().eq('organization_id', id).eq('user_id', targetUserId)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /organizations/[id]/members]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
