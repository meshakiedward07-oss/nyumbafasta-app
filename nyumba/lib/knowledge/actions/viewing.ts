// Action: Handle viewing / property visit requests from WhatsApp.
// WhatsApp users can't book a viewing autonomously — they must unlock the dalali's
// contact (Tsh 2,000) and arrange directly. We surface the most relevant listing
// and direct them to the platform.

import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'

interface ListingSnippet {
  id:            string
  title:         string
  type:          string
  price_monthly: number
  district:      string | null
  region:        string | null
}

async function findListingByHint(hint: string): Promise<ListingSnippet | null> {
  if (!hint || hint.trim().length < 3) return null

  // Try district/region/ward match first
  const { data } = await supabaseAdmin
    .from('listings')
    .select('id, title, type, price_monthly, district, region')
    .eq('status', 'active')
    .eq('is_sub_suspended', false)
    .or(`district.ilike.%${hint}%,region.ilike.%${hint}%,ward.ilike.%${hint}%,title.ilike.%${hint}%`)
    .order('is_boosted', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ?? null
}

export async function executeViewingAction(
  listingHint?: string,
): Promise<string> {
  const listing = listingHint ? await findListingByHint(listingHint) : null

  if (listing) {
    const location = [listing.district, listing.region].filter(Boolean).join(', ')
    const price    = `Tsh ${Number(listing.price_monthly).toLocaleString()}/mwezi`

    return (
      `🏠 *Kutaka Kuona Nyumba*\n\n` +
      `Nimepata nyumba inayolingana na ombi lako:\n\n` +
      `📍 *${location || listing.title}*\n` +
      `💰 ${price}\n` +
      `🔗 ${APP_URL}/listings/${listing.id}\n\n` +
      `Ili kupanga ziara na dalali:\n` +
      `1️⃣ Fungua kiungo hapo juu\n` +
      `2️⃣ Lipa *Tsh 2,000* kupata namba ya WhatsApp ya dalali\n` +
      `3️⃣ Wasiliana naye moja kwa moja kupanga wakati wa kutembelea\n\n` +
      `_Dalali atakusaidia kupanga ziara haraka iwezekanavyo!_ 😊`
    )
  }

  return (
    `🏠 *Kutaka Kuona Nyumba?*\n\n` +
    `Fuata hatua hizi kupanga ziara:\n\n` +
    `1️⃣ Tafuta nyumba unayoipenda: ${APP_URL}\n` +
    `2️⃣ Bonyeza "Wasiliana na Dalali"\n` +
    `3️⃣ Lipa *Tsh 2,000* kupata namba ya WhatsApp ya dalali\n` +
    `4️⃣ Piga simu au tuma WhatsApp kupanga ziara\n\n` +
    `Niambie mahali au aina ya nyumba unayotaka niikusaidie kupata! 🔍`
  )
}
