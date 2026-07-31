import { NextRequest } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function verifyAdmin() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const { data } = await sb.from('users').select('role').eq('id', user.id).single()
  return data?.role === 'admin' ? user : null
}

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status  = searchParams.get('status') ?? 'all'
  const plan    = searchParams.get('plan')   ?? 'all'
  const q       = searchParams.get('q')      ?? ''
  const page    = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit   = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10))
  const offset  = (page - 1) * limit

  const db = createAdminClient()

  let query = db
    .from('subscriptions')
    .select(`
      id, plan, status, expires_at, created_at, updated_at,
      dalali:dalali_id (
        id, full_name, phone, username, is_active,
        dalali_profiles ( whatsapp_number, is_premium_verified )
      )
    `, { count: 'exact' })
    .order('expires_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status !== 'all') query = query.eq('status', status)
  if (plan   !== 'all') query = query.eq('plan',   plan)

  const { data, count, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Client-side name/phone search
  let subs = data ?? []
  if (q) {
    const lq = q.toLowerCase()
    subs = subs.filter(s => {
      const d = s.dalali as { full_name?: string; phone?: string; username?: string } | null
      return (
        d?.full_name?.toLowerCase().includes(lq) ||
        d?.phone?.includes(lq) ||
        d?.username?.toLowerCase().includes(lq)
      )
    })
  }

  // Summary counts by status and plan
  const [activeCount, trialCount, expiredCount, basicCount, premiumCount] = await Promise.all([
    db.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'trial'),
    db.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'expired'),
    db.from('subscriptions').select('*', { count: 'exact', head: true }).eq('plan', 'basic').neq('status', 'expired'),
    db.from('subscriptions').select('*', { count: 'exact', head: true }).eq('plan', 'premium').neq('status', 'expired'),
  ])

  return Response.json({
    subscriptions: subs,
    total:  q ? subs.length : (count ?? 0),
    page,
    limit,
    summary: {
      active:   activeCount.count  ?? 0,
      trial:    trialCount.count   ?? 0,
      expired:  expiredCount.count ?? 0,
      basic:    basicCount.count   ?? 0,
      premium:  premiumCount.count ?? 0,
    },
  })
}
