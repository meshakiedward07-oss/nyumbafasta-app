import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: { id: string } }

// GET /api/v1/conversations/:id  — full thread with messages
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()

    // Verify participant
    const { count } = await admin
      .from('conversation_participants')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', id)
      .eq('user_id', user.id)

    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    if (!count && !isAdminStaff) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    // Get conversation + participants
    const { data: conv, error: convErr } = await admin
      .from('conversations')
      .select(`
        *,
        participants:conversation_participants(
          id, user_id, role, last_read_at, joined_at,
          user:users(id, full_name, phone, avatar_url)
        )
      `)
      .eq('id', id)
      .single()

    if (convErr || !conv) return NextResponse.json({ error: 'Mazungumzo hayapatikani' }, { status: 404 })

    // Get messages (newest first for pagination, UI reverses)
    const { data: messages } = await admin
      .from('messages')
      .select(`
        id, conversation_id, sender_id, body, message_type, is_internal, created_at, deleted_at,
        sender:users!sender_id(id, full_name, avatar_url),
        attachments:message_attachments(id, file_url, file_name, file_type, file_size)
      `)
      .eq('conversation_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(100)

    return NextResponse.json({ conversation: conv, messages: messages ?? [] })
  } catch (err) {
    console.error('[GET /conversations/:id]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// PATCH /api/v1/conversations/:id  — update title/status
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data: participant } = await admin
      .from('conversation_participants')
      .select('role')
      .eq('conversation_id', id)
      .eq('user_id', user.id)
      .single()

    if (!participant) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const body   = await req.json()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.title  !== undefined) updates.title  = body.title
    if (body.status !== undefined) updates.status = body.status

    const { data: conv, error } = await admin
      .from('conversations')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ conversation: conv })
  } catch (err) {
    console.error('[PATCH /conversations/:id]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
