import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// POST — increment share_count atomically (no auth required, fire-and-forget)
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = createAdminClient()
    await admin.rpc('increment_share_count', { listing_id: params.id })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true }) // tracking is non-critical
  }
}
