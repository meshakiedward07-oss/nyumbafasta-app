import { runGooglePlaces } from './sources/googlePlaces'
import { runFacebook } from './sources/facebook'
import { runFacebookGraph } from './sources/facebookGraph'
import { runFacebookGroups, runFacebookGroupsFromDB } from './sources/facebookGroups'
import { runInstagram } from './sources/instagram'
import { runTikTok } from './sources/tiktok'
import { TANZANIA_REGIONS } from '@/lib/agent/regions'

export type ScrapeSource =
  | 'google'
  | 'facebook'
  | 'facebook_graph'
  | 'facebook_groups'
  | 'instagram'
  | 'tiktok'
  | 'all'

export { runFacebookGroups, runFacebookGroupsFromDB }

export async function runScraper(
  region: string,
  sources: ScrapeSource[] = ['all']
) {
  const runAll = sources.includes('all')
  const results: Record<string, Awaited<ReturnType<typeof runGooglePlaces>>> = {}

  console.log(`\n${'='.repeat(50)}`)
  console.log(`🤖 NyumbaFasta Lead Scraper`)
  console.log(`📍 Region: ${region}`)
  console.log(`📡 Sources: ${sources.join(', ')}`)
  console.log(`${'='.repeat(50)}`)

  if (runAll || sources.includes('google')) {
    results.google = await runGooglePlaces(region)
  }

  if (runAll || sources.includes('facebook')) {
    results.facebook = await runFacebook(region)
  }

  if (sources.includes('facebook_graph')) {
    results.facebook_graph = await runFacebookGraph(region)
  }

  if (sources.includes('facebook_groups')) {
    results.facebook_groups = await runFacebookGroupsFromDB(region)
  }

  if (runAll || sources.includes('instagram')) {
    results.instagram = await runInstagram(region)
  }

  if (runAll || sources.includes('tiktok')) {
    results.tiktok = await runTikTok(region)
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`📊 MATOKEO YA ${region}:`)

  let totalSaved = 0
  let totalProcessed = 0

  Object.entries(results).forEach(([source, result]) => {
    if (result) {
      console.log(
        `  ${source}: saved=${result.saved}, ` +
        `skipped=${result.duplicates + result.low_score}, ` +
        `errors=${result.errors}`
      )
      totalSaved += result.saved || 0
      totalProcessed += result.total || 0
    }
  })

  console.log(`  ─────────────────`)
  console.log(`  JUMLA: saved=${totalSaved}/${totalProcessed}`)
  console.log(`${'='.repeat(50)}\n`)

  return { results, totalSaved, totalProcessed, region }
}

export { TANZANIA_REGIONS }
