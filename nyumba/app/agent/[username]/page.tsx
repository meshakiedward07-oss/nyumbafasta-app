import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import AgentProfileClient from './AgentProfileClient'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

export const revalidate = 300 // 5-min ISR — keeps profile fresh without hammering DB

type ProfileRow = {
  id: string
  full_name: string
  username: string
  avatar_url: string | null
  is_active: boolean
  role: string
  dalali_profiles: {
    bio: string | null
    rating_avg: number
    rating_count: number
    is_premium_verified: boolean
    is_transparent_agent: boolean
    verification_status: string | null
    // whatsapp_number intentionally NOT fetched — must never reach the client
  } | Array<{
    bio: string | null
    rating_avg: number
    rating_count: number
    is_premium_verified: boolean
    is_transparent_agent: boolean
    verification_status: string | null
  }> | null
}

type ListingRow = {
  id: string
  title: string | null
  type: string
  price_monthly: number
  district: string
  region: string
  images: string[] | null
  bedrooms: number | null
  is_boosted: boolean
  view_count: number
  created_at: string
}

type ReviewRow = {
  id: string
  rating: number
  comment: string | null
  created_at: string
}

function pickProfile(p: ProfileRow['dalali_profiles']) {
  if (!p) return null
  return Array.isArray(p) ? (p[0] ?? null) : p
}

async function getAgentData(username: string): Promise<{
  dalali: ProfileRow
  listings: ListingRow[]
  reviews: ReviewRow[]
  primaryRegion: string | null
  primaryDistrict: string | null
  verified: boolean
  verificationStatus: string | null
} | null> {
  const admin = createAdminClient()

  const { data: dalali } = await admin
    .from('users')
    .select(`
      id, full_name, username, avatar_url, is_active, role,
      dalali_profiles ( bio, rating_avg, rating_count, is_premium_verified, is_transparent_agent, verification_status )
    `)
    .eq('username', username)
    .eq('role', 'dalali')
    .eq('is_active', true)
    .single()

  if (!dalali) return null

  const profile = pickProfile((dalali as unknown as ProfileRow).dalali_profiles)

  // Unverified dalali: return minimal info so we can show a pending page instead of 404
  if (!profile?.is_premium_verified) {
    return {
      dalali: dalali as unknown as ProfileRow,
      listings: [],
      reviews: [],
      primaryRegion: null,
      primaryDistrict: null,
      verified: false,
      verificationStatus: profile?.verification_status ?? null,
    }
  }

  const [listingsRes, reviewsRes] = await Promise.all([
    admin
      .from('listings')
      .select('id, title, type, price_monthly, district, region, images, bedrooms, is_boosted, view_count, created_at')
      .eq('dalali_id', dalali.id)
      .eq('status', 'active')
      .order('is_boosted', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50),

    admin
      .from('reviews')
      .select('id, rating, comment, created_at')
      .eq('dalali_id', dalali.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const listingData = (listingsRes.data ?? []) as ListingRow[]

  // Derive dalali's primary location from their active listings
  const regionCounts: Record<string, number> = {}
  for (const l of listingData) regionCounts[l.region] = (regionCounts[l.region] ?? 0) + 1
  const primaryRegion = Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const districtCounts: Record<string, number> = {}
  for (const l of listingData.filter(l => l.region === primaryRegion))
    districtCounts[l.district] = (districtCounts[l.district] ?? 0) + 1
  const primaryDistrict = Object.entries(districtCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    dalali: dalali as unknown as ProfileRow,
    listings: listingData,
    reviews: (reviewsRes.data ?? []) as ReviewRow[],
    primaryRegion,
    primaryDistrict,
    verified: true,
    verificationStatus: 'approved',
  }
}

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  const result = await getAgentData(params.username.toLowerCase())
  if (!result) return { title: 'Dalali Hapatikani | NyumbaFasta' }

  // Unverified: tell crawlers not to index the pending page
  if (!result.verified) {
    return {
      title: `${result.dalali.full_name} | NyumbaFasta`,
      robots: 'noindex, nofollow',
    }
  }

  const { dalali } = result
  const title = `${dalali.full_name} — Dalali wa Nyumba | NyumbaFasta`
  const description = `Angalia listings zote za ${dalali.full_name} kwenye NyumbaFasta — platform bora ya kutafuta nyumba Tanzania.`
  const url = `${APP_URL}/agent/${dalali.username}`

  return {
    title,
    description,
    robots: 'index, follow',
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'profile',
      siteName: 'NyumbaFasta',
      images: dalali.avatar_url ? [{ url: dalali.avatar_url }] : undefined,
    },
    twitter: { card: 'summary', title, description },
  }
}

export default async function AgentProfilePage({ params }: { params: { username: string } }) {
  const username = params.username.toLowerCase()
  const result = await getAgentData(username)
  if (!result) notFound()

  const { dalali, listings, reviews, primaryRegion, primaryDistrict, verified } = result
  const profile = pickProfile(dalali.dalali_profiles)

  // Unverified dalali: show a helpful "pending" page instead of 404
  if (!verified) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-clock text-3xl text-amber-500" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-bold text-gray-800 mb-2">Ukurasa unasubiri uthibitisho</h1>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Dalali <strong>{dalali.full_name}</strong> bado hajathibitishwa. Ukurasa wake wa umma utakuwa wazi baada ya uthibitisho kukamilika.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-primary-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
          >
            <i className="ti ti-home" aria-hidden="true" /> Tafuta Nyumba
          </Link>
        </div>
      </div>
    )
  }

  const agentUrl = `${APP_URL}/agent/${username}`

  // JSON-LD: Person + RealEstateAgent
  const agentSchema = {
    '@context': 'https://schema.org',
    '@type': ['Person', 'RealEstateAgent'],
    name: dalali.full_name,
    url: agentUrl,
    image: dalali.avatar_url ?? undefined,
    worksFor: { '@type': 'Organization', name: 'NyumbaFasta', url: APP_URL },
    areaServed: { '@type': 'Country', name: 'Tanzania' },
    ...(profile?.rating_count && profile.rating_count > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: profile.rating_avg, reviewCount: profile.rating_count } }
      : {}),
  }

  // JSON-LD: ItemList of active listings
  const itemListSchema = listings.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Listings za ${dalali.full_name}`,
    url: agentUrl,
    numberOfItems: listings.length,
    itemListElement: listings.slice(0, 10).map((l, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${APP_URL}/listings/${l.id}`,
      name: l.title ?? `${l.type} – ${l.district}`,
    })),
  } : null

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(agentSchema) }} />
      {itemListSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      )}
      <AgentProfileClient
        dalali={{
          id: dalali.id,
          name: dalali.full_name,
          username,
          avatarUrl: dalali.avatar_url,
          isVerified: profile?.is_premium_verified ?? false,
          isTransparentAgent: profile?.is_transparent_agent ?? false,
          bio: profile?.bio ?? null,
          ratingAvg: profile?.rating_avg ?? 0,
          ratingCount: profile?.rating_count ?? 0,
        }}
        listings={listings}
        reviews={reviews}
        primaryRegion={primaryRegion}
        primaryDistrict={primaryDistrict}
      />
    </>
  )
}
