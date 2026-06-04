/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApifyClient } from 'apify-client'
import { RunnerResult } from '../types'

export async function runGoogleMapsRunner(
  region: string
): Promise<RunnerResult> {
  try {
    if (!process.env.APIFY_TOKEN) {
      throw new Error('APIFY_TOKEN haipo kwenye environment variables')
    }

    const client = new ApifyClient({ token: process.env.APIFY_TOKEN })

    const run = await client.actor('compass/crawler-google-places').start({
      searchStringsArray: [
        `real estate agent ${region} Tanzania`,
        `mdalali wa nyumba ${region}`,
        `property agency ${region} Tanzania`,
        `nyumba inapangishwa ${region}`,
        `house for rent ${region} Tanzania`
      ],
      locationQuery: `${region}, Tanzania`,
      maxCrawledPlacesPerSearch: 20,
      language: 'en',
      maxImages: 0,
      exportPlaceUrls: false,
      additionalInfo: true,
      reviewsSort: 'newest',
      maxReviews: 0
    })

    console.log(`✅ Google Maps run started: ${run.id} (${region})`)
    return { runId: run.id, source: 'google_maps', status: run.status }

  } catch (err: any) {
    console.error('❌ Google Maps runner error:', err.message)
    return {
      runId: '',
      source: 'google_maps',
      status: 'FAILED',
      error: err.message
    }
  }
}
