import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  let days = 30
  let reason = ''
  try {
    const body = await req.json()
    days   = Math.min(Math.max(1, parseInt(body.days) || 30), 90)
    reason = body.reason ?? ''
  } catch { /* body optional */ }

  const admin = createAdminClient()

  // Fetch current deadline so we can add to it (not reset to 90+days)
  const { data: user } = await admin
    .from('users')
    .select('listing_deadline_days, role')
    .eq('id', params.id)
    .single()

  if (!user || user.role !== 'dalali') {
    return NextResponse.json({ error: 'Dalali hapatikani' }, { status: 404 })
  }

  const currentDeadline = (user.listing_deadline_days as number | null) ?? 90
  const newDeadline     = currentDeadline + days

  const { error } = await admin
    .from('users')
    .update({
      listing_deadline_days: newDeadline,
      deletion_reason: reason ? `Muda umepanuliwa siku ${days}: ${reason}` : null,
    })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    newDeadlineDays: newDeadline,
    message: `Muda umepanuliwa kwa siku ${days}`,
  })
}
