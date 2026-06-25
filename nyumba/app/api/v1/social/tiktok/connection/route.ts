import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin tu' }, { status: 403 })

  const { data: connection } = await supabaseAdmin
    .from('tiktok_connections')
    .select('id, open_id, display_name, avatar_url, follower_count, scopes, connected_at, token_expires_at, is_active')
    .eq('is_active', true)
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const isExpired = connection
    ? new Date() > new Date(connection.token_expires_at as string)
    : false

  return NextResponse.json({
    connection: connection ?? null,
    isExpired,
    isConnected: !!connection && !isExpired,
  })
}
