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

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const REGIONS = [
  'Dar es Salaam', 'Arusha', 'Mwanza',
  'Dodoma', 'Zanzibar', 'Mbeya',
  'Tanga', 'Morogoro', 'Kilimanjaro',
]

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: string[] = []
  const errors: string[] = []

  for (const region of REGIONS) {
    try {
      const runners = [
        { fn: runGoogleMapsRunner,      source: 'google_maps'     },
        { fn: runGoogleBusinessRunner,  source: 'google_business'  },
        { fn: runFacebookGroupsRunner,  source: 'facebook_groups'  },
        { fn: runFacebookPagesRunner,   source: 'facebook_pages'   },
        { fn: runInstagramRunner,       source: 'instagram'        },
        { fn: runTiktokRunner,          source: 'tiktok'           },
      ]

      for (const { fn, source } of runners) {
        const result = await fn(region)
        if (result.runId) {
          await registerAgentWebhook(result.runId, source, region)
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
