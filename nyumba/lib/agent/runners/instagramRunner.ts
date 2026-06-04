/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApifyClient } from 'apify-client'
import { RunnerResult } from '../types'

const client = new ApifyClient({
  token: process.env.APIFY_TOKEN
})

export async function runInstagramRunner(
  region: string
): Promise<RunnerResult> {
  try {
    const hashtags = [
      `nyumbatz`,
      `realestatetanzania`,
      `mdalali${region.toLowerCase().replace(' ', '')}`,
      `nyumbainapangishwa`,
      `tanzaniarealestate`,
      `nyumbaipangishwa${region.toLowerCase().replace(' ', '')}`
    ]

    const run = await client.actor('apify/instagram-hashtag-scraper').start({
      hashtags,
      resultsLimit: 30,
      proxy: { useApifyProxy: true }
    })

    return {
      runId: run.id,
      source: 'instagram',
      status: run.status
    }
  } catch (err: any) {
    return {
      runId: '',
      source: 'instagram',
      status: 'FAILED',
      error: err.message
    }
  }
}
