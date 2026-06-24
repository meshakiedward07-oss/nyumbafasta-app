import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createAdminClient()

    const [
      totalRes, clientRes, dalaliRes, staffRes,
      activeRes, suspendedRes, verifiedRes,
    ] = await Promise.all([
      admin.from('users').select('*', { count: 'exact', head: true }),
      admin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'client'),
      admin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'dalali'),
      admin.from('users').select('*', { count: 'exact', head: true }).eq('role', 'staff'),
      admin.from('users').select('*', { count: 'exact', head: true }).eq('is_active', true),
      admin.from('users').select('*', { count: 'exact', head: true }).eq('is_active', false),
      admin.from('dalali_profiles').select('*', { count: 'exact', head: true }).eq('verification_status', 'approved'),
    ])

    return NextResponse.json({
      total:           totalRes.count      ?? 0,
      clients:         clientRes.count     ?? 0,
      dalali:          dalaliRes.count     ?? 0,
      staff:           staffRes.count      ?? 0,
      active:          activeRes.count     ?? 0,
      suspended:       suspendedRes.count  ?? 0,
      verified_dalali: verifiedRes.count   ?? 0,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
