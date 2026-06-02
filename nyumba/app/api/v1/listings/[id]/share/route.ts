import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// POST — increment share_count (no auth required, fire-and-forget)
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = createAdminClient()

    const { data } = await admin
      .from('listings')
      .select('share_count')
      .eq('id', params.id)
      .single()

    await admin
      .from('listings')
      .update({ share_count: (data?.share_count ?? 0) + 1 })
      .eq('id', params.id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true }) // tracking is non-critical
  }
}
