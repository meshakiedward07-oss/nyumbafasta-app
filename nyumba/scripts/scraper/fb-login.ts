import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

async function saveFbSession() {
  console.log('\n🤖 NyumbaFasta — Facebook Login')
  console.log('='.repeat(40))

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  })

  const context = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  })

  const page = await context.newPage()

  console.log('\n⏳ Inafungua Facebook...')
  await page.goto('https://www.facebook.com', {
    waitUntil: 'domcontentloaded'
  })

  console.log('\n📋 MAELEKEZO:')
  console.log('1. Login Facebook kwenye browser iliyofunguka')
  console.log('2. Hakikisha umeingia vizuri')
  console.log('3. Script itahifadhi session automatically')
  console.log('4. USIFUNGE browser — subiri hadi ijiclose yenyewe')
  console.log('\n⏳ Inasubiri ulogin...')

  try {
    await page.waitForURL(
      url =>
        url.href.includes('facebook.com') &&
        !url.href.includes('login') &&
        !url.href.includes('checkpoint'),
      { timeout: 180000 }
    )

    console.log('\n✅ Login imefanikiwa!')

    await page.waitForTimeout(3000)

    const cookies = await context.cookies()
    const storageState = await context.storageState()

    const configDir = path.join(process.cwd(), 'lib/scraper/config')
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }

    const cookiePath = path.join(configDir, 'fb-cookies.json')
    fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2))

    const statePath = path.join(configDir, 'fb-state.json')
    fs.writeFileSync(statePath, JSON.stringify(storageState, null, 2))

    console.log(`\n✅ Session imehifadhiwa!`)
    console.log(`📁 Cookies: ${cookiePath}`)
    console.log(`📁 State: ${statePath}`)
    console.log(`🍪 Cookies: ${cookies.length}`)
    console.log(`\n⏰ Session itadumu wiki 2-4`)
    console.log('💡 Rudia script hii cookies zikisha\n')

  } catch (err: any) {
    if (err.message.includes('timeout')) {
      console.log('\n❌ Muda wa kulogin umekwisha (dakika 3)')
      console.log('   Jaribu tena na ulogin haraka zaidi')
    } else {
      console.log('\n❌ Error:', err.message)
    }
  } finally {
    await browser.close()
  }
}

saveFbSession().catch(console.error)
