import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  return data?.role === 'admin' ? user : null
}

export async function GET(req: NextRequest) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const platform = searchParams.get('platform') ?? 'all'
  const status   = searchParams.get('status')   ?? 'flagged'

  let query = supabaseAdmin
    .from('message_classifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (platform !== 'all') query = query.eq('platform', platform)

  if (status === 'flagged') {
    query = query.in('action', ['flagged', 'pending']).in('category', ['personal', 'unclear'])
  } else if (status === 'auto_replied') {
    query = query.eq('action', 'auto_replied')
  } else if (status === 'owner_replied') {
    query = query.eq('action', 'owner_replied')
  } else if (status === 'spam') {
    query = query.eq('action', 'ignored')
  }

  const { data: messages } = await query

  return NextResponse.json({
    messages:    messages ?? [],
    unreadCount: (messages ?? []).filter(m => m.action === 'flagged').length,
  })
}
