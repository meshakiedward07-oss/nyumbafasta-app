import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminAuth } from '@/lib/security/adminAuth'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { runId: string } },
) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  try {
    const { runId } = params

    // runId format: <source>_<region>_<timestamp>
    const [source, ...rest] = runId.split('_')
    const timestamp = rest.pop()
    const region = rest.join(' ')

    const { count } = await supabaseAdmin
      .from('agent_leads')
      .select('*', { count: 'exact', head: true })
      .eq('source', source)

    return NextResponse.json({
      runId,
      status:     'SUCCEEDED',
      source,
      region,
      startedAt:  timestamp ? new Date(parseInt(timestamp)).toISOString() : null,
      finishedAt: new Date().toISOString(),
      leadsInDb:  count ?? 0,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
