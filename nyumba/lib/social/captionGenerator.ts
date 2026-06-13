import Anthropic from '@anthropic-ai/sdk'
import type { Listing } from '@/lib/types/database'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const IG_HASHTAGS = `#NyumbaFasta #NyumbaTanzania #ChumbaKwenye #KupataNyumba #HouseForRent #TanzaniaRealEstate #DarEsSalaam #NyumbaZuri #MalikiBora #Dalali`

const SYSTEM_PROMPT = `Wewe ni mtaalamu wa kuandika maandishi ya kuvutia kwenye Instagram na Facebook kwa ajili ya NyumbaFasta — platform ya kupanga nyumba Tanzania.

KANUNI ZA MAANDISHI:
- Andika kwa Kiswahili cha Dar es Salaam (sawa, poa, shwari, noma)
- Iwe ya kuvutia, ya kweli, na inayosababisha watu kutaka kupiga simu au kuwasiliana
- Tumia emoji kwa kiasi — siyo nyingi sana
- Anza na sentensi ya kuvutia inayofanya mtu asimame kusoma
- Elezea mahali (mtaa/wilaya), bei, na vipengele muhimu kwa lugha ya kawaida
- Mwisho lazima kuwe na Call-To-Action (CTA) wazi — link kwenye bio au namba ya WhatsApp
- Usiandike "kutoka" au lugha rasmi — andika kama rafiki anayeshirikiana habari nzuri
- Usiandike maneno ya uongo au ahadi zisizo za kweli`

type Platform = 'instagram' | 'facebook'

export async function generateCaption(
  listing: Listing,
  platform: Platform = 'instagram',
): Promise<{ caption: string; hashtags: string }> {
  const maxLen = platform === 'instagram' ? 2000 : 5000

  const amenitiesStr = listing.amenities?.length
    ? listing.amenities.slice(0, 6).join(', ')
    : 'Maelezo hayajaongezwa'

  const bedroomsStr = listing.bedrooms
    ? `${listing.bedrooms} chumba cha kulala`
    : ''

  const prompt = `Nitengenezee caption ya ${platform === 'instagram' ? 'Instagram' : 'Facebook'} kwa listing hii ya nyumba:

**Aina:** ${listing.type}
**Eneo:** ${listing.district}, ${listing.region}
**Mtaa:** ${listing.street || 'Karibu na barabara kuu'}
**Bei ya kila mwezi:** Tsh ${listing.price_monthly.toLocaleString()}
**Samani:** ${listing.furnished === 'furnished' ? 'Imejengwa (Furnished)' : listing.furnished === 'semi' ? 'Semi-furnished' : 'Haijakaliwa (Empty)'}
${bedroomsStr ? `**Vyumba:** ${bedroomsStr}` : ''}
${listing.deposit_months ? `**Deposit:** Miezi ${listing.deposit_months}` : ''}
**Vifaa/Huduma:** ${amenitiesStr}
${listing.description ? `**Maelezo ya Ziada:** ${listing.description}` : ''}

Tengeneza caption ya ${platform === 'instagram' ? 'Instagram (max 2000 herufi)' : 'Facebook (max 4000 herufi)'} inayovutia.
Mwisho wa caption ongeza: "📍 Link kwenye bio | 📲 Wasiliana nasi WhatsApp"
Hashtags zitakuja tofauti, USIWEKE kwenye caption.
Jibu kwa caption TU, bila maelezo mengine.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawCaption = (response.content[0] as { type: 'text'; text: string }).text.trim()
  const caption = rawCaption.slice(0, maxLen)

  const hashtags = platform === 'instagram' ? buildHashtags(listing) : buildFBHashtags(listing)

  return { caption, hashtags }
}

function buildHashtags(listing: Listing): string {
  const locationTags = [
    `#${listing.district.replace(/\s+/g, '')}`,
    `#${listing.region.replace(/\s+/g, '')}`,
  ].join(' ')

  const typeTags: Record<string, string> = {
    chumba:    '#ChumaKwenye #Chumba',
    apartment: '#Apartment #Fleti',
    nyumba:    '#Nyumba #House',
    studio:    '#Studio #StudioFlat',
  }

  return `${IG_HASHTAGS} ${locationTags} ${typeTags[listing.type] ?? ''} #NyumbaYaKupanga`.trim()
}

function buildFBHashtags(listing: Listing): string {
  return `#NyumbaFasta #${listing.district.replace(/\s+/g, '')} #NyumbaTanzania`.trim()
}
