/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApifyClient } from 'apify-client'
import { RunnerResult } from '../types'

export async function runInstagramRunner(
  region: string
): Promise<RunnerResult> {
  try {
    if (!process.env.APIFY_TOKEN) {
      throw new Error('APIFY_TOKEN haipo kwenye environment variables')
    }

    const client = new ApifyClient({ token: process.env.APIFY_TOKEN })
    const regionSlug = region.toLowerCase().replace(/\s+/g, '')

    const run = await client.actor('apify/instagram-hashtag-scraper').start({
      hashtags: [
        'nyumbatz',
        'realestatetanzania',
        `mdalali${regionSlug}`,
        'nyumbainapangishwa',
        'tanzaniarealestate',
        `nyumbaipangishwa${regionSlug}`
      ],
      resultsLimit: 30
    })

    console.log(`✅ Instagram run started: ${run.id} (${region})`)
    return { runId: run.id, source: 'instagram', status: run.status }

  } catch (err: any) {
    console.error('❌ Instagram runner error:', err.message)
    return {
      runId: '',
      source: 'instagram',
      status: 'FAILED',
      error: err.message
    }
  }
}
