import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { watermarkImage } from '@/lib/media/watermark'
import type { Listing } from '@/lib/types/database'

const GRAPH      = 'https://graph.facebook.com/v21.0'
const fbToken    = () => process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? process.env.FACEBOOK_ACCESS_TOKEN ?? ''
// Catalog API requires a System User token with catalog_management permission.
// Set FACEBOOK_SYSTEM_USER_TOKEN in Vercel env vars (separate from the Page Access Token).
const catalogToken = () => process.env.FACEBOOK_SYSTEM_USER_TOKEN ?? fbToken()
const catalogId  = () => process.env.FACEBOOK_CATALOG_ID ?? ''

// ── Types ─────────────────────────────────────────────────────────────────

interface MarketplaceItem {
  id:                       string
  name:                     string   // Facebook Home Listings requires 'name', not 'title'
  description:              string
  price:                    number   // integer in TZS
  currency:                 'TZS'
  availability:             'IN_STOCK' | 'OUT_OF_STOCK'
  condition:                'NEW' | 'GOOD'
  image_url:                string
  additional_image_urls?:   string[]
  category:                 'HOME_LISTINGS'
  url:                      string
  home_listing_id:          string
  listing_type:             string
  property_type:            string
  num_rooms:                number
  num_bathrooms:            number
  address:                  string
}

export interface MarketplaceResult {
  success:     boolean
  itemId?:     string
  retailerId?: string
  error?:      string
}

// ── Create Marketplace Item ────────────────────────────────────────────────

export async function createMarketplaceItem(
  item: MarketplaceItem,
): Promise<MarketplaceResult> {
  const cid = catalogId()
  if (!cid) {
    return { success: false, error: 'FACEBOOK_CATALOG_ID haijawekwa kwenye env vars' }
  }

  try {
    console.log('[Marketplace] Creating item:', item.id)
    const res = await fetch(`${GRAPH}/${cid}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item, access_token: catalogToken() }),
    })
    const data = await res.json() as { id?: string; error?: { message: string } }

    if (data.error) {
      console.error('[Marketplace] Create error:', data.error.message)
      return { success: false, error: data.error.message }
    }

    console.log('[Marketplace] Item created:', data.id)
    return { success: true, itemId: data.id, retailerId: item.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Marketplace] Create exception:', msg)
    return { success: false, error: msg }
  }
}

// ── Update Marketplace Item ────────────────────────────────────────────────

export async function updateMarketplaceItem(
  retailerId: string,
  updates: Partial<MarketplaceItem>,
): Promise<MarketplaceResult> {
  const cid = catalogId()
  if (!cid) return { success: false, error: 'FACEBOOK_CATALOG_ID haijawekwa' }

  try {
    console.log('[Marketplace] Updating item:', retailerId)
    const res = await fetch(`${GRAPH}/${cid}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: retailerId, ...updates, access_token: catalogToken() }),
    })
    const data = await res.json() as { id?: string; error?: { message: string } }
    if (data.error) return { success: false, error: data.error.message }
    return { success: true, itemId: retailerId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

// ── Mark as Sold/Taken ─────────────────────────────────────────────────────

export async function markMarketplaceItemTaken(retailerId: string): Promise<MarketplaceResult> {
  return updateMarketplaceItem(retailerId, { availability: 'OUT_OF_STOCK' })
}

// ── Delete from Marketplace ────────────────────────────────────────────────

export async function deleteMarketplaceItem(retailerId: string): Promise<MarketplaceResult> {
  const cid = catalogId()
  if (!cid) return { success: false, error: 'FACEBOOK_CATALOG_ID haijawekwa' }

  try {
    console.log('[Marketplace] Deleting item:', retailerId)
    const res = await fetch(`${GRAPH}/${cid}/items`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: retailerId, access_token: catalogToken() }),
    })
    const data = await res.json() as { success?: boolean; error?: { message: string } }
    if (data.error) return { success: false, error: data.error.message }
    return { success: true, itemId: retailerId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

// ── Post Single Listing to Marketplace ────────────────────────────────────

export async function postListingToMarketplace(
  listing: Listing,
): Promise<MarketplaceResult> {
  const cid = catalogId()
  if (!cid) {
    return { success: false, error: 'FACEBOOK_CATALOG_ID haijawekwa kwenye env vars' }
  }

  // Skip if no images
  const rawImageUrl = listing.images?.[0]
  if (!rawImageUrl) {
    return { success: false, error: 'Listing haina picha — Marketplace inahitaji picha' }
  }

  // Watermark primary image — best-effort (proceed even if watermark fails)
  let finalImageUrl = rawImageUrl
  try {
    const watermarked = await watermarkImage(rawImageUrl, 'bottom-right')
    if (watermarked && watermarked !== rawImageUrl) {
      finalImageUrl = watermarked
    } else {
      console.warn('[Marketplace] Watermark ilikuwa sawa na asili au ilishindwa — inatumia picha asili')
    }
  } catch (e) {
    console.warn('[Marketplace] Watermark ilishindwa — inaendelea na picha asili:', e)
  }

  const retailerId   = `nyf_${listing.id.replace(/-/g, '')}`
  const isRental     = listing.type !== 'nyumba'
  const propertyType = mapPropertyType(listing.type)

  const item: MarketplaceItem = {
    id:                     retailerId,
    name:                   formatTitle(listing),
    description:            formatDescription(listing),
    price:                  listing.price_monthly,
    currency:               'TZS',
    availability:           'IN_STOCK',
    condition:              isRental ? 'NEW' : 'GOOD',
    image_url:              finalImageUrl,
    additional_image_urls:  listing.images.slice(1, 10).filter(Boolean),
    category:               'HOME_LISTINGS',
    url:                    `https://nyumbafasta.co/listings/${listing.id}`,
    home_listing_id:        retailerId,
    listing_type:           isRental ? 'FOR_RENT' : 'FOR_SALE',
    property_type:          propertyType,
    num_rooms:              listing.bedrooms ?? 1,
    num_bathrooms:          1,
    address:                JSON.stringify({
      city:    listing.district,
      country: 'TZ',
      region:  listing.region,
      street:  listing.street || '',
    }),
  }

  const result = await createMarketplaceItem(item)

  // Save record to DB regardless of result
  await supabaseAdmin.from('marketplace_listings').upsert({
    listing_id:          listing.id,
    catalog_id:          cid,
    marketplace_item_id: result.itemId ?? null,
    retailer_id:         retailerId,
    status:              result.success ? 'active' : 'failed',
    availability:        'IN_STOCK',
    price_tzs:           listing.price_monthly,
    title:               item.name,
    description:         item.description,
    image_urls:          [finalImageUrl, ...listing.images.slice(1)].filter(Boolean),
    property_type:       propertyType,
    listing_type:        item.listing_type,
    location:            `${listing.district}, ${listing.region}`,
    error_message:       result.error ?? null,
    posted_at:           result.success ? new Date().toISOString() : null,
    expires_at:          result.success
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null,
    updated_at:          new Date().toISOString(),
  }, { onConflict: 'retailer_id' })

  // Update listings table flags
  if (result.success) {
    await supabaseAdmin
      .from('listings')
      .update({
        marketplace_posted:    true,
        marketplace_item_id:   result.itemId,
        marketplace_posted_at: new Date().toISOString(),
      })
      .eq('id', listing.id)

    console.log(`[Marketplace] ✅ Posted listing ${listing.id} → item ${result.itemId}`)
  } else {
    console.error(`[Marketplace] ❌ Failed listing ${listing.id}: ${result.error}`)
  }

  return result
}

// ── Sync All Unposted Active Listings ─────────────────────────────────────

export async function syncAllListingsToMarketplace(): Promise<{
  posted:  number
  failed:  number
  skipped: number
}> {
  if (!catalogId()) {
    console.log('[Marketplace] FACEBOOK_CATALOG_ID haijawekwa — sync skipped')
    return { posted: 0, failed: 0, skipped: 0 }
  }

  const { data: listings } = await supabaseAdmin
    .from('listings')
    .select('*')
    .eq('status', 'active')
    .or('marketplace_posted.is.null,marketplace_posted.eq.false')
    .not('images', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!listings?.length) {
    console.log('[Marketplace] Hakuna listings mpya za kusync')
    return { posted: 0, failed: 0, skipped: 0 }
  }

  console.log('[Marketplace] Syncing', listings.length, 'listings')
  let posted = 0, failed = 0, skipped = 0

  for (const listing of listings) {
    if (!listing.images?.length) { skipped++; continue }

    const result = await postListingToMarketplace(listing as Listing)
    if (result.success) posted++
    else failed++

    await new Promise(r => setTimeout(r, 2000))
  }

  console.log(`[Marketplace] Sync imekamilika — Posted: ${posted}, Failed: ${failed}, Skipped: ${skipped}`)
  return { posted, failed, skipped }
}

// ── Renew Listings Expiring in Next 3 Days ────────────────────────────────

export async function renewExpiringListings(): Promise<void> {
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()

  const { data: expiring } = await supabaseAdmin
    .from('marketplace_listings')
    .select('*, listings(*)')
    .eq('status', 'active')
    .lte('expires_at', threeDaysFromNow)

  if (!expiring?.length) return
  console.log('[Marketplace] Renewing', expiring.length, 'expiring listings')

  for (const item of expiring) {
    if (item.retailer_id) {
      await deleteMarketplaceItem(item.retailer_id)
      // Reset flag so sync picks it up again
      await supabaseAdmin
        .from('listings')
        .update({ marketplace_posted: false, marketplace_item_id: null, marketplace_posted_at: null })
        .eq('id', item.listing_id)
      await supabaseAdmin
        .from('marketplace_listings')
        .update({ status: 'expired' })
        .eq('id', item.id)
    }
    await new Promise(r => setTimeout(r, 1000))
  }
}

// ── Validate Marketplace Token ────────────────────────────────────────────

export async function validateMarketplaceToken(): Promise<{ valid: boolean; error?: string }> {
  const token = catalogToken()
  const cid   = catalogId()
  if (!token) return { valid: false, error: 'FACEBOOK_SYSTEM_USER_TOKEN (au FACEBOOK_PAGE_ACCESS_TOKEN) haijawekwa kwenye Vercel env vars' }
  if (!cid)   return { valid: false, error: 'FACEBOOK_CATALOG_ID haijawekwa kwenye Vercel env vars' }
  try {
    const res  = await fetch(`${GRAPH}/${cid}?fields=id,name&access_token=${token}`)
    const data = await res.json() as { id?: string; name?: string; error?: { message: string; code?: number } }
    if (data.error) {
      return {
        valid: false,
        error: `Token imeshindwa: ${data.error.message}. Nenda Meta Business Suite → Settings → System Users → tengeneza token mpya yenye catalog_management permission → weka kwenye Vercel env var FACEBOOK_SYSTEM_USER_TOKEN.`,
      }
    }
    return { valid: true }
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Hitilafu ya mtandao — angalia connection' }
  }
}

// ── Repost a Listing (reset + re-post) ────────────────────────────────────

export async function repostListingToMarketplace(
  listingId: string,
): Promise<MarketplaceResult> {
  const { data: listing } = await supabaseAdmin
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .single()

  if (!listing) return { success: false, error: 'Listing haipatikani' }

  const tokenCheck = await validateMarketplaceToken()
  if (!tokenCheck.valid) return { success: false, error: tokenCheck.error }

  // Reset the posted flags so postListingToMarketplace treats this as a fresh post
  await supabaseAdmin
    .from('listings')
    .update({ marketplace_posted: false, marketplace_item_id: null, marketplace_posted_at: null })
    .eq('id', listingId)

  await supabaseAdmin
    .from('marketplace_listings')
    .update({ status: 'expired' })
    .eq('listing_id', listingId)

  return postListingToMarketplace(listing as Listing)
}

// ── Get Marketplace Stats ──────────────────────────────────────────────────

export async function getMarketplaceStats() {
  try {
    const { data: rows, error: rowsErr } = await supabaseAdmin
      .from('marketplace_listings')
      .select('status, views, inquiries')

    if (rowsErr) console.error('[Marketplace] stats query error:', rowsErr.message)

    const totalActive    = rows?.filter(r => r.status === 'active').length ?? 0
    const totalPosted    = rows?.length ?? 0
    const totalFailed    = rows?.filter(r => r.status === 'failed').length ?? 0
    const totalViews     = rows?.reduce((s, r) => s + (r.views ?? 0), 0) ?? 0
    const totalInquiries = rows?.reduce((s, r) => s + (r.inquiries ?? 0), 0) ?? 0

    const { data: recentListings } = await supabaseAdmin
      .from('marketplace_listings')
      .select('*, listings(title, district, region, images)')
      .order('created_at', { ascending: false })
      .limit(20)

    return { totalActive, totalPosted, totalFailed, totalViews, totalInquiries, recentListings: recentListings ?? [] }
  } catch (err) {
    console.error('[Marketplace] getMarketplaceStats exception:', err)
    return { totalActive: 0, totalPosted: 0, totalFailed: 0, totalViews: 0, totalInquiries: 0, recentListings: [] }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTitle(l: Listing): string {
  const action = l.type === 'nyumba' ? 'Inauzwa' : 'Inapangishwa'
  const price  = l.price_monthly.toLocaleString('sw-TZ')
  return `${action} — ${l.title} | TZS ${price}`.slice(0, 100)
}

function formatDescription(l: Listing): string {
  const action  = l.type === 'nyumba' ? 'Inauzwa' : 'Inapangishwa'
  const price   = l.price_monthly.toLocaleString('sw-TZ')
  const suffix  = l.type !== 'nyumba' ? '/mwezi' : ''
  const amenities = l.amenities?.slice(0, 5).join(', ') || ''

  return `🏠 ${action}

📍 Mahali: ${l.district}, ${l.region}${l.street ? ` — ${l.street}` : ''}
💰 Bei: TZS ${price}${suffix}
🛏️ Vyumba: ${l.bedrooms ?? 'N/A'}
${l.furnished === 'furnished' ? '✅ Samani zote ziko' : l.furnished === 'semi' ? '✅ Semi-furnished' : ''}
${amenities ? `✨ ${amenities}` : ''}
${l.description ? `\n${l.description}` : ''}

✅ Orodha hii imethibitishwa na NyumbaFasta
🌐 Maelezo kamili: nyumbafasta.co/listings/${l.id}
💬 Wasiliana nasi kwa WhatsApp kwa maelezo zaidi

NyumbaFasta — Haraka & Kwa Uhakika 🏠`.trim().slice(0, 5000)
}

function mapPropertyType(type: string): string {
  const map: Record<string, string> = {
    chumba:    'APARTMENT',
    apartment: 'APARTMENT',
    nyumba:    'HOUSE',
    studio:    'APARTMENT',
    duka:      'APARTMENT',
  }
  return map[type] ?? 'APARTMENT'
}
