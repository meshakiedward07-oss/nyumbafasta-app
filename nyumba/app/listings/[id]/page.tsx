import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import ListingDetail from '@/components/listings/ListingDetail'
import PropertySchema from '@/components/seo/PropertySchema'
import { regionToSlug } from '@/lib/data/tanzania-locations'
import type { Listing, User, DalaliProfile, Review } from '@/lib/types/database'

export type ListingFull = Listing & {
  dalali: (User & {
    username?: string | null
    dalali_profiles: DalaliProfile | null
  }) | null
}

export type ReviewWithReviewer = Review & {
  reviewer: Pick<User, 'full_name'> | null
}

export type SortOrder = 'recent' | 'highest' | 'helpful'

// ── Helpers ──────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  chumba: 'Chumba', apartment: 'Apartment', nyumba: 'Nyumba', studio: 'Studio', duka: 'Duka',
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

  // Run auth + main listing fetch in parallel — saves ~150ms vs sequential
  const [{ data: { user } }, { data, error }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('listings')
      .select(`
        id, title, type, status, price_monthly,
        district, region, street, ward, mtaa, address_full, location_display,
        furnished, amenities,
        images, video_url, description, bedrooms,
        is_boosted, view_count, lead_count, share_count,
        latitude, longitude,
        commission_type, commission_value, commission_notes,
        created_at, dalali_id,
        dalali:dalali_id (
          id, full_name, avatar_url, username,
          dalali_profiles (
            bio,
            rating_avg, rating_count, is_premium_verified, is_favourite_dalali,
            is_transparent_agent
          )
        )
      `)
      .eq('id', params.id)
      .single(),
  ])

  if (error || !data) notFound()

  // Fire-and-forget side effects — don't block page render
  // PostgrestBuilder is PromiseLike (not Promise), so wrap in Promise.resolve for .catch()
  Promise.resolve(
    supabase.rpc('increment_view_count', { listing_id: params.id }).maybeSingle()
  ).catch(() => {})

  if (user) {
    void (async () => {
      await supabase
        .from('recently_viewed')
        .upsert(
          { user_id: user.id, listing_id: params.id, viewed_at: new Date().toISOString() },
          { onConflict: 'user_id,listing_id' }
        )
      const { data: old } = await supabase
        .from('recently_viewed')
        .select('id')
        .eq('user_id', user.id)
        .order('viewed_at', { ascending: false })
        .range(20, 100)
      if (old?.length) {
        await supabase.from('recently_viewed').delete().in('id', old.map(r => r.id))
      }
    })().catch(() => {})
  }

  // Check unlock status
  let hasUnlocked = false
  let unlockId: string | null = null
  let unlockCreatedAt: string | null = null
  let hasReviewed = false

  if (user) {
    const last24hrs = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Two access paths run in parallel:
    // 1. Direct unlock for this exact listing (permanent)
    // 2. Any completed unlock for the same dalali within last 24 hrs (free access window)
    const [directUnlockRes, dalaliAccessRes] = await Promise.all([
      supabase
        .from('contact_unlocks')
        .select('id, created_at')
        .eq('client_id', user.id)
        .eq('listing_id', params.id)
        .eq('status', 'completed')
        .maybeSingle(),

      supabase
        .from('contact_unlocks')
        .select('id, created_at')
        .eq('client_id', user.id)
        .eq('dalali_id', data.dalali_id)
        .eq('status', 'completed')
        .gte('created_at', last24hrs)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const directUnlock = directUnlockRes.data
    const dalaliAccess = dalaliAccessRes.data

    hasUnlocked     = !!directUnlock || !!dalaliAccess
    // Only a direct unlock on this listing enables the review prompt
    unlockId        = directUnlock?.id ?? null
    unlockCreatedAt = directUnlock?.created_at ?? dalaliAccess?.created_at ?? null

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

  // Fetch dalali WhatsApp number — ONLY for users who have already paid.
  // Never included in the main listing query so it is never in the server-rendered HTML.
  let dalaliWhatsapp: string | null = null
  if (hasUnlocked) {
    const admin = createAdminClient()
    const { data: dp } = await admin
      .from('dalali_profiles')
      .select('whatsapp_number')
      .eq('id', data.dalali_id)
      .single()
    dalaliWhatsapp = (dp as { whatsapp_number?: string | null } | null)?.whatsapp_number ?? null
  }

  // Fetch reviews + similar listings in parallel
  const [reviewsRes, similarRes] = await Promise.all([
    supabase
      .from('reviews')
      .select('id, rating, comment, created_at, is_verified, helpful_count, response, response_at, reviewer:reviewer_id ( full_name )')
      .eq('dalali_id', listing.dalali_id)
      .order('created_at', { ascending: false })
      .limit(15),

    supabase
      .from('listings')
      .select('id, title, type, price_monthly, district, region, images, is_boosted, view_count, lead_count, status, dalali_id, furnished, amenities, description, bedrooms, street, dalali:dalali_id ( id, full_name, avatar_url, dalali_profiles ( rating_avg, is_premium_verified, is_favourite_dalali ) )')
      .eq('region', listing.region)
      .eq('status', 'active')
      .neq('id', listing.id)
      .order('is_boosted', { ascending: false })
      .limit(3),
  ])

  // ── JSON-LD Structured Data ───────────────────────────
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
  const dalaliUsername = (listing.dalali as (typeof listing.dalali & { username?: string | null }) | null)?.username ?? null
  const agentProfileUrl = dalaliUsername ? `${APP_URL}/agent/${dalaliUsername}` : null
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
      ...(agentProfileUrl ? { url: agentProfileUrl } : {}),
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <PropertySchema
        id={listing.id}
        title={listing.title ?? ''}
        type={listing.type}
        district={listing.district}
        region={listing.region}
        price_monthly={listing.price_monthly}
        description={listing.description}
        images={listing.images ?? []}
        dalaliName={listing.dalali?.full_name ?? undefined}
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
        whatsappNumber={dalaliWhatsapp}
        agentProfileUrl={agentProfileUrl}
      />
      {/* Internal link to region SEO landing page (AI/SEO discoverability) */}
      <nav aria-label="Nyumba zaidi" className="px-4 pb-28 text-center">
        <a
          href={`/mali/${regionToSlug(listing.region)}`}
          className="text-sm text-primary-600 font-medium underline"
        >
          Angalia nyumba zote {listing.region} →
        </a>
      </nav>
    </>
  )
}
