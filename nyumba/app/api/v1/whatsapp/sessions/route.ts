import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return user
}

// GET /api/v1/whatsapp/sessions — list all sessions with last message
export async function GET(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')   // filter: amina|pending|admin|resolved
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

  let query = supabaseAdmin
    .from('whatsapp_sessions')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)

  const { data: sessions, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach last message preview to each session
  const enriched = await Promise.all(
    (sessions ?? []).map(async (session) => {
      const { data: lastMsg } = await supabaseAdmin
        .from('whatsapp_messages')
        .select('content, sender, created_at, direction')
        .eq('phone_number', session.phone_number)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const { count } = await supabaseAdmin
        .from('whatsapp_messages')
        .select('*', { count: 'exact', head: true })
        .eq('phone_number', session.phone_number)
        .eq('direction', 'inbound')

      return {
        ...session,
        last_message: lastMsg ?? null,
        message_count: count ?? 0,
      }
    })
  )

  return NextResponse.json({ sessions: enriched })
}
