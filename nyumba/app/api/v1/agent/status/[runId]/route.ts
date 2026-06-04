import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

export async function GET(
  _req: NextRequest,
  { params }: { params: { runId: string } }
) {
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
      status: 'SUCCEEDED',
      source,
      region,
      startedAt: timestamp ? new Date(parseInt(timestamp)).toISOString() : null,
      finishedAt: new Date().toISOString(),
      leadsInDb: count ?? 0
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
