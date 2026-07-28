import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireStaffAuth } from '@/lib/security/adminAuth'

export const dynamic = 'force-dynamic'

// GET /api/v1/leads/batches — import batch history
export async function GET() {
  const auth = await requireStaffAuth()
  if (!auth.ok) return auth.response

  try {
    const { data } = await supabaseAdmin
      .from('lead_import_batches')
      .select('id, file_name, total_rows, imported_count, duplicate_count, error_count, status, created_at')
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({ batches: data ?? [] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
