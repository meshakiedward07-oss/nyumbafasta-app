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

    // Single DB round-trip: nf_get_conversations uses DISTINCT ON + GROUP BY
    // to return last_message + unread_count without per-conversation queries.
    const { data: enriched, error } = await admin.rpc('nf_get_conversations', {
      p_user_id: user.id,
      p_org_id:  orgId  ?? null,
      p_type:    type   ?? null,
      p_limit:   50,
    })
    if (error) throw error

    // Participants are fetched separately only when needed (not for unread-only requests)
    const conversations = enriched ?? []
    const totalUnread   = conversations.reduce((s: number, c: { unread_count: number }) => s + (c.unread_count ?? 0), 0)

    if (unreadOnly) {
      return NextResponse.json({ unread_count: totalUnread })
    }

    // Attach participant details for the full list view
    const convIds = conversations.map((c: { id: string }) => c.id)
    const participantsMap: Record<string, unknown[]> = {}
    if (convIds.length > 0) {
      const { data: pRows } = await admin
        .from('conversation_participants')
        .select('conversation_id, user_id, role, last_read_at, user:users(id, full_name, avatar_url, phone)')
        .in('conversation_id', convIds)
      for (const p of pRows ?? []) {
        const cid = (p as { conversation_id: string }).conversation_id
        if (!participantsMap[cid]) participantsMap[cid] = []
        participantsMap[cid].push(p)
      }
    }

    const withParticipants = conversations.map((c: { id: string }) => ({
      ...c,
      participants: participantsMap[c.id] ?? [],
    }))

    return NextResponse.json({ conversations: withParticipants, unread_count: totalUnread })
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
