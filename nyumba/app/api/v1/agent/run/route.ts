/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  runGoogleMapsRunner,
  runGoogleBusinessRunner,
  runFacebookGroupsRunner,
  runFacebookPagesRunner,
  runInstagramRunner,
  runTiktokRunner
} from '@/lib/agent/runners'
import { LeadSource } from '@/lib/agent/types'
import { TANZANIA_REGIONS } from '@/lib/agent/regions'

const VALID_REGIONS = TANZANIA_REGIONS

const VALID_SOURCES: LeadSource[] = [
  'google_maps', 'google_business',
  'facebook_groups', 'facebook_pages',
  'instagram', 'tiktok'
]

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin tu anaweza run agent' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { region, sources } = body

    if (!region || !VALID_REGIONS.includes(region)) {
      return NextResponse.json(
        { error: `Region si sahihi. Chagua: ${VALID_REGIONS.join(', ')}` },
        { status: 400 }
      )
    }

    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json(
        { error: 'Chagua angalau source moja' },
        { status: 400 }
      )
    }

    const invalidSources = sources.filter(
      (s: string) => !VALID_SOURCES.includes(s as LeadSource)
    )
    if (invalidSources.length > 0) {
      return NextResponse.json(
        { error: `Sources si sahihi: ${invalidSources.join(', ')}` },
        { status: 400 }
      )
    }

    const runs = []

    for (const source of sources) {
      let result

      switch (source) {
        case 'google_maps':
          result = await runGoogleMapsRunner(region)
          break
        case 'google_business':
          result = await runGoogleBusinessRunner(region)
          break
        case 'facebook_groups':
          result = await runFacebookGroupsRunner()
          break
        case 'facebook_pages':
          result = await runFacebookPagesRunner(region)
          break
        case 'instagram':
          result = await runInstagramRunner(region)
          break
        case 'tiktok':
          result = await runTiktokRunner(region)
          break
        default:
          continue
      }

      runs.push(result)

      if (result.runId && result.status !== 'FAILED') {
        await registerWebhook(result.runId, source, region)
      }
    }

    return NextResponse.json({
      success: true,
      region,
      runs,
      message: `Agent imeanzishwa kwa ${runs.length} sources kwenye ${region}`
    })

  } catch (err: any) {
    console.error('Agent run error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function registerWebhook(
  runId: string,
  source: string,
  region: string
) {
  try {
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/agent/webhook`

    await fetch(
      `https://api.apify.com/v2/acts/runs/${runId}/webhooks`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.APIFY_TOKEN}`
        },
        body: JSON.stringify({
          eventTypes: ['ACTOR.RUN.SUCCEEDED'],
          requestUrl: webhookUrl,
          payloadTemplate: JSON.stringify({
            runId: '{{runId}}',
            source,
            region,
            secret: process.env.WEBHOOK_SECRET
          })
        })
      }
    )
  } catch (err) {
    console.error('Webhook register error:', err)
  }
}
