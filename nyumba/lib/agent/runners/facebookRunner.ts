/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApifyClient } from 'apify-client'
import { RunnerResult } from '../types'

const TZ_REAL_ESTATE_GROUPS = [
  'https://www.facebook.com/groups/nyumbatzreal',
  'https://www.facebook.com/groups/tanzaniarealestate',
  'https://www.facebook.com/groups/nyumbainapangishwa',
  'https://www.facebook.com/groups/madalaliwa-nyumba'
]

export async function runFacebookGroupsRunner(): Promise<RunnerResult> {
  try {
    if (!process.env.APIFY_TOKEN) {
      throw new Error('APIFY_TOKEN haipo kwenye environment variables')
    }

    const client = new ApifyClient({ token: process.env.APIFY_TOKEN })

    const run = await client.actor('apify/facebook-groups-scraper').start({
      startUrls: TZ_REAL_ESTATE_GROUPS.map(url => ({ url })),
      maxPosts: 50,
      maxPostComments: 0,
      maxReviews: 0
    })

    console.log(`✅ Facebook Groups run started: ${run.id}`)
    return { runId: run.id, source: 'facebook_groups', status: run.status }

  } catch (err: any) {
    console.error('❌ Facebook Groups runner error:', err.message)
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
    if (!process.env.APIFY_TOKEN) {
      throw new Error('APIFY_TOKEN haipo kwenye environment variables')
    }

    const client = new ApifyClient({ token: process.env.APIFY_TOKEN })

    const run = await client.actor('apify/facebook-pages-scraper').start({
      startUrls: [
        { url: `https://www.facebook.com/search/pages/?q=real+estate+${encodeURIComponent(region)}+tanzania` }
      ],
      maxPosts: 30
    })

    console.log(`✅ Facebook Pages run started: ${run.id} (${region})`)
    return { runId: run.id, source: 'facebook_pages', status: run.status }

  } catch (err: any) {
    console.error('❌ Facebook Pages runner error:', err.message)
    return {
      runId: '',
      source: 'facebook_pages',
      status: 'FAILED',
      error: err.message
    }
  }
}
