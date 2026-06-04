import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let listings: { id: string; updated_at: string | null }[] = []

  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('listings')
      .select('id, updated_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1000)
    listings = data ?? []
  } catch {
    // DB unavailable at build time — return static URLs only
  }

  const listingUrls: MetadataRoute.Sitemap = listings.map(listing => ({
    url: `${APP_URL}/listings/${listing.id}`,
    lastModified: listing.updated_at ?? new Date(),
    changeFrequency: 'daily',
    priority: 0.8,
  }))

  return [
    {
      url: APP_URL,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
    {
      url: `${APP_URL}/register`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${APP_URL}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    ...listingUrls,
  ]
}
