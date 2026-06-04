import { RunnerResult } from '../types'
import { runFacebook } from '@/lib/scraper/sources/facebook'

export async function runFacebookGroupsRunner(): Promise<RunnerResult> {
  try {
    const stats = await runFacebook('Dar es Salaam')
    const runId = `facebook_groups_${Date.now()}`
    console.log(`✅ Facebook Groups done: saved=${stats.saved}`)
    return { runId, source: 'facebook_groups', status: 'SUCCEEDED' }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('❌ Facebook Groups runner error:', msg)
    return { runId: '', source: 'facebook_groups', status: 'FAILED', error: msg }
  }
}

export async function runFacebookPagesRunner(
  region: string
): Promise<RunnerResult> {
  try {
    const stats = await runFacebook(region)
    const runId = `facebook_pages_${region}_${Date.now()}`
    console.log(`✅ Facebook Pages done: saved=${stats.saved} (${region})`)
    return { runId, source: 'facebook_pages', status: 'SUCCEEDED', region }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('❌ Facebook Pages runner error:', msg)
    return { runId: '', source: 'facebook_pages', status: 'FAILED', error: msg, region }
  }
}
