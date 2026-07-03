import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
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
    // whatsapp_number intentionally NOT fetched — must never reach the client
  } | Array<{
    bio: string | null
    rating_avg: number
    rating_count: number
    is_premium_verified: boolean
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
} | null> {
  const admin = createAdminClient()

  const { data: dalali } = await admin
    .from('users')
    .select(`
      id, full_name, username, avatar_url, is_active, role,
      dalali_profiles ( bio, rating_avg, rating_count, is_premium_verified )
    `)
    .eq('username', username)
    .eq('role', 'dalali')
    .eq('is_active', true)
    .single()

  if (!dalali) return null

  const profile = pickProfile((dalali as unknown as ProfileRow).dalali_profiles)
  // Only verified dalali have public agent profiles
  if (!profile?.is_premium_verified) return null

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

  return {
    dalali: dalali as unknown as ProfileRow,
    listings: (listingsRes.data ?? []) as ListingRow[],
    reviews: (reviewsRes.data ?? []) as ReviewRow[],
  }
}

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  const result = await getAgentData(params.username.toLowerCase())
  if (!result) return { title: 'Dalali Hapatikani | NyumbaFasta' }

  const { dalali } = result
  const title = `${dalali.full_name} — Dalali wa Nyumba | NyumbaFasta`
  const description = `Angalia listings zote za ${dalali.full_name} kwenye NyumbaFasta — platform bora ya kutafuta nyumba Tanzania.`
  const url = `${APP_URL}/agent/${dalali.username}`

  return {
    title,
    description,
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

  const { dalali, listings, reviews } = result
  const profile = pickProfile(dalali.dalali_profiles)

  // JSON-LD: Person + RealEstateAgent
  const schema = {
    '@context': 'https://schema.org',
    '@type': ['Person', 'RealEstateAgent'],
    name: dalali.full_name,
    url: `${APP_URL}/agent/${username}`,
    image: dalali.avatar_url ?? undefined,
    worksFor: { '@type': 'Organization', name: 'NyumbaFasta', url: APP_URL },
    areaServed: { '@type': 'Country', name: 'Tanzania' },
    ...(profile?.rating_count && profile.rating_count > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: profile.rating_avg, reviewCount: profile.rating_count } }
      : {}),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <AgentProfileClient
        dalali={{
          id: dalali.id,
          name: dalali.full_name,
          username,
          avatarUrl: dalali.avatar_url,
          isVerified: profile?.is_premium_verified ?? false,
          bio: profile?.bio ?? null,
          ratingAvg: profile?.rating_avg ?? 0,
          ratingCount: profile?.rating_count ?? 0,
        }}
        listings={listings}
        reviews={reviews}
      />
    </>
  )
}
