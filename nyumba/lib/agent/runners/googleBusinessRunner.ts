import { RunnerResult } from '../types'
import { runFacebookGraph } from '@/lib/scraper/sources/facebookGraph'

// Google Business uses Swahili queries + website enrichment (different from Google Maps English queries)
export async function runGoogleBusinessRunner(region: string): Promise<RunnerResult> {
  try {
    const stats = await runFacebookGraph(region, 'google_business')
    const runId = `google_business_${region}_${Date.now()}`
    console.log(`✅ Google Business done: saved=${stats.saved} (${region})`)
    return { runId, source: 'google_business', status: 'SUCCEEDED', region }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('❌ Google Business runner error:', msg)
    return { runId: '', source: 'google_business', status: 'FAILED', error: msg, region }
  }
}
