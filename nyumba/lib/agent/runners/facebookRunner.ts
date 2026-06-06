import { RunnerResult } from '../types'
import { runFacebookGroups } from '@/lib/scraper/sources/facebookGroups'
import { runFacebookGraph } from '@/lib/scraper/sources/facebookGraph'
import { hasFacebookSession } from '@/lib/scraper/utils/browser'

export async function runFacebookGroupsRunner(region: string): Promise<RunnerResult> {
  try {
    // Authenticated scraper first (needs fb-cookies.json) → fallback to Graph API
    const stats = hasFacebookSession()
      ? await runFacebookGroups(region)
      : await runFacebookGraph(region, 'facebook_groups')

    const runId = `facebook_groups_${region}_${Date.now()}`
    console.log(`✅ Facebook Groups done: saved=${stats.saved} (${region})`)
    return { runId, source: 'facebook_groups', status: 'SUCCEEDED', region }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('❌ Facebook Groups runner error:', msg)
    return { runId: '', source: 'facebook_groups', status: 'FAILED', error: msg, region }
  }
}

export async function runFacebookPagesRunner(region: string): Promise<RunnerResult> {
  try {
    const stats = await runFacebookGraph(region, 'facebook_pages')
    const runId = `facebook_pages_${region}_${Date.now()}`
    console.log(`✅ Facebook Pages done: saved=${stats.saved} (${region})`)
    return { runId, source: 'facebook_pages', status: 'SUCCEEDED', region }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('❌ Facebook Pages runner error:', msg)
    return { runId: '', source: 'facebook_pages', status: 'FAILED', error: msg, region }
  }
}
