/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApifyClient } from 'apify-client'
import { RunnerResult } from '../types'

export async function runTiktokRunner(
  region: string
): Promise<RunnerResult> {
  try {
    if (!process.env.APIFY_TOKEN) {
      throw new Error('APIFY_TOKEN haipo kwenye environment variables')
    }

    const client = new ApifyClient({ token: process.env.APIFY_TOKEN })

    const run = await client.actor('clockworks/free-tiktok-scraper').start({
      hashtags: [
        'nyumbatz',
        'tanzaniarealestate',
        'mdalali',
        `nyumba${region.toLowerCase().replace(/\s+/g, '')}`
      ],
      resultsPerPage: 20,
      maxProfilesPerQuery: 10,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false
    })

    console.log(`✅ TikTok run started: ${run.id} (${region})`)
    return { runId: run.id, source: 'tiktok', status: run.status }

  } catch (err: any) {
    console.error('❌ TikTok runner error:', err.message)
    return {
      runId: '',
      source: 'tiktok',
      status: 'FAILED',
      error: err.message
    }
  }
}
