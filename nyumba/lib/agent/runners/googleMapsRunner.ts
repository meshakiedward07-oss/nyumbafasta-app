/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApifyClient } from 'apify-client'
import { RunnerResult } from '../types'

const client = new ApifyClient({
  token: process.env.APIFY_TOKEN
})

export async function runGoogleMapsRunner(
  region: string
): Promise<RunnerResult> {
  try {
    const searchQueries = [
      `real estate agent ${region} Tanzania`,
      `mdalali wa nyumba ${region}`,
      `property agency ${region} Tanzania`,
      `nyumba inapangishwa ${region}`,
      `house for rent ${region} Tanzania`
    ]

    const run = await client.actor('compass/crawler-google-places').start({
      searchStringsArray: searchQueries,
      locationQuery: `${region}, Tanzania`,
      maxCrawledPlacesPerSearch: 20,
      language: 'en',
      maxImages: 0,
      exportPlaceUrls: false,
      additionalInfo: true,
      reviewsSort: 'newest',
      maxReviews: 0
    })

    return {
      runId: run.id,
      source: 'google_maps',
      status: run.status
    }
  } catch (err: any) {
    console.error('Google Maps runner error:', err)
    return {
      runId: '',
      source: 'google_maps',
      status: 'FAILED',
      error: err.message
    }
  }
}
