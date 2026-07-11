import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/server'
import { TANZANIA_REGIONS, PRIORITY_REGIONS } from '@/lib/data/tanzania-locations'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

// Property types that have dedicated region+type SEO pages
const SEO_TYPES = ['chumba', 'apartment', 'nyumba', 'studio', 'duka']

// Region name → URL slug, e.g. "Dar es Salaam" → "dar-es-salaam"
function regionSlug(region: string): string {
  return region.toLowerCase().replace(/\s+/g, '-')
}

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let listings: { id: string; updated_at: string | null }[] = []
  let dalalis: { username: string }[] = []

  try {
    const admin = createAdminClient()
    const [listingsRes, dalaliRes] = await Promise.all([
      admin
        .from('listings')
        .select('id, updated_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1000),
      // Only index verified dalalis with a username — these are the canonical microsite URLs
      admin
        .from('users')
        .select('username, dalali_profiles!inner(is_premium_verified)')
        .eq('role', 'dalali')
        .eq('is_active', true)
        .eq('dalali_profiles.is_premium_verified', true)
        .not('username', 'is', null)
        .limit(1000),
    ])
    listings = listingsRes.data ?? []
    dalalis = (dalaliRes.data ?? [])
      .filter(d => !!d.username)
      .map(d => ({ username: d.username as string }))
  } catch {
    // DB unavailable at build time — return static URLs only
  }

  const now = new Date()

  // ── Active listings ───────────────────────────────────────
  const listingUrls: MetadataRoute.Sitemap = listings.map(listing => ({
    url: `${APP_URL}/listings/${listing.id}`,
    lastModified: listing.updated_at ?? now,
    changeFrequency: 'daily',
    priority: 0.8,
  }))

  // ── Region SEO pages — /mali/{region-slug} for all 31 regions ──
  const regionUrls: MetadataRoute.Sitemap = TANZANIA_REGIONS.map(r => ({
    url: `${APP_URL}/mali/${regionSlug(r.name)}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.85,
  }))

  // ── Region+Type SEO pages — top 8 priority regions × 4 types ──
  const regionTypeUrls: MetadataRoute.Sitemap = PRIORITY_REGIONS.flatMap(region =>
    SEO_TYPES.map(type => ({
      url: `${APP_URL}/mali/${regionSlug(region)}/${type}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))
  )

  // ── Dalali microsite pages — /agent/{username} for verified dalalis only ──
  const dalaliUrls: MetadataRoute.Sitemap = dalalis.map(d => ({
    url: `${APP_URL}/agent/${d.username}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.75,
  }))

  // ── Static pages ──────────────────────────────────────────
  const staticUrls: MetadataRoute.Sitemap = [
    { url: APP_URL, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    { url: `${APP_URL}/register`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${APP_URL}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${APP_URL}/terms`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${APP_URL}/privacy`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${APP_URL}/data-deletion`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ]

  return [
    ...staticUrls,
    ...regionUrls,
    ...regionTypeUrls,
    ...listingUrls,
    ...dalaliUrls,
  ]
}
