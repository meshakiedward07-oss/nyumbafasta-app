import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminUser } from '@/lib/security/adminAuth'

export async function GET(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const target = new URL(req.url).searchParams.get('target') ?? 'all_dalali'

  let query = supabaseAdmin
    .from('users')
    .select('id')
    .eq('role', 'dalali')
    .eq('is_active', true)
    .not('phone', 'is', null)

  if (target === 'new_dalali') {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('created_at', weekAgo)
  } else if (target === 'active_dalali') {
    const { data: activeSubs } = await supabaseAdmin
      .from('subscriptions')
      .select('dalali_id')
      .eq('status', 'active')
    const activeIds = (activeSubs ?? []).map((s: { dalali_id: string }) => s.dalali_id)
    if (activeIds.length === 0) return NextResponse.json({ count: 0 })
    query = query.in('id', activeIds)
  }

  const { data } = await query.limit(500)
  return NextResponse.json({ count: data?.length ?? 0 })
}
