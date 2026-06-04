/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApifyClient } from 'apify-client'
import { RunnerResult } from '../types'

// Facebook actors (apify/facebook-groups-scraper, apify/facebook-pages-scraper) require
// a FLAT_PRICE_PER_MONTH Apify subscription. They will fail on the FREE plan.
// We catch the payment error and return a clear FAILED result instead of crashing.

const TZ_REAL_ESTATE_GROUPS = [
  'https://www.facebook.com/groups/nyumbatzreal',
  'https://www.facebook.com/groups/tanzaniarealestate',
  'https://www.facebook.com/groups/nyumbainapangishwa',
  'https://www.facebook.com/groups/madalaliwa-nyumba'
]

export async function runFacebookGroupsRunner(
  webhookUrl?: string
): Promise<RunnerResult> {
  try {
    if (!process.env.APIFY_TOKEN) {
      throw new Error('APIFY_TOKEN haipo kwenye environment variables')
    }

    const client = new ApifyClient({ token: process.env.APIFY_TOKEN })

    const input = {
      startUrls: TZ_REAL_ESTATE_GROUPS.map(url => ({ url })),
      maxPosts: 50,
      maxPostComments: 0,
      maxReviews: 0
    }

    const options: any = {}
    if (webhookUrl) {
      options.webhooks = [{
        eventTypes: ['ACTOR.RUN.SUCCEEDED'],
        requestUrl: webhookUrl,
        payloadTemplate: JSON.stringify({
          runId: '{{runId}}',
          source: 'facebook_groups',
          secret: process.env.WEBHOOK_SECRET
        })
      }]
    }

    const run = await client.actor('apify/facebook-groups-scraper').start(input, options)

    console.log(`✅ Facebook Groups run started: ${run.id}`)
    return { runId: run.id, source: 'facebook_groups', status: run.status }

  } catch (err: any) {
    const isPaidError = err.message?.includes('subscription') ||
      err.message?.includes('payment') ||
      err.message?.includes('plan') ||
      err.statusCode === 402
    const msg = isPaidError
      ? 'Facebook Groups actor inahitaji Apify subscription ya kulipwa (FLAT_PRICE_PER_MONTH)'
      : err.message
    console.error('❌ Facebook Groups runner error:', msg)
    return { runId: '', source: 'facebook_groups', status: 'FAILED', error: msg }
  }
}

export async function runFacebookPagesRunner(
  region: string,
  webhookUrl?: string
): Promise<RunnerResult> {
  try {
    if (!process.env.APIFY_TOKEN) {
      throw new Error('APIFY_TOKEN haipo kwenye environment variables')
    }

    const client = new ApifyClient({ token: process.env.APIFY_TOKEN })

    const input = {
      startUrls: [
        { url: `https://www.facebook.com/search/pages/?q=real+estate+${encodeURIComponent(region)}+tanzania` }
      ],
      maxPosts: 30
    }

    const options: any = {}
    if (webhookUrl) {
      options.webhooks = [{
        eventTypes: ['ACTOR.RUN.SUCCEEDED'],
        requestUrl: webhookUrl,
        payloadTemplate: JSON.stringify({
          runId: '{{runId}}',
          source: 'facebook_pages',
          region,
          secret: process.env.WEBHOOK_SECRET
        })
      }]
    }

    const run = await client.actor('apify/facebook-pages-scraper').start(input, options)

    console.log(`✅ Facebook Pages run started: ${run.id} (${region})`)
    return { runId: run.id, source: 'facebook_pages', status: run.status, region }

  } catch (err: any) {
    const isPaidError = err.message?.includes('subscription') ||
      err.message?.includes('payment') ||
      err.message?.includes('plan') ||
      err.statusCode === 402
    const msg = isPaidError
      ? 'Facebook Pages actor inahitaji Apify subscription ya kulipwa (FLAT_PRICE_PER_MONTH)'
      : err.message
    console.error('❌ Facebook Pages runner error:', msg)
    return { runId: '', source: 'facebook_pages', status: 'FAILED', error: msg, region }
  }
}
