import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { runScraper, ScrapeSource } from '../../lib/scraper/index'
import { TANZANIA_REGIONS } from '../../lib/agent/regions'

async function main() {
  const args = process.argv.slice(2)
  const region = args[0] || 'Dar es Salaam'
  const sources = (args[1]?.split(',') || ['all']) as ScrapeSource[]

  if (region !== 'all' && !TANZANIA_REGIONS.includes(region)) {
    console.error(`❌ Region si sahihi: ${region}`)
    console.log(`Mikoa inayopatikana: ${TANZANIA_REGIONS.join(', ')}`)
    process.exit(1)
  }

  if (region === 'all') {
    for (const r of TANZANIA_REGIONS) {
      await runScraper(r, sources)
      await new Promise(res => setTimeout(res, 120000))
    }
  } else {
    await runScraper(region, sources)
  }
}

main().catch(console.error)
