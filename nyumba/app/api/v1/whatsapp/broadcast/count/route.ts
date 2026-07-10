import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminUser } from '@/lib/security/adminAuth'

export async function GET(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const target = new URL(req.url).searchParams.get('target') ?? 'all_dalali'

  // ── Client targets ─────────────────────────────────────────────────────────

  if (target === 'all_clients') {
    const { count } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'client')
      .not('phone', 'is', null)
    return NextResponse.json({ count: count ?? 0 })
  }

  if (target === 'active_clients') {
    const { data: unlocks } = await supabaseAdmin
      .from('contact_unlocks')
      .select('client_id')
      .eq('status', 'completed')
      .limit(5000)
    const uniqueIds = [...new Set((unlocks ?? []).map((u: { client_id: string }) => u.client_id))]
    if (uniqueIds.length === 0) return NextResponse.json({ count: 0 })
    const CHUNK = 200
    let total = 0
    for (let i = 0; i < uniqueIds.length; i += CHUNK) {
      const chunk = uniqueIds.slice(i, i + CHUNK)
      const { count: c } = await supabaseAdmin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .in('id', chunk)
        .not('phone', 'is', null)
      total += c ?? 0
    }
    return NextResponse.json({ count: total })
  }

  // ── Dalali targets ─────────────────────────────────────────────────────────
  // Dalali store their WhatsApp number in dalali_profiles.whatsapp_number,
  // NOT in users.phone. Count dalali who have either field set — matching
  // exactly what the broadcast route does when building the recipient list.

  type DalaliRow = {
    id: string
    phone: string | null
    dalali_profiles: { whatsapp_number: string | null } | { whatsapp_number: string | null }[] | null
  }

  function hasSendablePhone(row: DalaliRow): boolean {
    const profile = Array.isArray(row.dalali_profiles) ? row.dalali_profiles[0] : row.dalali_profiles
    return !!(row.phone || profile?.whatsapp_number)
  }

  if (target === 'active_dalali') {
    const { data: activeSubs } = await supabaseAdmin
      .from('subscriptions')
      .select('dalali_id')
      .eq('status', 'active')
    const activeIds = (activeSubs ?? []).map((s: { dalali_id: string }) => s.dalali_id)
    if (activeIds.length === 0) return NextResponse.json({ count: 0 })

    const { data } = await supabaseAdmin
      .from('users')
      .select('id, phone, dalali_profiles(whatsapp_number)')
      .eq('role', 'dalali')
      .in('id', activeIds)
      .limit(2000)
    const count = (data as DalaliRow[] ?? []).filter(hasSendablePhone).length
    return NextResponse.json({ count })
  }

  if (target === 'new_dalali') {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabaseAdmin
      .from('users')
      .select('id, phone, dalali_profiles(whatsapp_number)')
      .eq('role', 'dalali')
      .gte('created_at', weekAgo)
      .limit(2000)
    const count = (data as DalaliRow[] ?? []).filter(hasSendablePhone).length
    return NextResponse.json({ count })
  }

  // all_dalali (default)
  const { data } = await supabaseAdmin
    .from('users')
    .select('id, phone, dalali_profiles(whatsapp_number)')
    .eq('role', 'dalali')
    .limit(2000)
  const count = (data as DalaliRow[] ?? []).filter(hasSendablePhone).length
  return NextResponse.json({ count })
}
