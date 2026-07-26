import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// GET /api/v1/organizations/[id]/members
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data: m } = await admin.from('organization_members').select('id').eq('organization_id', id).eq('user_id', user.id).maybeSingle()
    const { data: u } = await admin.from('users').select('role').eq('id', user.id).single()
    if (!m && !['admin', 'staff'].includes(u?.role ?? '')) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const { data, error } = await admin
      .from('organization_members')
      .select('id, role, joined_at, user:users(id, full_name, email, phone, avatar_url)')
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
    const canManage = m?.role === 'owner' || ['admin', 'staff'].includes(u?.role ?? '')
    if (!canManage) return NextResponse.json({ error: 'Mwenye shirika peke yake anaweza kuongeza wanachama' }, { status: 403 })

    const body = await req.json()
    const { role, phone, email } = body
    let { user_id } = body

    if (!role) return NextResponse.json({ error: 'role inahitajika' }, { status: 400 })
    if (!['owner', 'branch_manager', 'agent', 'maintenance_coordinator', 'accountant'].includes(role)) {
      return NextResponse.json({ error: 'Nafasi si sahihi' }, { status: 400 })
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

    const { error } = await admin.from('organization_members').delete().eq('organization_id', id).eq('user_id', targetUserId)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /organizations/[id]/members]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
