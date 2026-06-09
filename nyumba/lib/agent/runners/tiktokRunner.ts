import { RunnerResult } from '../types'
import { runTikTok } from '@/lib/scraper/sources/tiktok'

export async function runTiktokRunner(
  region: string
): Promise<RunnerResult> {
  try {
    const stats = await runTikTok(region)
    const runId = `tiktok_${region}_${Date.now()}`
    return { runId, source: 'tiktok', status: 'SUCCEEDED', region, saved: stats.saved }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('❌ TikTok runner error:', msg)
    return { runId: '', source: 'tiktok', status: 'FAILED', error: msg, region }
  }
}
