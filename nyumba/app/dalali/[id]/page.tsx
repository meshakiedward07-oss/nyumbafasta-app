import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/server'
import SeoListingGrid, { type SeoListing } from '@/components/seo/SeoListingGrid'

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

async function getDalali(id: string): Promise<DalaliRow | null> {
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
}

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const dalali = await getDalali(params.id)
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
  params: { id: string }
}) {
  const dalali = await getDalali(params.id)
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
      <div className="min-h-screen bg-gray-50">
        <header className="bg-primary-500 sticky top-0 z-20 shadow-sm">
          <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-2">
            <Link href="/" className="h-11 w-[180px] block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/transparent_logo_nyumbafasta.png"
                alt="NyumbaFasta"
                className="h-full w-full object-contain object-left"
              />
            </Link>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6">
          <article>
            {/* Dalali header */}
            <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-start gap-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-primary-50 flex-shrink-0">
                  {dalali.avatar_url ? (
                    <Image
                      src={dalali.avatar_url}
                      alt={dalali.full_name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-2xl">
                      <i className="ti ti-user" aria-hidden="true" />
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold text-gray-900">{dalali.full_name}</h1>
                    {isVerified && (
                      <span className="bg-primary-500 text-white text-xs px-2 py-0.5 rounded-full">
                          <i className="ti ti-circle-check" aria-hidden="true" /> Imethibitishwa
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">Dalali wa NyumbaFasta · Tanzania</p>
                  {rating > 0 && (
                    <p className="flex items-center gap-1 mt-1 text-sm">
                      <i className="ti ti-star-filled text-amber-400" aria-hidden="true" />
                      <span className="font-medium text-gray-700">{rating.toFixed(1)}</span>
                      <span className="text-gray-400">({ratingCount} maoni)</span>
                    </p>
                  )}
                </div>
              </div>

              {profile?.bio && (
                <p className="text-sm text-gray-600 leading-relaxed mt-4">{profile.bio}</p>
              )}

              {/* Contact CTA — always goes through the paid unlock flow on listing detail */}
              <div className="mt-4">
                {listings.length > 0 ? (
                  <Link
                    href={`/listings/${listings[0].id}`}
                    className="inline-flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold"
                  >
                    <i className="ti ti-brand-whatsapp" aria-hidden="true" /> Wasiliana na {dalali.full_name.split(' ')[0]}
                  </Link>
                ) : (
                  <p className="text-sm text-gray-400 italic">
                    Dalali huyu hana listings zinazofanya kazi sasa hivi.
                  </p>
                )}
              </div>
            </section>

            {/* Listings */}
            <section className="mt-8" aria-label={`Listings za ${dalali.full_name}`}>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Nyumba za {dalali.full_name} ({listings.length})
              </h2>
              {listings.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
                  <p className="text-2xl mb-2"><i className="ti ti-home" aria-hidden="true" /></p>
                  <p className="text-sm text-gray-500">Hakuna listings sasa hivi</p>
                </div>
              ) : (
                <SeoListingGrid listings={listings} />
              )}
            </section>
          </article>
        </main>
      </div>
    </>
  )
}
