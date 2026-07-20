export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateFinancialSummary } from '@/lib/accounting/reportGenerator'
import { cache, TTL } from '@/lib/cache/memoryCache'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return user
}

// GET /api/v1/accounting/summary?period=monthly&date=2026-06-01
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = req.nextUrl
    const period  = (searchParams.get('period') ?? 'monthly') as 'daily' | 'weekly' | 'monthly' | 'yearly'
    const dateStr = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)

    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(period)) {
      return NextResponse.json({ error: 'period lazima iwe daily|weekly|monthly|yearly' }, { status: 400 })
    }

    const cacheKey = `accounting:summary:${period}:${dateStr}`
    const hit = cache.get(cacheKey)
    if (hit) return NextResponse.json(hit, { headers: { 'Cache-Control': 'no-store' } })

    const summary = await generateFinancialSummary({ period, date: new Date(dateStr) })
    cache.set(cacheKey, summary, TTL.FINANCE_STATS)
    return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Accounting/summary] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
