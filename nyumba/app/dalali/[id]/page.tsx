import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/server'
import DalaliProfileContent from './DalaliProfileContent'
import type { SeoListing } from '@/components/seo/SeoListingGrid'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

export const revalidate = 3600

type DalaliProfileRow = {
  bio: string | null
  rating_avg: number
  rating_count: number
  is_premium_verified: boolean
  // whatsapp_number is intentionally NOT fetched — contact goes through paid unlock flow
}

type DalaliRow = {
  id: string
  full_name: string
  avatar_url: string | null
  is_active: boolean
  role: string
  dalali_profiles: DalaliProfileRow | DalaliProfileRow[] | null
}

function pickProfile(p: DalaliRow['dalali_profiles']): DalaliProfileRow | null {
  if (!p) return null
  return Array.isArray(p) ? (p[0] ?? null) : p
}

const getDalali = cache(async function getDalali(id: string): Promise<DalaliRow | null> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('users')
      .select(
        'id, full_name, avatar_url, is_active, role, dalali_profiles ( bio, rating_avg, rating_count, is_premium_verified )'
      )
      .eq('id', id)
      .single()
    return (data as unknown as DalaliRow) ?? null
  } catch {
    return null
  }
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const dalali = await getDalali(id)
  if (!dalali || dalali.role !== 'dalali' || !dalali.is_active) {
    return { title: 'Dalali | NyumbaFasta' }
  }

  const title = `${dalali.full_name} — Dalali NyumbaFasta`
  const description = `${dalali.full_name} ni dalali wa nyumba Tanzania. Ona listings zake na wasiliana naye kupitia NyumbaFasta.`
  const url = `${APP_URL}/dalali/${dalali.id}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'profile',
      images: dalali.avatar_url ? [{ url: dalali.avatar_url }] : undefined,
    },
    twitter: { card: 'summary', title, description },
  }
}

export default async function DalaliProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const dalali = await getDalali(id)
  if (!dalali || dalali.role !== 'dalali' || !dalali.is_active) notFound()

  const profile = pickProfile(dalali.dalali_profiles)

  // Active listings for this dalali
  let listings: SeoListing[] = []
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('listings')
      .select('id, title, type, district, region, price_monthly, images, description')
      .eq('dalali_id', dalali.id)
      .eq('status', 'active')
      .eq('is_sub_suspended', false)
      .order('created_at', { ascending: false })
      .limit(50)
    listings = (data ?? []) as SeoListing[]
  } catch {
    listings = []
  }

  const rating = profile?.rating_avg ?? 0
  const ratingCount = profile?.rating_count ?? 0
  const isVerified = profile?.is_premium_verified ?? false

  // ── JSON-LD: Person + RealEstateAgent ──
  const schema = {
    '@context': 'https://schema.org',
    '@type': ['Person', 'RealEstateAgent'],
    name: dalali.full_name,
    url: `${APP_URL}/dalali/${dalali.id}`,
    image: dalali.avatar_url ?? undefined,
    worksFor: { '@type': 'Organization', name: 'NyumbaFasta' },
    areaServed: { '@type': 'Country', name: 'Tanzania' },
    ...(ratingCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: rating,
            reviewCount: ratingCount,
          },
        }
      : {}),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <DalaliProfileContent
        dalali={dalali}
        profile={profile}
        listings={listings}
        rating={rating}
        ratingCount={ratingCount}
        isVerified={isVerified}
      />
    </>
  )
}
