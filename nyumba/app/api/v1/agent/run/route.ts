import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300
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

    if (!region || !TANZANIA_REGIONS.includes(region)) {
      return NextResponse.json(
        { error: `Region si sahihi. Chagua: ${TANZANIA_REGIONS.join(', ')}` },
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
      try {
        let result

        switch (source) {
          case 'google_maps':
            result = await runGoogleMapsRunner(region)
            break
          case 'google_business':
            result = await runGoogleBusinessRunner(region)
            break
          case 'facebook_groups':
            result = await runFacebookGroupsRunner(region)
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

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`❌ ${source} threw:`, msg)
        runs.push({ runId: '', source, status: 'FAILED', error: msg, region })
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
      message: `${started.length}/${runs.length} sources zimekamilika kwenye ${region}`
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Agent run error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
