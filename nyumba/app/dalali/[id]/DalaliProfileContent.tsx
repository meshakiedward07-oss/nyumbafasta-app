'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/context'
import SeoListingGrid, { type SeoListing } from '@/components/seo/SeoListingGrid'

interface DalaliProfile {
  bio: string | null
  rating_avg: number
  rating_count: number
  is_premium_verified: boolean
}

interface DalaliData {
  id: string
  full_name: string
  avatar_url: string | null
}

interface Props {
  dalali: DalaliData
  profile: DalaliProfile | null
  listings: SeoListing[]
  rating: number
  ratingCount: number
  isVerified: boolean
}

export default function DalaliProfileContent({ dalali, profile, listings, rating, ratingCount, isVerified }: Props) {
  const { t } = useLanguage()

  return (
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
                      <i className="ti ti-circle-check" aria-hidden="true" /> {t('lst_verified')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{t('cl_agent_tagline')}</p>
                {rating > 0 && (
                  <p className="flex items-center gap-1 mt-1 text-sm">
                    <i className="ti ti-star-filled text-amber-400" aria-hidden="true" />
                    <span className="font-medium text-gray-700">{rating.toFixed(1)}</span>
                    <span className="text-gray-400">({ratingCount} {t('cl_maoni')})</span>
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
                  <i className="ti ti-brand-whatsapp" aria-hidden="true" /> {t('cl_contact_name_btn')} {dalali.full_name.split(' ')[0]}
                </Link>
              ) : (
                <p className="text-sm text-gray-400 italic">
                  {t('cl_dalali_no_active')}
                </p>
              )}
            </div>
          </section>

          {/* Listings */}
          <section className="mt-8" aria-label={`${t('cl_dalali_listings_heading')} ${dalali.full_name}`}>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {t('cl_dalali_listings_heading')} {dalali.full_name} ({listings.length})
            </h2>
            {listings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
                <p className="text-2xl mb-2"><i className="ti ti-home" aria-hidden="true" /></p>
                <p className="text-sm text-gray-500">{t('cl_no_listings_yet')}</p>
              </div>
            ) : (
              <SeoListingGrid listings={listings} />
            )}
          </section>
        </article>
      </main>
    </div>
  )
}
