/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { ApifyClient } from 'apify-client'
import { analyzeLeadWithClaude } from '@/lib/agent/analyzer'
import { saveLeadToSupabase } from '@/lib/agent/saveLeads'
import { LeadSource } from '@/lib/agent/types'

export const runtime = 'nodejs'
export const maxDuration = 300

const apify = new ApifyClient({
  token: process.env.APIFY_TOKEN
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { runId, source, region, secret } = body

    if (secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }

    if (!runId || !source) {
      return NextResponse.json(
        { error: 'runId na source zinahitajika' },
        { status: 400 }
      )
    }

    console.log(`🤖 Webhook received: ${source} - ${runId}`)

    const run = await apify.run(runId).get()
    if (!run) {
      return NextResponse.json({ error: 'Run haikupatikana' }, { status: 404 })
    }

    const { items } = await apify
      .dataset(run.defaultDatasetId)
      .listItems({ limit: 500 })

    console.log(`📦 Items kuprocess: ${items.length}`)

    let processed = 0
    let saved = 0
    let skipped = 0
    let errors = 0

    for (const item of items) {
      try {
        processed++

        const analysis = await analyzeLeadWithClaude(item, source as LeadSource)

        if (!analysis) {
          skipped++
          continue
        }

        const result = await saveLeadToSupabase(
          analysis,
          source as LeadSource,
          item,
          (item as any).placeId || (item as any).id || undefined
        )

        if (result.saved) {
          saved++
        } else {
          skipped++
        }

        await sleep(200)

      } catch (err) {
        errors++
        console.error('Item process error:', err)
      }
    }

    const summary = { processed, saved, skipped, errors }
    console.log('✅ Webhook done:', summary)

    return NextResponse.json({
      success: true,
      runId,
      source,
      region,
      ...summary
    })

  } catch (err: any) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
