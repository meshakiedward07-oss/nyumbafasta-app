import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type Platform = 'whatsapp' | 'facebook' | 'instagram'
export type FlowType = 'client' | 'dalali_register' | 'dalali_listing'

export interface ChatSession {
  id: string
  platform: Platform
  platform_user_id: string
  phone?: string
  name?: string
  flow_type: FlowType
  flow_step: string
  flow_data: Record<string, unknown>
  is_active: boolean
}

// ── Session ────────────────────────────────────────────────────────────────

export async function getOrCreateSession(
  platform: Platform,
  userId: string,
  phone?: string,
  name?: string,
): Promise<ChatSession> {
  const { data: existing } = await supabaseAdmin
    .from('chat_sessions')
    .select('*')
    .eq('platform', platform)
    .eq('platform_user_id', userId)
    .single()

  if (existing) {
    await supabaseAdmin
      .from('chat_sessions')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', existing.id)
    return existing as ChatSession
  }

  const { data: newSession } = await supabaseAdmin
    .from('chat_sessions')
    .insert({
      platform,
      platform_user_id: userId,
      phone: phone ?? null,
      name: name ?? null,
      flow_type: 'client',
      flow_step: 'greeting',
      flow_data: {},
      is_active: true,
    })
    .select()
    .single()

  return newSession as ChatSession
}

export async function saveMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  mediaUrls?: string[],
) {
  await supabaseAdmin.from('chat_messages').insert({
    session_id: sessionId,
    role,
    content,
    media_urls: mediaUrls ?? [],
  })
}

export async function getHistory(sessionId: string, limit = 10) {
  const { data } = await supabaseAdmin
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []).reverse()
}

export async function updateSession(
  sessionId: string,
  updates: Partial<ChatSession>,
) {
  await supabaseAdmin.from('chat_sessions').update(updates).eq('id', sessionId)
}

// ── Intent detection ───────────────────────────────────────────────────────

export async function detectIntent(message: string): Promise<{
  intent: 'find_house' | 'register_dalali' | 'post_listing' | 'other'
  confidence: number
}> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `Chunguza ujumbe huu na tambua nia ya mtumiaji. Jibu kwa JSON tu:

Ujumbe: "${message}"

Chaguzi:
- find_house: anatafuta nyumba/chumba/apartment
- register_dalali: anataka kujisajili kama dalali/mdalali
- post_listing: dalali anataka kupost nyumba/listing
- other: kingine chochote

{"intent": "find_house|register_dalali|post_listing|other", "confidence": 0.0-1.0}`,
      }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
  } catch { /* ignore */ }
  return { intent: 'other', confidence: 0 }
}

// ── Client flow ────────────────────────────────────────────────────────────

export async function handleClientFlow(
  session: ChatSession,
  message: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _mediaUrls?: string[],
): Promise<string> {
  const data = session.flow_data

  switch (session.flow_step) {
    case 'greeting':
    case 'ask_location': {
      if (session.flow_step === 'greeting') {
        await updateSession(session.id, { flow_step: 'ask_location' })
        return `Habari! 👋 Karibu NyumbaFasta Tanzania! 🏠

Ninakusaidia kupata nyumba/chumba kinachokufaa.

📍 Unatafuta mtaa/eneo gani?
Mfano: Kinondoni, Mbezi Beach, Sinza, Mikocheni...`
      }
      await updateSession(session.id, {
        flow_step: 'ask_type',
        flow_data: { ...data, location: message },
      })
      return `Sawa! 📍 *${message}*

🏠 Unatafuta aina gani ya nyumba?
Jibu namba moja:
1️⃣ Chumba kimoja
2️⃣ Apartment (vyumba 2-3)
3️⃣ Nyumba nzima
4️⃣ Villa/Jumba
5️⃣ Ofisi/Biashara`
    }

    case 'ask_type': {
      const types: Record<string, string> = {
        '1': 'chumba', '2': 'apartment',
        '3': 'nyumba', '4': 'villa', '5': 'ofisi',
      }
      const type = types[message.trim()] ?? message.toLowerCase()
      await updateSession(session.id, {
        flow_step: 'ask_budget',
        flow_data: { ...data, type },
      })
      return `✅ *${type.charAt(0).toUpperCase() + type.slice(1)}*

💰 Bei unayoweza kulipa kwa mwezi?
Mfano: 150,000 au 500k au 1M

(Andika namba tu — shilingi za Tanzania)`
    }

    case 'ask_budget': {
      const budget = parseMoney(message)
      await updateSession(session.id, {
        flow_step: 'ask_bedrooms',
        flow_data: { ...data, budget },
      })
      return `💰 *Budget: Tsh ${budget.toLocaleString()}/mwezi*

🛏️ Unahitaji vyumba vingapi vya kulala?

1️⃣ Chumba 1
2️⃣ Vyumba 2
3️⃣ Vyumba 3
4️⃣ Vyumba 4+`
    }

    case 'ask_bedrooms': {
      const bedroomsMap: Record<string, number> = { '1': 1, '2': 2, '3': 3, '4': 4 }
      const bedrooms = bedroomsMap[message.trim()] ?? parseInt(message) ?? 1
      await updateSession(session.id, {
        flow_step: 'showing_results',
        flow_data: { ...data, bedrooms },
      })
      return await searchAndRespond(session.id, { ...data, bedrooms })
    }

    case 'searching':
    case 'showing_results':
    default:
      return await handleFollowUpClient(session, message)
  }
}

async function searchAndRespond(
  sessionId: string,
  requirements: Record<string, unknown>,
): Promise<string> {
  try {
    let query = supabaseAdmin
      .from('listings')
      .select('id, title, type, price_monthly, district, region, images, bedrooms')
      .eq('status', 'active')
      .order('is_boosted', { ascending: false })
      .limit(3)

    const budget = requirements.budget as number | undefined
    const bedrooms = requirements.bedrooms as number | undefined

    if (budget) query = query.lte('price_monthly', Math.floor(budget * 1.2))
    if (bedrooms) query = query.eq('bedrooms', bedrooms)

    const { data: listings } = await query
    await updateSession(sessionId, { flow_step: 'showing_results' })

    if (!listings || listings.length === 0) {
      return `😔 Samahani, hatukupata nyumba inayofanana na mahitaji yako sasa hivi.

Unataka nifanye nini?
1️⃣ Badilisha budget (ongeza kidogo)
2️⃣ Badilisha eneo
3️⃣ Niache nikuarifiwe kunapotokea mpya
4️⃣ Zungumza na agent wetu`
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
    const medals = ['🥇', '🥈', '🥉']
    let response = `🎉 Nimepata nyumba *${listings.length}* zinazofanana na mahitaji yako!\n\n`

    listings.forEach((listing, i) => {
      const l = listing as Record<string, unknown>
      response += `${medals[i] ?? '🏠'} *${l.title}*\n`
      response += `💰 Tsh ${Number(l.price_monthly).toLocaleString()}/mwezi\n`
      response += `📍 ${l.district}, ${l.region}\n`
      response += `🛏️ Vyumba: ${l.bedrooms ?? 'N/A'}\n`
      response += `🔗 ${appUrl}/listings/${l.id}\n\n`
    })

    response += `👆 Bonyeza link kuona picha kamili na mawasiliano ya dalali.\n\nUna swali lolote? Niulize! 😊`
    return response
  } catch (err) {
    console.error('Search error:', err)
    return `Samahani, kuna tatizo la kiufundi. Tafadhali tembelea ${process.env.NEXT_PUBLIC_APP_URL ?? 'nyumbafasta.co'} moja kwa moja. 🙏`
  }
}

async function handleFollowUpClient(
  session: ChatSession,
  message: string,
): Promise<string> {
  const history = await getHistory(session.id, 6)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: `Wewe ni AI assistant wa NyumbaFasta Tanzania. Unasaidia wateja kupata nyumba/vyumba. Jibu kwa Kiswahili fupi na friendly. Ikiwa mteja anaomba kuona zaidi — tuma link: ${appUrl}. Ikiwa anataka kuwasiliana na dalali — waambie wafungue link ya listing. Usiandike mengi — jibu fupi na points.`,
    messages: [
      ...history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content as string })),
      { role: 'user', content: message },
    ],
  })
  return response.content[0].type === 'text' ? response.content[0].text : 'Samahani, jaribu tena.'
}

// ── Dalali registration flow ───────────────────────────────────────────────

export async function handleDalaliRegisterFlow(
  session: ChatSession,
  message: string,
): Promise<string> {
  const data = session.flow_data
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

  switch (session.flow_step) {
    case 'greeting':
    case 'register_intro': {
      await updateSession(session.id, {
        flow_type: 'dalali_register',
        flow_step: 'ask_name',
      })
      return `Karibu! 🎉 Vizuri sana kuwa na mdalali mpya!

NyumbaFasta inakusaidia:
✅ Kupata wateja wa nyumba haraka
✅ Kupost listings zako online
✅ Kupokea malipo ya uhakika
✅ CRM ya kusimamia wateja wako

📝 Jina lako kamili ni nani?`
    }

    case 'ask_name': {
      await updateSession(session.id, {
        flow_step: 'ask_phone',
        flow_data: { ...data, full_name: message },
      })
      return `Vizuri *${message}*! 👋

📱 Nambari yako ya WhatsApp/simu?
(Itumike kwa mawasiliano na wateja)
Mfano: 0712345678`
    }

    case 'ask_phone': {
      const phone = formatTZPhone(message)
      await updateSession(session.id, {
        flow_step: 'ask_region',
        flow_data: { ...data, phone },
      })
      return `✅ Simu: *${phone}*

📍 Unafanya kazi mkoa gani hasa?
Mfano: Dar es Salaam, Arusha, Mwanza...`
    }

    case 'ask_region': {
      await updateSession(session.id, {
        flow_step: 'ask_experience',
        flow_data: { ...data, region: message },
      })
      return `📍 *${message}*

💼 Una uzoefu wa miaka mingapi kwenye biashara ya nyumba?
1️⃣ Chini ya mwaka 1
2️⃣ Miaka 1-3
3️⃣ Miaka 3-5
4️⃣ Zaidi ya miaka 5`
    }

    case 'ask_experience': {
      const expMap: Record<string, string> = {
        '1': 'Chini ya mwaka 1', '2': 'Miaka 1-3',
        '3': 'Miaka 3-5', '4': 'Zaidi ya miaka 5',
      }
      const experience = expMap[message.trim()] ?? message
      const fullName = String(data.full_name ?? '')
      const phone = String(data.phone ?? '')
      const region = String(data.region ?? '')

      await updateSession(session.id, {
        flow_step: 'confirm_register',
        flow_data: { ...data, experience },
      })

      const regUrl = `${appUrl}/register?role=dalali&name=${encodeURIComponent(fullName)}&phone=${encodeURIComponent(phone)}&region=${encodeURIComponent(region)}`

      return `✅ Asante! Hapa muhtasari wako:

👤 Jina: ${fullName}
📱 Simu: ${phone}
📍 Mkoa: ${region}
💼 Uzoefu: ${experience}

Unaweza kujisajili BURE na kupata:
✅ Listings 2 za bure
✅ Trial ya wiki 2 ya Premium
✅ Dashboard ya dalali

👇 *Bonyeza link hii kusajili:*
${regUrl}

❓ Una maswali? Niulize!`
    }

    default:
      return `Nenda hapa kujisajili: ${appUrl}/register?role=dalali\n\nKama una tatizo, tembelea ofisi yetu. 🙏`
  }
}

// ── Dalali listing flow ────────────────────────────────────────────────────

export async function handleDalaliListingFlow(
  session: ChatSession,
  message: string,
  mediaUrls?: string[],
): Promise<string> {
  const data = session.flow_data
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

  // First check if dalali has an account
  if (!data.dalali_id && session.flow_step === 'greeting') {
    if (session.phone) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id, full_name, role')
        .eq('role', 'dalali')
        .ilike('phone', `%${session.phone.replace('+', '')}%`)
        .single()

      if (user) {
        await updateSession(session.id, {
          flow_type: 'dalali_listing',
          flow_step: 'ask_listing_type',
          flow_data: { ...data, dalali_id: user.id, dalali_name: user.full_name },
        })
        return `Karibu tena *${user.full_name}*! 🎉

Ninataka kukusaidia kupost listing yako.

🏠 Ni aina gani ya nyumba unataka kupost?
1️⃣ Chumba
2️⃣ Apartment
3️⃣ Nyumba nzima
4️⃣ Villa/Jumba
5️⃣ Ofisi/Biashara`
      }
    }
    return `Habari! 👋 Ili kupost listing, unahitaji kuwa na account ya dalali.

📝 Jisajili hapa bure:
${appUrl}/register?role=dalali

Baada ya kusajili, rudi hapa uandike: "Nataka kupost listing"`
  }

  switch (session.flow_step) {
    case 'ask_listing_type': {
      const types: Record<string, string> = {
        '1': 'chumba', '2': 'apartment',
        '3': 'nyumba', '4': 'villa', '5': 'ofisi',
      }
      const type = types[message.trim()] ?? message.toLowerCase()
      await updateSession(session.id, {
        flow_step: 'ask_location',
        flow_data: { ...data, type },
      })
      return `✅ *${type}*

📍 Iko wapi? (Mkoa na mtaa/district)
Mfano: Dar es Salaam, Kinondoni`
    }

    case 'ask_location': {
      await updateSession(session.id, {
        flow_step: 'ask_price',
        flow_data: { ...data, location: message },
      })
      return `📍 *${message}*

💰 Bei ya kodi kwa mwezi ni shilingi ngapi?
Mfano: 300,000 au 500k`
    }

    case 'ask_price': {
      const price = parseMoney(message)
      await updateSession(session.id, {
        flow_step: 'ask_bedrooms',
        flow_data: { ...data, price },
      })
      return `💰 *Tsh ${price.toLocaleString()}/mwezi*

🛏️ Vyumba vya kulala ni vingapi?
(Andika namba — mfano: 1, 2, 3)`
    }

    case 'ask_bedrooms': {
      const bedrooms = parseInt(message) || 1
      await updateSession(session.id, {
        flow_step: 'ask_description',
        flow_data: { ...data, bedrooms },
      })
      return `🛏️ *Vyumba ${bedrooms}*

📝 Elezea nyumba yako kwa ufupi
(Amenities, hali ya nyumba, nk)
Mfano: "Inapangishwa na samani, maji na umeme, parking, karibu na barabara kuu"`
    }

    case 'ask_description': {
      await updateSession(session.id, {
        flow_step: 'ask_photos',
        flow_data: { ...data, description: message },
      })
      return `✅ Maelezo yamehifadhiwa!

📸 Sasa tuma picha za nyumba
(Tuma picha 3-10 — zitatumika kwenye listing)

Tuma picha moja kwa moja au zote kwa wakati mmoja`
    }

    case 'ask_photos': {
      const images = (data.images as string[]) ?? []

      if (mediaUrls && mediaUrls.length > 0) {
        const updatedImages = [...images, ...mediaUrls]
        await updateSession(session.id, {
          flow_data: { ...data, images: updatedImages },
        })

        if (updatedImages.length < 3) {
          return `✅ Picha ${updatedImages.length} zimepokelewa!

Tuma picha zaidi (unahitaji angalau 3)
Au andika "tayari" kuendelea`
        }

        await updateSession(session.id, { flow_step: 'ask_video' })
        return `✅ Picha ${updatedImages.length} zimepokelewa! Nzuri sana! 📸

🎥 Una video ya nyumba? (Optional)
Tuma video au andika "hapana" kuruka`
      }

      if (message.toLowerCase().includes('tayari') && images.length >= 3) {
        await updateSession(session.id, { flow_step: 'ask_video' })
        return `✅ Picha ${images.length} zimepokelewa!

🎥 Una video ya nyumba? (Optional)
Tuma video au andika "hapana" kuruka`
      }

      return `📸 Tuma picha za nyumba yako.
Unahitaji angalau picha 3.
Picha zilizopo: ${images.length}`
    }

    case 'ask_video': {
      const videoUrl = mediaUrls && mediaUrls.length > 0 ? mediaUrls[0] : null
      await updateSession(session.id, {
        flow_step: 'confirm_listing',
        flow_data: { ...data, video_url: videoUrl },
      })

      const canPost = await checkListingLimit(String(data.dalali_id ?? ''))
      if (!canPost.allowed) {
        await updateSession(session.id, { flow_step: 'subscription_issue' })
        return canPost.message
      }

      const loc = String(data.location ?? '')
      return `✅ Habari njema! Listing yako iko tayari!

📋 Muhtasari wa Listing:
🏠 Aina: ${data.type}
📍 Eneo: ${loc}
💰 Bei: Tsh ${Number(data.price ?? 0).toLocaleString()}/mwezi
🛏️ Vyumba: ${data.bedrooms}
📸 Picha: ${(data.images as string[] | undefined)?.length ?? 0}
🎥 Video: ${videoUrl ? '✅' : '❌'}

📝 ${data.description}

Andika "chapisha" kuthibitisha na kupost!
Au "badilisha" kubadilisha kitu.`
    }

    case 'confirm_listing': {
      const msg = message.toLowerCase()
      if (msg.includes('chapisha') || msg.includes('post') || msg.includes('ndio')) {
        return await submitListing(session, data)
      }
      if (msg.includes('badilisha')) {
        await updateSession(session.id, {
          flow_step: 'ask_listing_type',
          flow_data: { dalali_id: data.dalali_id },
        })
        return `Sawa! Tunaanza upya. 🔄

🏠 Ni aina gani ya nyumba?
1️⃣ Chumba
2️⃣ Apartment
3️⃣ Nyumba nzima
4️⃣ Villa/Jumba
5️⃣ Ofisi`
      }
      return `Andika *"chapisha"* kupost listing yako! 🚀`
    }

    default:
      return `Karibu! Andika *"listing"* kuanza kupost nyumba yako. 🏠`
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseMoney(text: string): number {
  const cleaned = text.replace(/[,\s]/g, '')
  const lower = cleaned.toLowerCase()
  if (lower.includes('m')) return Math.floor(parseFloat(lower) * 1_000_000)
  if (lower.includes('k')) return Math.floor(parseFloat(lower) * 1_000)
  return parseInt(lower.replace(/[^0-9]/g, '')) || 0
}

function formatTZPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('255')) return `+${digits}`
  if (digits.startsWith('0')) return `+255${digits.slice(1)}`
  return `+255${digits}`
}

async function checkListingLimit(
  dalaliId: string,
): Promise<{ allowed: boolean; message: string }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status')
    .eq('dalali_id', dalaliId)
    .eq('status', 'active')
    .single()

  const { count } = await supabaseAdmin
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('dalali_id', dalaliId)
    .eq('status', 'active')

  const limits: Record<string, number> = { free: 2, basic: 5, premium: 20, enterprise: 50 }
  const plan = (sub?.plan as string) ?? 'free'
  const limit = limits[plan] ?? 2
  const current = count ?? 0

  if (current >= limit) {
    return {
      allowed: false,
      message: `⚠️ Umefika kikomo cha listings ${limit} za ${plan.toUpperCase()}!

Una listings ${current}/${limit}.

Chaguzi zako:
1️⃣ Upgrade subscription
2️⃣ Futa listing ya zamani
3️⃣ Lipa listing ya ziada (Tsh 2,000)

${appUrl}/dashboard/subscription`,
    }
  }
  return { allowed: true, message: '' }
}

async function submitListing(
  session: ChatSession,
  data: Record<string, unknown>,
): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
  try {
    const loc = String(data.location ?? '')
    const parts = loc.split(',')
    const region = parts[0]?.trim() ?? 'Dar es Salaam'
    const district = parts[1]?.trim() ?? ''
    const type = String(data.type ?? 'nyumba')
    const title = `${type.charAt(0).toUpperCase() + type.slice(1)}${district ? ` - ${district}` : ''}`

    const { data: pending } = await supabaseAdmin
      .from('pending_listings')
      .insert({
        session_id: session.id,
        dalali_id: data.dalali_id,
        title,
        type,
        price_monthly: Number(data.price ?? 0),
        region,
        district,
        description: String(data.description ?? ''),
        bedrooms: Number(data.bedrooms ?? 1),
        images: (data.images as string[]) ?? [],
        video_url: (data.video_url as string | null) ?? null,
        status: 'pending',
      })
      .select()
      .single()

    if (!pending) throw new Error('Haikuweza kuhifadhi')

    const { data: listing } = await supabaseAdmin
      .from('listings')
      .insert({
        dalali_id: data.dalali_id,
        title: pending.title,
        type: pending.type,
        price_monthly: pending.price_monthly,
        region: pending.region,
        district: pending.district,
        description: pending.description,
        bedrooms: pending.bedrooms,
        images: pending.images,
        video_url: pending.video_url,
        status: 'active',
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    if (!listing) throw new Error('Haikuweza kupost')

    await supabaseAdmin
      .from('pending_listings')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', pending.id)

    await updateSession(session.id, {
      flow_step: 'greeting',
      flow_type: 'dalali_listing',
      flow_data: { dalali_id: data.dalali_id },
    })

    const l = listing as Record<string, unknown>
    return `🎉 *Hongera! Listing imechapishwa!*

✅ Nyumba yako ipo live sasa!

🔗 *Link ya listing yako:*
${appUrl}/listings/${l.id}

📊 Ona listings zako zote:
${appUrl}/dashboard/listings

Wateja wataanza kuona listing yako mara moja! 🏠

Unataka kupost nyumba nyingine? Andika "listing"`
  } catch (err) {
    console.error('Submit listing error:', err)
    return `❌ Kuna tatizo la kiufundi. Tafadhali jaribu tena au tembelea ${appUrl}/dashboard`
  }
}

// ── Main handler ───────────────────────────────────────────────────────────

export async function handleIncomingMessage(
  platform: Platform,
  userId: string,
  message: string,
  phone?: string,
  name?: string,
  mediaUrls?: string[],
): Promise<string> {
  try {
    const session = await getOrCreateSession(platform, userId, phone, name)
    await saveMessage(session.id, 'user', message, mediaUrls)

    const isReset = ['restart', 'menu', 'msaada', 'help']
      .some((w) => message.toLowerCase().includes(w))
    const isGreeting = session.flow_step === 'greeting'

    let response = ''

    if (isGreeting || isReset) {
      const intent = await detectIntent(message)
      const msg = message.toLowerCase()

      if (
        intent.intent === 'register_dalali' ||
        msg.includes('dalali') || msg.includes('agent') || msg.includes('sajili')
      ) {
        await updateSession(session.id, { flow_type: 'dalali_register', flow_step: 'register_intro' })
        response = await handleDalaliRegisterFlow(
          { ...session, flow_type: 'dalali_register', flow_step: 'register_intro' },
          message,
        )
      } else if (
        intent.intent === 'post_listing' ||
        msg.includes('post') || msg.includes('listing') || msg.includes('weka nyumba')
      ) {
        await updateSession(session.id, { flow_type: 'dalali_listing', flow_step: 'greeting' })
        response = await handleDalaliListingFlow(
          { ...session, flow_type: 'dalali_listing', flow_step: 'greeting' },
          message,
          mediaUrls,
        )
      } else {
        const step = isReset ? 'greeting' : session.flow_step
        await updateSession(session.id, { flow_type: 'client', flow_step: step })
        response = await handleClientFlow(
          { ...session, flow_type: 'client', flow_step: step },
          message,
          mediaUrls,
        )
      }
    } else {
      if (session.flow_type === 'dalali_register') {
        response = await handleDalaliRegisterFlow(session, message)
      } else if (session.flow_type === 'dalali_listing') {
        response = await handleDalaliListingFlow(session, message, mediaUrls)
      } else {
        response = await handleClientFlow(session, message, mediaUrls)
      }
    }

    await saveMessage(session.id, 'assistant', response)
    return response
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Chat handler error:', msg)
    return `[DEBUG:${msg}]`
  }
}
