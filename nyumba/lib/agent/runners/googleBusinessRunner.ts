import { RunnerResult } from '../types'
import { runGooglePlaces } from '@/lib/scraper/sources/googlePlaces'

export async function runGoogleBusinessRunner(
  region: string
): Promise<RunnerResult> {
  try {
    const stats = await runGooglePlaces(region)
    const runId = `google_business_${region}_${Date.now()}`
    console.log(`✅ Google Business done: saved=${stats.saved} (${region})`)
    return { runId, source: 'google_business', status: 'SUCCEEDED', region }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('❌ Google Business runner error:', msg)
    return { runId: '', source: 'google_business', status: 'FAILED', error: msg, region }
  }
}
