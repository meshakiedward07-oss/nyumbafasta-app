// Structured search: runs real DB queries against listings/vendors
// using the entities extracted from the user's message.
// Returns a WhatsApp-ready response string, or null if nothing found.

import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import type { ExtractedEntities } from '@/lib/knowledge/entities'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

// ── Listing search ────────────────────────────────────────────────────────────

interface ListingRow {
  id:            string
  title:         string
  type:          string
  price_monthly: number
  district:      string | null
  region:        string | null
  ward:          string | null
  bedrooms:      number | null
  furnished:     boolean | null
  images:        string[] | null
  dalali:        { full_name: string | null } | null
}

export async function searchListings(
  entities: ExtractedEntities,
): Promise<string | null> {
  let q = supabaseAdmin
    .from('listings')
    .select('id, title, type, price_monthly, district, region, ward, bedrooms, furnished, images, dalali:dalali_id(full_name)')
    .eq('status', 'active')
    .eq('is_sub_suspended', false)
    .order('is_boosted', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(3)

  // Location: try district first, then region (the DB has both)
  if (entities.location) {
    const loc = entities.location
    // Use OR across the text columns most likely to match a place name
    q = q.or(
      `district.ilike.%${loc}%,region.ilike.%${loc}%,ward.ilike.%${loc}%`
    )
  }

  if (entities.listing_type) q = q.eq('type', entities.listing_type)
  if (entities.bedrooms)     q = q.gte('bedrooms', entities.bedrooms)
  if (entities.price_max)    q = q.lte('price_monthly', entities.price_max)
  if (entities.price_min)    q = q.gte('price_monthly', entities.price_min)
  if (entities.furnished != null) q = q.eq('furnished', entities.furnished)

  const { data, error } = await q
  if (error) {
    console.error('[StructuredSearch] listings error:', error.message)
    return null
  }
  if (!data || data.length === 0) return null

  // Supabase returns joined rows as arrays; normalize dalali to a single object
  const rows = (data as unknown[]).map((r) => {
    const row = r as Record<string, unknown>
    const dalaliRaw = row.dalali
    row.dalali = Array.isArray(dalaliRaw) ? (dalaliRaw[0] ?? null) : dalaliRaw
    return row as unknown as ListingRow
  })
  return formatListingResults(rows, entities)
}

function formatListingResults(listings: ListingRow[], entities: ExtractedEntities): string {
  const locationLabel = entities.location ? ` huko *${entities.location}*` : ''
  const typeLabel     = entities.listing_type ? ` (${entities.listing_type})` : ''

  const header = listings.length === 1
    ? `Nimepata nyumba 1 inayolingana${locationLabel}${typeLabel}! 🏠`
    : `Nimepata nyumba ${listings.length} zinazolingana${locationLabel}${typeLabel}! 🏠`

  const nums = ['1️⃣', '2️⃣', '3️⃣']

  const items = listings.map((l, i) => {
    const price    = `Tsh ${Number(l.price_monthly).toLocaleString()}/mwezi`
    const location = [l.district ?? l.ward, l.region].filter(Boolean).join(', ')
    const beds     = l.bedrooms ? `🛏️ Vyumba ${l.bedrooms} | ` : ''
    const furn     = l.furnished ? '✅ Imekamilika | ' : ''
    const dalali   = l.dalali?.full_name ? `\n   👤 ${l.dalali.full_name}` : ''
    const link     = `${APP_URL}/listings/${l.id}`

    return `${nums[i]} *${location || l.title}*\n   ${beds}${furn}💰 ${price}${dalali}\n   🔗 ${link}`
  }).join('\n\n')

  const footer = listings.length === 3
    ? '\n\n_Niambie nambari ya chaguo lako, au badilisha eneo/bei ili nikusaidie zaidi._'
    : '\n\n_Bonyeza kiungo kuona picha na maelezo kamili._'

  return `${header}\n\n${items}${footer}`
}

// ── Vendor search (org-internal) ──────────────────────────────────────────────
// Vendors are org-scoped. For anonymous WhatsApp users we don't have org context,
// so we return null and let Amina handle it.

export async function searchVendors(
  entities:  ExtractedEntities,
  orgId?:    string,
): Promise<string | null> {
  if (!orgId) return null   // no org context for anonymous WhatsApp users

  let q = supabaseAdmin
    .from('vendors')
    .select('id, name, category, specialty, location, phone, rating_avg, jobs_completed')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('rating_avg', { ascending: false })
    .limit(3)

  if (entities.vendor_category) {
    q = q.ilike('category', `%${entities.vendor_category}%`)
  }
  if (entities.location) {
    q = q.ilike('location', `%${entities.location}%`)
  }

  const { data, error } = await q
  if (error || !data || data.length === 0) return null

  const items = data.map((v, i) => {
    const nums    = ['1️⃣', '2️⃣', '3️⃣']
    const rating  = v.rating_avg ? ` ⭐ ${v.rating_avg}` : ''
    const jobs    = v.jobs_completed ? ` (kazi ${v.jobs_completed})` : ''
    const spec    = v.specialty ? `\n   📋 ${v.specialty}` : ''
    const loc     = v.location ? `\n   📍 ${v.location}` : ''
    return `${nums[i]} *${v.name}*${rating}${jobs}${spec}${loc}`
  }).join('\n\n')

  return `Nimepata mawakala ${data.length} wanaofaa! 🔧\n\n${items}\n\n_Niambie nambari ya chaguo lako ili nikusaidie zaidi._`
}

// ── No-results message ────────────────────────────────────────────────────────

export function noResultsMessage(entities: ExtractedEntities): string {
  const parts: string[] = []
  if (entities.location)     parts.push(`eneo: *${entities.location}*`)
  if (entities.listing_type) parts.push(`aina: *${entities.listing_type}*`)
  if (entities.price_max)    parts.push(`bei hadi: *Tsh ${entities.price_max.toLocaleString()}*`)
  if (entities.bedrooms)     parts.push(`vyumba: *${entities.bedrooms}+*`)

  const criteria = parts.length > 0 ? ` kwa ${parts.join(', ')}` : ''

  return `Samahani, sijapata nyumba inayolingana${criteria} kwa sasa. 😔\n\n` +
    `Unaweza:\n` +
    `• Badilisha eneo au bei — niambie tofauti\n` +
    `• Angalia tovuti yetu: ${APP_URL}\n` +
    `• Niambie *1* kwa msaada zaidi`
}
