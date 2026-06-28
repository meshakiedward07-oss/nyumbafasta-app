import Anthropic from '@anthropic-ai/sdk'
import type { Listing } from '@/lib/types/database'

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
  const maxLen   = platform === 'instagram' ? 2000 : 5000
  const hashtags = platform === 'instagram' ? buildHashtags(listing) : buildFBHashtags(listing)

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[Caption] ANTHROPIC_API_KEY haijawekwa — inatumia caption ya msingi')
    return { caption: buildFallbackCaption(listing, maxLen), hashtags }
  }

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

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response  = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: prompt }],
    })

    const block      = response.content[0]
    const rawCaption = (block?.type === 'text' ? block.text : '').trim()
    const caption    = rawCaption.slice(0, maxLen)

    return { caption, hashtags }
  } catch (err) {
    console.error('[Caption] AI generation failed — inatumia caption ya msingi:', err)
    return { caption: buildFallbackCaption(listing, maxLen), hashtags }
  }
}

function buildFallbackCaption(listing: Listing, maxLen: number): string {
  const price     = listing.price_monthly?.toLocaleString('sw-TZ') ?? '0'
  const typeMap: Record<string, string> = {
    chumba: 'Chumba', apartment: 'Apartment', nyumba: 'Nyumba', studio: 'Studio',
  }
  const type      = typeMap[listing.type] ?? 'Nyumba'
  const furnished = listing.furnished === 'furnished' ? 'Furnished ✅' : listing.furnished === 'semi' ? 'Semi-furnished 🔸' : 'Empty 📦'

  return [
    `🏠 ${type.toUpperCase()} ya kupanga inapatikana!`,
    '',
    `📍 ${listing.district}, ${listing.region}`,
    `💰 Tsh ${price}/mwezi`,
    `🪑 ${furnished}`,
    listing.bedrooms ? `🛏️ Vyumba ${listing.bedrooms}` : '',
    '',
    listing.description ? listing.description.slice(0, 200) : '',
    '',
    '📍 Link kwenye bio | 📲 Wasiliana nasi WhatsApp',
  ].filter(l => l !== undefined).join('\n').trim().slice(0, maxLen)
}

function buildHashtags(listing: Listing): string {
  const locationTags = [
    `#${listing.district.replace(/\s+/g, '')}`,
    `#${listing.region.replace(/\s+/g, '')}`,
  ].join(' ')

  const typeTags: Record<string, string> = {
    chumba:    '#ChumbaKwenye #Chumba',
    apartment: '#Apartment #Fleti',
    nyumba:    '#Nyumba #House',
    studio:    '#Studio #StudioFlat',
  }

  return `${IG_HASHTAGS} ${locationTags} ${typeTags[listing.type] ?? ''} #NyumbaYaKupanga`.trim()
}

function buildFBHashtags(listing: Listing): string {
  return `#NyumbaFasta #${listing.district.replace(/\s+/g, '')} #NyumbaTanzania`.trim()
}

// ── Video caption (not listing-based) ─────────────────────────────────────

const VIDEO_TYPE_LABELS: Record<string, string> = {
  promotion:    'Matangazo ya Biashara',
  listing_tour: 'Ziara ya Nyumba',
  announcement: 'Tangazo la Muhimu',
  testimonial:  'Ushuhuda wa Mteja',
  other:        'Nyingine',
}

export async function generateVideoCaption(params: {
  title:        string
  videoType:    string
  description?: string
}): Promise<{ instagram: string; facebook: string }> {
  const typeLabel = VIDEO_TYPE_LABELS[params.videoType] ?? params.videoType

  const prompt = `Wewe ni mtaalamu wa social media ya NyumbaFasta — real estate marketplace bora zaidi Tanzania.

Tengeneza captions mbili za kuvutia kwa Kiswahili cha Dar es Salaam kwa video hii:

Kichwa: ${params.title}
Aina: ${typeLabel}
${params.description ? `Maelezo: ${params.description}` : ''}

KANUNI:

Instagram (caption + hashtags — zote pamoja):
- Anza na sentensi moja ya nguvu na emoji
- Fupi, yenye nguvu, chini ya maneno 120
- Mwisho: "📍 Tembelea nyumbafasta.co | 📲 WhatsApp kwenye bio"
- Ongeza hashtags 20-25 mwishoni: #NyumbaFasta #NyumbaTanzania #RealEstateTanzania #DarEsSalaam #NyumbaZaPangwa #NyumbaZaUzaji #Makazi #MajengoTanzania #PropertyTanzania #TanzaniaRealEstate #Nyumba #Apartment #House #DalaliTanzania #NyumbaZuri #MalikiBora

Facebook (caption tu — hashtags 2-3 tu):
- Ndefu zaidi, ya kibinadamu (maneno 100-180)
- Zungumza kama rafiki anayeshirikiana habari nzuri
- Ongeza: "Tembelea nyumbafasta.co au tuma ujumbe"
- Hashtags 2-3 tu mwishoni

Jibu kwa JSON tu, bila markdown wala maelezo mengine:
{"instagram":"caption + hashtags hapa","facebook":"caption hapa"}`

  const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await anthropicClient.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    messages:   [{ role: 'user', content: prompt }],
  })

  const raw = (response.content[0] as { type: 'text'; text: string }).text.trim()
  try {
    const parsed = JSON.parse(raw.replace(/^```json|^```|```$/gm, '').trim()) as {
      instagram: string
      facebook:  string
    }
    return {
      instagram: (parsed.instagram ?? '').slice(0, 2200),
      facebook:  (parsed.facebook  ?? '').slice(0, 5000),
    }
  } catch {
    return { instagram: raw.slice(0, 2200), facebook: raw.slice(0, 5000) }
  }
}
