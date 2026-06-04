/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { ApifyClient } from 'apify-client'

const apify = new ApifyClient({
  token: process.env.APIFY_TOKEN
})

export async function GET(
  _req: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const run = await apify.run(params.runId).get()

    if (!run) {
      return NextResponse.json(
        { error: 'Run haikupatikana' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      runId: run.id,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      stats: run.stats
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
