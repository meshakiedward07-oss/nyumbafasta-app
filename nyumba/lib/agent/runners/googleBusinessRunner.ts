/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApifyClient } from 'apify-client'
import { RunnerResult } from '../types'

export async function runGoogleBusinessRunner(
  region: string,
  webhookUrl?: string
): Promise<RunnerResult> {
  try {
    if (!process.env.APIFY_TOKEN) {
      throw new Error('APIFY_TOKEN haipo kwenye environment variables')
    }

    const client = new ApifyClient({ token: process.env.APIFY_TOKEN })

    const input = {
      queries: [
        `site:business.google.com real estate ${region} Tanzania`,
        `"real estate" "${region}" Tanzania phone`,
        `mdalali nyumba ${region} Tanzania contact`
      ],
      maxPagesPerQuery: 3,
      resultsPerPage: 10
    }

    const options: any = {}
    if (webhookUrl) {
      options.webhooks = [{
        eventTypes: ['ACTOR.RUN.SUCCEEDED'],
        requestUrl: webhookUrl,
        payloadTemplate: JSON.stringify({
          runId: '{{runId}}',
          source: 'google_business',
          region,
          secret: process.env.WEBHOOK_SECRET
        })
      }]
    }

    const run = await client.actor('apify/google-search-scraper').start(input, options)

    console.log(`✅ Google Business run started: ${run.id} (${region})`)
    return { runId: run.id, source: 'google_business', status: run.status, region }

  } catch (err: any) {
    console.error('❌ Google Business runner error:', err.message)
    return { runId: '', source: 'google_business', status: 'FAILED', error: err.message, region }
  }
}
