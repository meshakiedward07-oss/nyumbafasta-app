/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApifyClient } from 'apify-client'
import { RunnerResult } from '../types'

const client = new ApifyClient({
  token: process.env.APIFY_TOKEN
})

export async function runTiktokRunner(
  region: string
): Promise<RunnerResult> {
  try {
    const run = await client.actor('clockworks/free-tiktok-scraper').start({
      hashtags: [
        'nyumbatz',
        'tanzaniarealestate',
        'mdalali',
        `nyumba${region.toLowerCase().replace(' ', '')}`
      ],
      resultsPerPage: 20,
      maxProfilesPerQuery: 10,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false
    })

    return {
      runId: run.id,
      source: 'tiktok',
      status: run.status
    }
  } catch (err: any) {
    return {
      runId: '',
      source: 'tiktok',
      status: 'FAILED',
      error: err.message
    }
  }
}
