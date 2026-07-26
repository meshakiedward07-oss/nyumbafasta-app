import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: { id: string } }

// POST /api/v1/conversations/:id/messages
export async function POST(req: NextRequest, { params }: Params) {
  const { id: conversationId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()

    // Verify sender is a participant
    const { count } = await admin
      .from('conversation_participants')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)

    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    if (!count && !isAdminStaff) return NextResponse.json({ error: 'Huna ruhusa ya kutuma ujumbe' }, { status: 403 })

    const body = await req.json()
    const { message, message_type = 'text', is_internal = false } = body

    if (!message?.trim()) return NextResponse.json({ error: 'Ujumbe hauwezi kuwa tupu' }, { status: 400 })

    const now = new Date().toISOString()

    // Insert message
    const { data: msg, error: msgErr } = await admin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id:       user.id,
        body:            message.trim(),
        message_type,
        is_internal,
      })
      .select(`
        id, conversation_id, sender_id, body, message_type, is_internal, created_at,
        sender:users!sender_id(id, full_name, avatar_url)
      `)
      .single()

    if (msgErr) throw msgErr

    // Update conversation last_message_at
    await admin
      .from('conversations')
      .update({ last_message_at: now, updated_at: now })
      .eq('id', conversationId)

    // Mark sender as read up to now
    await admin
      .from('conversation_participants')
      .update({ last_read_at: now })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)

    return NextResponse.json({ message: msg }, { status: 201 })
  } catch (err) {
    console.error('[POST /conversations/:id/messages]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
