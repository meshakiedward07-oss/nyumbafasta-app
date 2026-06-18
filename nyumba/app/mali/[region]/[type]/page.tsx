import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import {
  PRIORITY_REGIONS,
  regionToSlug,
  slugToRegion,
} from '@/lib/data/tanzania-locations'
import SeoListingGrid, { type SeoListing } from '@/components/seo/SeoListingGrid'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

const VALID_TYPES = ['chumba', 'apartment', 'nyumba', 'studio', 'duka'] as const
type ValidType = (typeof VALID_TYPES)[number]

// Plural Swahili labels used in titles/headings
const TYPE_PLURAL: Record<ValidType, string> = {
  chumba: 'Vyumba',
  apartment: 'Apartments',
  nyumba: 'Nyumba',
  studio: 'Studio',
  duka: 'Maduka',
}

function isValidType(t: string): t is ValidType {
  return (VALID_TYPES as readonly string[]).includes(t)
}

// Pre-render top 8 priority regions × 4 types = 32 combinations
export function generateStaticParams() {
  return PRIORITY_REGIONS.flatMap(region =>
    VALID_TYPES.map(type => ({ region: regionToSlug(region), type }))
  )
}

export const revalidate = 3600

export async function generateMetadata({
  params,
}: {
  params: { region: string; type: string }
}): Promise<Metadata> {
  const region = slugToRegion(params.region)
  if (!region || !isValidType(params.type)) return { title: 'Mali | NyumbaFasta' }

  const plural = TYPE_PLURAL[params.type]
  const title = `${plural} za Kupanga ${region} | NyumbaFasta`
  const description = `Tafuta ${plural.toLowerCase()} za kupanga ${region}, Tanzania. Bei nzuri, picha halisi, zungumza na dalali moja kwa moja kupitia NyumbaFasta.`
  const url = `${APP_URL}/mali/${regionToSlug(region)}/${params.type}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

async function fetchListings(region: string, type: string): Promise<SeoListing[]> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('listings')
      .select('id, title, type, district, region, price_monthly, images, description')
      .eq('status', 'active')
      .eq('region', region)
      .eq('type', type)
      .order('created_at', { ascending: false })
      .limit(20)
    return (data ?? []) as SeoListing[]
  } catch {
    return []
  }
}

export default async function RegionTypePage({
  params,
}: {
  params: { region: string; type: string }
}) {
  const region = slugToRegion(params.region)
  if (!region || !isValidType(params.type)) notFound()

  const type = params.type
  const plural = TYPE_PLURAL[type]
  const slug = regionToSlug(region)
  const listings = await fetchListings(region, type)

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SearchResultsPage',
    name: `${plural} za Kupanga ${region}`,
    url: `${APP_URL}/mali/${slug}/${type}`,
    about: {
      '@type': 'Place',
      name: region,
      address: { '@type': 'PostalAddress', addressRegion: region, addressCountry: 'TZ' },
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <div className="max-w-5xl mx-auto px-4 py-6">
        <article>
          <nav aria-label="Breadcrumb" className="text-xs text-gray-400 mb-3">
            <Link href={`/mali/${slug}`} className="hover:text-primary-600">
              {region}
            </Link>
            <span className="mx-1">/</span>
            <span className="text-gray-600">{plural}</span>
          </nav>

          <header className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              {plural} za Kupanga {region}
            </h1>
            <p className="text-gray-600 text-sm mt-2 leading-relaxed">
              Tafuta {plural.toLowerCase()} za kupanga {region}, Tanzania kupitia NyumbaFasta.
              Bei halisi, picha za kweli, na mawasiliano ya haraka na madalali kupitia WhatsApp.
            </p>
          </header>

          {/* Other types in same region */}
          <nav aria-label="Aina nyingine" className="mb-6">
            <div className="flex flex-wrap gap-2">
              {VALID_TYPES.filter(t => t !== type).map(t => (
                <Link
                  key={t}
                  href={`/mali/${slug}/${t}`}
                  className="text-sm bg-primary-50 text-primary-700 border border-primary-100 px-4 py-2 rounded-full font-medium hover:bg-primary-100 transition-colors"
                >
                  {TYPE_PLURAL[t]} {region}
                </Link>
              ))}
              <Link
                href={`/mali/${slug}`}
                className="text-sm bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-full font-medium hover:border-primary-300 transition-colors"
              >
                Aina zote {region}
              </Link>
            </div>
          </nav>

          <section aria-label={`${plural} ${region}`}>
            <SeoListingGrid listings={listings} />
          </section>
        </article>
      </div>
    </>
  )
}
