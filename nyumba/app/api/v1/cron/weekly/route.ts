/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import {
  runGoogleMapsRunner,
  runGoogleBusinessRunner,
  runFacebookGroupsRunner,
  runFacebookPagesRunner,
  runInstagramRunner,
  runTiktokRunner,
} from '@/lib/agent/runners'
import {
  PRIORITY_REGIONS,
  SECONDARY_REGIONS,
  TERTIARY_REGIONS,
} from '@/lib/agent/regions'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: string[] = []
  const errors: string[] = []

  // Jumatatu=1 → priority, Jumanne=2 → secondary, nyingine → tertiary
  const dayOfWeek = new Date().getDay()
  let weeklyRegions: string[]

  if (dayOfWeek === 1) {
    weeklyRegions = PRIORITY_REGIONS
  } else if (dayOfWeek === 2) {
    weeklyRegions = SECONDARY_REGIONS
  } else {
    weeklyRegions = TERTIARY_REGIONS
  }

  for (const region of weeklyRegions) {
    try {
      const runners = [
        runGoogleMapsRunner(region),
        runGoogleBusinessRunner(region),
        runFacebookGroupsRunner(),
        runFacebookPagesRunner(region),
        runInstagramRunner(region),
        runTiktokRunner(region),
      ]

      const settled = await Promise.allSettled(runners)

      for (const result of settled) {
        if (result.status === 'fulfilled' && result.value.runId) {
          await registerAgentWebhook(
            result.value.runId,
            result.value.source,
            region
          )
        }
      }

      results.push(`✅ ${region} — sources zote zimeanzishwa`)
      await new Promise(r => setTimeout(r, 3000))
    } catch (e) {
      errors.push(`❌ ${region}: ${String(e)}`)
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    regions_count: weeklyRegions.length,
    results,
    errors,
  })
}

async function registerAgentWebhook(
  runId: string,
  source: string,
  region: string
) {
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/agent/webhook`
  await fetch(
    `https://api.apify.com/v2/acts/runs/${runId}/webhooks`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.APIFY_TOKEN}`,
      },
      body: JSON.stringify({
        eventTypes: ['ACTOR.RUN.SUCCEEDED'],
        requestUrl: webhookUrl,
        payloadTemplate: JSON.stringify({
          runId: '{{runId}}',
          source,
          region,
          secret: process.env.WEBHOOK_SECRET,
        }),
      }),
    }
  )
}
