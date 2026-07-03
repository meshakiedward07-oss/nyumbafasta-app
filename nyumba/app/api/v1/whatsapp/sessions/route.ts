import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminUser } from '@/lib/security/adminAuth'

const SESSION_FIELDS = 'id, phone_number, display_name, status, assigned_to, created_at, updated_at, metadata'

// GET /api/v1/whatsapp/sessions — list sessions enriched with last message preview
export async function GET(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

  let query = supabaseAdmin
    .from('whatsapp_sessions')
    .select(SESSION_FIELDS)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)

  const { data: sessions, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!sessions?.length) return NextResponse.json({ sessions: [] })

  const phones = sessions.map(s => s.phone_number as string)

  // Batch: fetch last message per session in a single query using window function via RPC,
  // or fall back to a single .in() query ordered by created_at and pick first per phone.
  // Supabase does not support window functions directly, so we fetch recent messages
  // for all phones at once and group in-memory — far better than N+1.
  const [{ data: recentMsgs }, { data: unreadCounts }] = await Promise.all([
    supabaseAdmin
      .from('whatsapp_messages')
      .select('phone_number, content, sender, created_at, direction')
      .in('phone_number', phones)
      .order('created_at', { ascending: false })
      .limit(phones.length * 3), // at most 3 per phone, we only need 1

    supabaseAdmin
      .from('whatsapp_messages')
      .select('phone_number, id', { count: 'exact' })
      .in('phone_number', phones)
      .eq('direction', 'inbound'),
  ])

  type MsgRow = NonNullable<typeof recentMsgs>[number]
  // Group last message by phone (messages are ordered desc, so first seen = latest)
  const lastMsgByPhone = new Map<string, MsgRow>()
  for (const msg of recentMsgs ?? []) {
    if (!lastMsgByPhone.has(msg.phone_number)) lastMsgByPhone.set(msg.phone_number, msg)
  }

  // Count inbound messages per phone
  const countByPhone = new Map<string, number>()
  for (const row of unreadCounts ?? []) {
    countByPhone.set(row.phone_number, (countByPhone.get(row.phone_number) ?? 0) + 1)
  }

  const enriched = sessions.map(session => ({
    ...session,
    last_message: lastMsgByPhone.get(session.phone_number as string) ?? null,
    message_count: countByPhone.get(session.phone_number as string) ?? 0,
  }))

  return NextResponse.json({ sessions: enriched })
}
