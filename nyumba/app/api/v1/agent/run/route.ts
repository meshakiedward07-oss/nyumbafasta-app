import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TANZANIA_REGIONS } from '@/lib/agent/regions'
import { hasPermission, logStaffActivity } from '@/lib/staff/checkPermission'

export const dynamic    = 'force-dynamic'
export const maxDuration = 300

const API_SOURCES     = ['google_maps', 'google_business'] as const
const BROWSER_SOURCES = ['facebook_groups', 'facebook_pages', 'instagram', 'tiktok'] as const
type AnySource = typeof API_SOURCES[number] | typeof BROWSER_SOURCES[number]
const ALL_SOURCES: AnySource[] = [...API_SOURCES, ...BROWSER_SOURCES]

function withTimeout<T>(promise: Promise<T>, ms: number, source: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout — ${source} ilichukua zaidi ya ${ms / 1000}s`)), ms)
    ),
  ])
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: userData } = await supabase
      .from('users').select('role, staff_active').eq('id', user.id).single()
    const role = userData?.role ?? ''
    if (role !== 'admin') {
      if (role !== 'staff') {
        return NextResponse.json({ error: 'Admin tu anaweza run agent' }, { status: 403 })
      }
      if (userData?.staff_active === false) {
        return NextResponse.json({ error: 'Akaunti ya staff imezimwa' }, { status: 403 })
      }
      const allowed = await hasPermission(user.id, 'lead_scraper')
      if (!allowed) {
        return NextResponse.json({ error: 'Huna ruhusa ya kuendesha scraper' }, { status: 403 })
      }
    }

    let body: { region?: string; sources?: string[] } = {}
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Request body si JSON sahihi' }, { status: 400 })
    }
    const { region, sources } = body

    if (!region || !TANZANIA_REGIONS.includes(region)) {
      return NextResponse.json(
        { error: `Region si sahihi. Tumia: ${TANZANIA_REGIONS.slice(0, 5).join(', ')}...` },
        { status: 400 }
      )
    }
    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json({ error: 'Chagua angalau source moja' }, { status: 400 })
    }
    const invalid = sources.filter(s => !ALL_SOURCES.includes(s as AnySource))
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Sources si sahihi: ${invalid.join(', ')}` }, { status: 400 })
    }

    const missing: string[] = []
    if (!process.env.ANTHROPIC_API_KEY) missing.push('ANTHROPIC_API_KEY')
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Environment variables zinakosekana: ${missing.join(', ')}`, missing },
        { status: 500 }
      )
    }

    const googleKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY
    const hasApiSources = sources.some(s => API_SOURCES.includes(s as typeof API_SOURCES[number]))
    if (!googleKey && hasApiSources) {
      return NextResponse.json(
        { error: 'GOOGLE_PLACES_API_KEY haipo kwenye environment variables' },
        { status: 500 }
      )
    }

    const runs = []

    for (const source of sources) {
      try {
        let result

        // Dynamic imports — Playwright runners are NOT loaded when only google_maps is requested
        switch (source as AnySource) {
          case 'google_maps': {
            const { runGoogleMapsRunner } = await import('@/lib/agent/runners/googleMapsRunner')
            result = await withTimeout(runGoogleMapsRunner(region), 240_000, source)
            break
          }
          case 'google_business': {
            const { runGoogleBusinessRunner } = await import('@/lib/agent/runners/googleBusinessRunner')
            result = await withTimeout(runGoogleBusinessRunner(region), 240_000, source)
            break
          }
          case 'facebook_groups': {
            const { runFacebookGroupsRunner } = await import('@/lib/agent/runners/facebookRunner')
            result = await withTimeout(runFacebookGroupsRunner(region), 120_000, source)
            break
          }
          case 'facebook_pages': {
            const { runFacebookPagesRunner } = await import('@/lib/agent/runners/facebookRunner')
            result = await withTimeout(runFacebookPagesRunner(region), 120_000, source)
            break
          }
          case 'instagram': {
            const { runInstagramRunner } = await import('@/lib/agent/runners/instagramRunner')
            result = await withTimeout(runInstagramRunner(region), 120_000, source)
            break
          }
          case 'tiktok': {
            const { runTiktokRunner } = await import('@/lib/agent/runners/tiktokRunner')
            result = await withTimeout(runTiktokRunner(region), 120_000, source)
            break
          }
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

    logStaffActivity({
      staffId:      user.id,
      actionType:   'scraper_run',
      resourceType: 'agent_leads',
      description:  `Aliendesha scraper: ${region} | sources: ${sources.join(', ')} | ${started.length}/${runs.length} zilifaulu`,
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      region,
      runs,
      started: started.length,
      failed: failed.length,
      errors: failed.map(r => ({ source: r.source, error: r.error })),
      message: `${started.length}/${runs.length} sources zimekamilika kwenye ${region}`,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Agent run error:', err)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
