import { RunnerResult } from '../types'
import { runFacebookGraph } from '@/lib/scraper/sources/facebookGraph'

// "Google Business" = Swahili Google Places queries + website/FB scraping for enrichment.
// Different from googleMapsRunner which uses English queries only.
// Source tag is 'google_business' (kept for DB consistency).
export async function runGoogleBusinessRunner(region: string): Promise<RunnerResult> {
  try {
    const stats = await runFacebookGraph(region, 'google_business')
    const runId = `google_business_${region}_${Date.now()}`
    return { runId, source: 'google_business', status: 'SUCCEEDED', region, saved: stats.saved }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('❌ Google Business runner error:', msg)
    return { runId: '', source: 'google_business', status: 'FAILED', error: msg, region }
  }
}
