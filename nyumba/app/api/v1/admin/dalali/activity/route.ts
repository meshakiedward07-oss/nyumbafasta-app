import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { getDalaliActivityReport } from '@/lib/dalali/accountMonitor'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const riskLevel         = searchParams.get('risk') ?? 'all'
  const daysWithoutListing = searchParams.get('days') ? parseInt(searchParams.get('days')!) : undefined
  const page              = parseInt(searchParams.get('page') ?? '0')

  try {
    const report = await getDalaliActivityReport({ riskLevel, daysWithoutListing, page })
    return NextResponse.json(report)
  } catch (err: unknown) {
    console.error('[DalaliActivity] Error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
