import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminAuth } from '@/lib/security/adminAuth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  try {
    const { data } = await supabaseAdmin
      .from('agent_leads')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const { count } = await supabaseAdmin
      .from('agent_leads')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    return NextResponse.json({
      last_run: data?.created_at || null,
      leads_today: count || 0,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
