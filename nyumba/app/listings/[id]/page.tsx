import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import ListingDetail from '@/components/listings/ListingDetail'
import type { Listing, User, DalaliProfile, Review } from '@/lib/types/database'

export type ListingFull = Listing & {
  dalali: (User & {
    dalali_profiles: DalaliProfile | null
  }) | null
}

export type ReviewWithReviewer = Review & {
  reviewer: Pick<User, 'full_name'> | null
}

export type SortOrder = 'recent' | 'highest' | 'helpful'

// ── Helpers ──────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  chumba: 'Chumba', apartment: 'Apartment', nyumba: 'Nyumba', studio: 'Studio',
}

function fmtPrice(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}k`
  return String(amount)
}

// ── Cached lightweight fetch for metadata (deduped across generateMetadata + page) ──
const getListingMeta = cache(async (id: string) => {
  const admin = createAdminClient()
  const { data } = await admin
    .from('listings')
    .select('id, title, type, district, region, description, images, price_monthly, status, updated_at')
    .eq('id', id)
    .single()
  return data
})

// ── Dynamic metadata per listing ─────────────────────────
export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const listing = await getListingMeta(params.id)
  if (!listing) return { title: 'Listing | NyumbaFasta' }

  const typeLabel = TYPE_LABELS[listing.type] ?? listing.type
  const title = listing.title
    ? `${listing.title} — Tsh ${fmtPrice(listing.price_monthly)}/mwezi`
    : `${typeLabel} ${listing.district} — Tsh ${fmtPrice(listing.price_monthly)}/mwezi`
  const description = [
    `${typeLabel} inapatikana ${listing.district}, ${listing.region}.`,
    listing.description?.slice(0, 120),
    `Piga simu na dalali moja kwa moja.`,
  ]
    .filter(Boolean)
    .join(' ')

  const ogImages = listing.images?.length
    ? [{ url: listing.images[0], width: 800, height: 600, alt: title }]
    : []

  return {
    title,
    description,
    openGraph: {
      title,
      description: `Tsh ${fmtPrice(listing.price_monthly)}/mwezi · ${listing.district}, ${listing.region}`,
      images: ogImages,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: `Tsh ${fmtPrice(listing.price_monthly)}/mwezi · ${listing.district}, ${listing.region}`,
      images: ogImages.map(i => i.url),
    },
  }
}

// ── Page ─────────────────────────────────────────────────
export default async function ListingDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()

  // Increment view count
  await supabase.rpc('increment_view_count', { listing_id: params.id }).maybeSingle()

  // Track in recently_viewed for logged-in users
  const { data: { user: viewer } } = await supabase.auth.getUser()
  if (viewer) {
    await supabase
      .from('recently_viewed')
      .upsert(
        { user_id: viewer.id, listing_id: params.id, viewed_at: new Date().toISOString() },
        { onConflict: 'user_id,listing_id' }
      )

    const { data: old } = await supabase
      .from('recently_viewed')
      .select('id')
      .eq('user_id', viewer.id)
      .order('viewed_at', { ascending: false })
      .range(20, 100)

    if (old?.length) {
      await supabase.from('recently_viewed').delete().in('id', old.map(r => r.id))
    }
  }

  const { data, error } = await supabase
    .from('listings')
    .select(`
      id, title, type, status, price_monthly,
      district, region, furnished, amenities,
      images, description,
      is_boosted, view_count, lead_count, share_count,
      created_at, dalali_id,
      dalali:dalali_id (
        id, full_name, phone, avatar_url,
        dalali_profiles (
          id, whatsapp_number, bio,
          rating_avg, rating_count, is_premium_verified
        )
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !data) notFound()

  // Check if current user already unlocked this listing
  const { data: { user } } = await supabase.auth.getUser()
  let hasUnlocked = false
  let unlockId: string | null = null
  let unlockCreatedAt: string | null = null
  let hasReviewed = false

  if (user) {
    const { data: unlock } = await supabase
      .from('contact_unlocks')
      .select('id, created_at, client_notes')
      .eq('client_id', user.id)
      .eq('listing_id', params.id)
      .eq('status', 'completed')
      .maybeSingle()

    hasUnlocked     = !!unlock
    unlockId        = unlock?.id ?? null
    unlockCreatedAt = unlock?.created_at ?? null

    if (unlockId) {
      const { data: review } = await supabase
        .from('reviews')
        .select('id')
        .eq('unlock_id', unlockId)
        .maybeSingle()
      hasReviewed = !!review
    }
  }

  const listing = data as unknown as ListingFull

  // Fetch reviews + similar listings in parallel
  const [reviewsRes, similarRes] = await Promise.all([
    supabase
      .from('reviews')
      .select('id, rating, comment, created_at, is_verified, helpful_count, response, response_at, reviewer:reviewer_id ( full_name )')
      .eq('dalali_id', listing.dalali_id)
      .order('created_at', { ascending: false })
      .limit(50),

    supabase
      .from('listings')
      .select('id, title, type, price_monthly, district, region, images, is_boosted, view_count, lead_count, status, dalali_id, furnished, amenities, description, bedrooms, deposit_months, street, boost_expires_at, rejection_reason, expires_at, approved_at, created_at, dalali:dalali_id ( id, full_name, avatar_url, dalali_profiles ( rating_avg, is_premium_verified ) )')
      .eq('region', listing.region)
      .eq('status', 'active')
      .neq('id', listing.id)
      .order('is_boosted', { ascending: false })
      .limit(3),
  ])

  // ── JSON-LD Structured Data ───────────────────────────
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: listing.title || `${TYPE_LABELS[listing.type] ?? listing.type} – ${listing.district}`,
    description: listing.description ?? '',
    url: `${APP_URL}/listings/${listing.id}`,
    image: listing.images ?? [],
    offers: {
      '@type': 'Offer',
      price: listing.price_monthly,
      priceCurrency: 'TZS',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: listing.price_monthly,
        priceCurrency: 'TZS',
        referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
      },
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: listing.district,
      addressRegion: listing.region,
      addressCountry: 'TZ',
    },
    provider: {
      '@type': 'Person',
      name: listing.dalali?.full_name ?? 'Dalali',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <ListingDetail
        listing={listing}
        hasUnlocked={hasUnlocked}
        isLoggedIn={!!user}
        unlockId={unlockId}
        hasReviewed={hasReviewed}
        unlockCreatedAt={unlockCreatedAt}
        reviews={(reviewsRes.data ?? []) as unknown as ReviewWithReviewer[]}
        similarListings={(similarRes.data ?? []) as unknown as ListingFull[]}
      />
    </>
  )
}
