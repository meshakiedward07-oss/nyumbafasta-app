import { RunnerResult } from '../types'
import { runInstagram } from '@/lib/scraper/sources/instagram'

export async function runInstagramRunner(
  region: string
): Promise<RunnerResult> {
  try {
    const stats = await runInstagram(region)
    const runId = `instagram_${region}_${Date.now()}`
    console.log(`✅ Instagram done: saved=${stats.saved} (${region})`)
    return { runId, source: 'instagram', status: 'SUCCEEDED', region }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('❌ Instagram runner error:', msg)
    return { runId: '', source: 'instagram', status: 'FAILED', error: msg, region }
  }
}
