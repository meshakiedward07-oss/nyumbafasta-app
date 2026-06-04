/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApifyClient } from 'apify-client'
import { RunnerResult } from '../types'

export async function runInstagramRunner(
  region: string,
  webhookUrl?: string
): Promise<RunnerResult> {
  try {
    if (!process.env.APIFY_TOKEN) {
      throw new Error('APIFY_TOKEN haipo kwenye environment variables')
    }

    const client = new ApifyClient({ token: process.env.APIFY_TOKEN })
    const regionSlug = region.toLowerCase().replace(/\s+/g, '')

    const input = {
      hashtags: [
        'nyumbatz',
        'realestatetanzania',
        `mdalali${regionSlug}`,
        'nyumbainapangishwa',
        'tanzaniarealestate',
        `nyumbaipangishwa${regionSlug}`
      ],
      resultsLimit: 30
    }

    const options: any = {}
    if (webhookUrl) {
      options.webhooks = [{
        eventTypes: ['ACTOR.RUN.SUCCEEDED'],
        requestUrl: webhookUrl,
        payloadTemplate: JSON.stringify({
          runId: '{{runId}}',
          source: 'instagram',
          region,
          secret: process.env.WEBHOOK_SECRET
        })
      }]
    }

    const run = await client.actor('apify/instagram-hashtag-scraper').start(input, options)

    console.log(`✅ Instagram run started: ${run.id} (${region})`)
    return { runId: run.id, source: 'instagram', status: run.status, region }

  } catch (err: any) {
    console.error('❌ Instagram runner error:', err.message)
    return { runId: '', source: 'instagram', status: 'FAILED', error: err.message, region }
  }
}
