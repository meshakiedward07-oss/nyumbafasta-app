import { NextRequest, NextResponse } from 'next/server'
import { requireStaffAuth } from '@/lib/security/adminAuth'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

type Params = { params: Promise<{ senderId: string }> }

// GET /api/v1/social/sessions/[senderId]?platform=instagram|facebook
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireStaffAuth()
    if (!auth.ok) return auth.response

    const { senderId: rawSenderId } = await params
    const senderId = decodeURIComponent(rawSenderId)
    const platform = req.nextUrl.searchParams.get('platform') ?? 'instagram'

    const { data: session } = await supabaseAdmin
      .from('social_sessions')
      .select('*')
      .eq('platform', platform)
      .eq('sender_id', senderId)
      .maybeSingle()

    if (!session) return NextResponse.json({ error: 'Session haipatikani' }, { status: 404 })

    // Fetch recent messages from social_dms + handover messages
    const [{ data: dms }, { data: adminMsgs }] = await Promise.all([
      supabaseAdmin
        .from('social_dms')
        .select('message_text, reply_text, created_at, reply_sent')
        .eq('platform', platform)
        .eq('sender_id', senderId)
        .order('created_at', { ascending: false })
        .limit(30),
      supabaseAdmin
        .from('social_handover_messages')
        .select('role, content, sent_at, sent_by')
        .eq('session_id', session.id)
        .order('sent_at', { ascending: true }),
    ])

    return NextResponse.json({ session, dms: dms ?? [], adminMessages: adminMsgs ?? [] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/v1/social/sessions/[senderId]]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
