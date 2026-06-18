export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateFinancialSummary } from '@/lib/accounting/reportGenerator'

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
    const dateStr = searchParams.get('date')
    const date    = dateStr ? new Date(dateStr) : new Date()

    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(period)) {
      return NextResponse.json({ error: 'period lazima iwe daily|weekly|monthly|yearly' }, { status: 400 })
    }

    const summary = await generateFinancialSummary({ period, date })
    return NextResponse.json(summary)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Accounting/summary] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
