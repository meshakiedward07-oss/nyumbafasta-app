import { RunnerResult } from '../types'
import { runGooglePlaces } from '@/lib/scraper/sources/googlePlaces'

export async function runGoogleMapsRunner(
  region: string
): Promise<RunnerResult> {
  try {
    const stats = await runGooglePlaces(region)
    const runId = `google_maps_${region}_${Date.now()}`
    console.log(`✅ Google Maps done: saved=${stats.saved} (${region})`)
    return { runId, source: 'google_maps', status: 'SUCCEEDED', region, saved: stats.saved }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('❌ Google Maps runner error:', msg)
    return { runId: '', source: 'google_maps', status: 'FAILED', error: msg, region }
  }
}
