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
  let dalalis: { id: string }[] = []

  try {
    const admin = createAdminClient()
    const [listingsRes, dalaliRes] = await Promise.all([
      admin
        .from('listings')
        .select('id, updated_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1000),
      admin
        .from('users')
        .select('id')
        .eq('role', 'dalali')
        .eq('is_active', true)
        .limit(1000),
    ])
    listings = listingsRes.data ?? []
    dalalis = dalaliRes.data ?? []
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

  // ── Dalali profile pages — /dalali/{userId} for active dalali ──
  const dalaliUrls: MetadataRoute.Sitemap = dalalis.map(d => ({
    url: `${APP_URL}/dalali/${d.id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
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
