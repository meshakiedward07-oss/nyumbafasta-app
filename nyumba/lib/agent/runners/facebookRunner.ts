/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApifyClient } from 'apify-client'
import { RunnerResult } from '../types'

const client = new ApifyClient({
  token: process.env.APIFY_TOKEN
})

const TZ_REAL_ESTATE_GROUPS = [
  'https://www.facebook.com/groups/nyumbatzreal',
  'https://www.facebook.com/groups/tanzaniarealestate',
  'https://www.facebook.com/groups/nyumbainapangishwa',
  'https://www.facebook.com/groups/madalaliwa nyumba'
]

export async function runFacebookGroupsRunner(): Promise<RunnerResult> {
  try {
    const run = await client.actor('apify/facebook-groups-scraper').start({
      startUrls: TZ_REAL_ESTATE_GROUPS.map(url => ({ url })),
      maxPosts: 50,
      maxPostComments: 0,
      maxReviews: 0,
      proxyConfiguration: { useApifyProxy: true }
    })

    return {
      runId: run.id,
      source: 'facebook_groups',
      status: run.status
    }
  } catch (err: any) {
    return {
      runId: '',
      source: 'facebook_groups',
      status: 'FAILED',
      error: err.message
    }
  }
}

export async function runFacebookPagesRunner(
  region: string
): Promise<RunnerResult> {
  try {
    const run = await client.actor('apify/facebook-pages-scraper').start({
      startUrls: [
        { url: `https://www.facebook.com/search/pages/?q=real estate ${region} tanzania` }
      ],
      maxPosts: 30,
      proxyConfiguration: { useApifyProxy: true }
    })

    return {
      runId: run.id,
      source: 'facebook_pages',
      status: run.status
    }
  } catch (err: any) {
    return {
      runId: '',
      source: 'facebook_pages',
      status: 'FAILED',
      error: err.message
    }
  }
}
