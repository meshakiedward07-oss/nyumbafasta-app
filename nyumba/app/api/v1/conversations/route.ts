import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/conversations?org_id=&type=&unread=1
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const sp      = req.nextUrl.searchParams
    const orgId   = sp.get('org_id')
    const type    = sp.get('type')
    const unreadOnly = sp.get('unread') === '1'

    const admin = createAdminClient()

    // Get conversations the user is a participant of
    const { data: participantRows } = await admin
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', user.id)

    const convIds = (participantRows ?? []).map(p => p.conversation_id)

    if (convIds.length === 0 && unreadOnly) {
      return NextResponse.json({ conversations: [], unread_count: 0 })
    }

    // Build conversation query
    let query = admin
      .from('conversations')
      .select(`
        id, title, conv_type, status, context_type, context_id, org_id,
        created_by, last_message_at, created_at,
        participants:conversation_participants(
          user_id, role, last_read_at,
          user:users(id, full_name, avatar_url, phone)
        )
      `)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (convIds.length > 0) {
      query = query.in('id', convIds)
    }
    if (orgId) query = query.eq('org_id', orgId)
    if (type)  query = query.eq('conv_type', type)

    const { data: conversations, error } = await query
    if (error) throw error

    // Attach last message and unread count per conversation
    const participantMap = Object.fromEntries(
      (participantRows ?? []).map(p => [p.conversation_id, p.last_read_at])
    )

    const enriched = await Promise.all(
      (conversations ?? []).map(async conv => {
        const { data: msgs } = await admin
          .from('messages')
          .select('id, body, sender_id, created_at, message_type, is_internal')
          .eq('conversation_id', conv.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)

        const lastMsg        = msgs?.[0] ?? null
        const lastReadAt     = participantMap[conv.id]
        const { count: unread } = await admin
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .is('deleted_at', null)
          .gt('created_at', lastReadAt ?? '1970-01-01')

        return { ...conv, last_message: lastMsg, unread_count: unread ?? 0 }
      })
    )

    const totalUnread = enriched.reduce((s, c) => s + (c.unread_count ?? 0), 0)

    if (unreadOnly) {
      return NextResponse.json({ unread_count: totalUnread })
    }

    return NextResponse.json({ conversations: enriched, unread_count: totalUnread })
  } catch (err) {
    console.error('[GET /conversations]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/conversations
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const body = await req.json()
    const { title, conv_type = 'general', context_type, context_id,
            org_id, participant_ids = [], first_message } = body

    if (!participant_ids.length && !org_id) {
      return NextResponse.json({ error: 'Lazima uwe na washiriki angalau mmoja' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Create conversation
    const { data: conv, error: convErr } = await admin
      .from('conversations')
      .insert({
        title:        title?.trim() || null,
        conv_type,
        context_type: context_type || null,
        context_id:   context_id   || null,
        org_id:       org_id       || null,
        created_by:   user.id,
        last_message_at: first_message ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (convErr) throw convErr

    // Add creator as owner + all participants as members
    const allParticipants = [
      { conversation_id: conv.id, user_id: user.id, role: 'owner' },
      ...participant_ids
        .filter((id: string) => id !== user.id)
        .map((id: string) => ({ conversation_id: conv.id, user_id: id, role: 'member' })),
    ]
    await admin.from('conversation_participants').insert(allParticipants)

    // Send first message if provided
    let message = null
    if (first_message?.trim()) {
      const { data: msg } = await admin
        .from('messages')
        .insert({ conversation_id: conv.id, sender_id: user.id, body: first_message.trim() })
        .select()
        .single()
      message = msg
    }

    return NextResponse.json({ conversation: conv, message }, { status: 201 })
  } catch (err) {
    console.error('[POST /conversations]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
