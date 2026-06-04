/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApifyClient } from 'apify-client'
import { RunnerResult } from '../types'

const client = new ApifyClient({
  token: process.env.APIFY_TOKEN
})

export async function runGoogleBusinessRunner(
  region: string
): Promise<RunnerResult> {
  try {
    const run = await client.actor('apify/google-search-scraper').start({
      queries: [
        `site:business.google.com real estate ${region} Tanzania`,
        `"real estate" "${region}" Tanzania phone`,
        `mdalali nyumba ${region} Tanzania contact`
      ],
      maxPagesPerQuery: 3,
      resultsPerPage: 10
    })

    return {
      runId: run.id,
      source: 'google_business',
      status: run.status
    }
  } catch (err: any) {
    return {
      runId: '',
      source: 'google_business',
      status: 'FAILED',
      error: err.message
    }
  }
}
