/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApifyClient } from 'apify-client'
import { RunnerResult } from '../types'

export async function runGoogleBusinessRunner(
  region: string
): Promise<RunnerResult> {
  try {
    if (!process.env.APIFY_TOKEN) {
      throw new Error('APIFY_TOKEN haipo kwenye environment variables')
    }

    const client = new ApifyClient({ token: process.env.APIFY_TOKEN })

    const run = await client.actor('apify/google-search-scraper').start({
      queries: [
        `site:business.google.com real estate ${region} Tanzania`,
        `"real estate" "${region}" Tanzania phone`,
        `mdalali nyumba ${region} Tanzania contact`
      ],
      maxPagesPerQuery: 3,
      resultsPerPage: 10
    })

    console.log(`✅ Google Business run started: ${run.id} (${region})`)
    return { runId: run.id, source: 'google_business', status: run.status }

  } catch (err: any) {
    console.error('❌ Google Business runner error:', err.message)
    return {
      runId: '',
      source: 'google_business',
      status: 'FAILED',
      error: err.message
    }
  }
}
