import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { runScraper } from '../../lib/scraper'
import {
  PRIORITY_REGIONS,
  SECONDARY_REGIONS,
  TERTIARY_REGIONS
} from '../../lib/agent/regions'

async function runScheduled() {
  const now = new Date()
  const hour = now.getHours()
  const dayOfWeek = now.getDay()

  console.log(`\n⏰ Scheduled run: ${now.toISOString()}`)

  // Kila siku saa 6 AM — Google Maps priority regions
  if (hour === 6) {
    console.log('🌅 Daily run — Google Maps priority regions')
    for (const region of PRIORITY_REGIONS) {
      await runScraper(region, ['google'])
      await new Promise(r => setTimeout(r, 30000))
    }
  }

  // Jumatatu saa 8 AM — Facebook priority regions
  if (dayOfWeek === 1 && hour === 8) {
    console.log('📘 Monday — Facebook priority regions')
    for (const region of PRIORITY_REGIONS) {
      await runScraper(region, ['facebook'])
      await new Promise(r => setTimeout(r, 60000))
    }
  }

  // Jumanne saa 8 AM — Instagram priority regions
  if (dayOfWeek === 2 && hour === 8) {
    console.log('📷 Tuesday — Instagram priority regions')
    for (const region of PRIORITY_REGIONS) {
      await runScraper(region, ['instagram'])
      await new Promise(r => setTimeout(r, 60000))
    }
  }

  // Jumatano saa 8 AM — TikTok priority regions
  if (dayOfWeek === 3 && hour === 8) {
    console.log('🎵 Wednesday — TikTok priority regions')
    for (const region of PRIORITY_REGIONS) {
      await runScraper(region, ['tiktok'])
      await new Promise(r => setTimeout(r, 60000))
    }
  }

  // Alhamisi saa 8 AM — All sources secondary regions
  if (dayOfWeek === 4 && hour === 8) {
    console.log('🔄 Thursday — All sources secondary regions')
    for (const region of SECONDARY_REGIONS) {
      await runScraper(region, ['all'])
      await new Promise(r => setTimeout(r, 120000))
    }
  }

  // Jumamosi — Full scan mikoa yote
  if (dayOfWeek === 6 && hour === 7) {
    console.log('🌍 Saturday — Full scan all regions')
    const allRegions = [
      ...PRIORITY_REGIONS,
      ...SECONDARY_REGIONS,
      ...TERTIARY_REGIONS
    ]
    for (const region of allRegions) {
      await runScraper(region, ['google'])
      await new Promise(r => setTimeout(r, 60000))
    }
  }
}

async function startScheduler() {
  console.log('🤖 NyumbaFasta Scraper Scheduler imeanza')
  console.log('⏰ Inangoja saa inayofuata...')

  await runScheduled()

  setInterval(async () => {
    await runScheduled()
  }, 60 * 60 * 1000)
}

startScheduler().catch(console.error)
