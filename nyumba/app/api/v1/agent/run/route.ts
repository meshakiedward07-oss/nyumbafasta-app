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

    if (!process.env.APIFY_TOKEN) {
      return NextResponse.json(
        { error: 'APIFY_TOKEN haipo kwenye Vercel environment variables' },
        { status: 500 }
      )
    }

    // Webhook URL — Apify itaita hii baada ya run kukamilika
    const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/agent/webhook`
      : undefined

    const runs = []

    for (const source of sources) {
      let result

      try {
        switch (source) {
          case 'google_maps':
            result = await runGoogleMapsRunner(region, webhookUrl)
            break
          case 'google_business':
            result = await runGoogleBusinessRunner(region, webhookUrl)
            break
          case 'facebook_groups':
            result = await runFacebookGroupsRunner(webhookUrl)
            break
          case 'facebook_pages':
            result = await runFacebookPagesRunner(region, webhookUrl)
            break
          case 'instagram':
            result = await runInstagramRunner(region, webhookUrl)
            break
          case 'tiktok':
            result = await runTiktokRunner(region, webhookUrl)
            break
          default:
            continue
        }

        if (result.status === 'FAILED') {
          console.error(`❌ ${source} FAILED:`, result.error)
        } else {
          console.log(`✅ ${source} started — runId: ${result.runId}, webhook: ${webhookUrl ?? 'none'}`)
        }

        runs.push(result)

      } catch (err: any) {
        console.error(`❌ ${source} threw:`, err.message)
        runs.push({
          runId: '',
          source,
          status: 'FAILED',
          error: err.message,
          region
        })
      }
    }

    const failed  = runs.filter(r => r.status === 'FAILED')
    const started = runs.filter(r => r.status !== 'FAILED')

    return NextResponse.json({
      success: true,
      region,
      runs,
      started: started.length,
      failed: failed.length,
      errors: failed.map(r => ({ source: r.source, error: r.error })),
      webhookUrl: webhookUrl ?? null,
      message: `${started.length}/${runs.length} sources zimeanzishwa kwenye ${region}`
    })

  } catch (err: any) {
    console.error('Agent run error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
