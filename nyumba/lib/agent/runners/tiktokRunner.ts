/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApifyClient } from 'apify-client'
import { RunnerResult } from '../types'

export async function runTiktokRunner(
  region: string,
  webhookUrl?: string
): Promise<RunnerResult> {
  try {
    if (!process.env.APIFY_TOKEN) {
      throw new Error('APIFY_TOKEN haipo kwenye environment variables')
    }

    const client = new ApifyClient({ token: process.env.APIFY_TOKEN })

    const input = {
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
    }

    const options: any = {}
    if (webhookUrl) {
      options.webhooks = [{
        eventTypes: ['ACTOR.RUN.SUCCEEDED'],
        requestUrl: webhookUrl,
        payloadTemplate: JSON.stringify({
          runId: '{{runId}}',
          source: 'tiktok',
          region,
          secret: process.env.WEBHOOK_SECRET
        })
      }]
    }

    const run = await client.actor('clockworks/free-tiktok-scraper').start(input, options)

    console.log(`✅ TikTok run started: ${run.id} (${region})`)
    return { runId: run.id, source: 'tiktok', status: run.status, region }

  } catch (err: any) {
    console.error('❌ TikTok runner error:', err.message)
    return { runId: '', source: 'tiktok', status: 'FAILED', error: err.message, region }
  }
}
