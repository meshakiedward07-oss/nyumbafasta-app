import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import {
  TANZANIA_REGIONS,
  regionToSlug,
  slugToRegion,
  getDistricts,
} from '@/lib/data/tanzania-locations'
import SeoListingGrid, { type SeoListing } from '@/components/seo/SeoListingGrid'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

const TYPE_LINKS = [
  { type: 'chumba', label: 'Vyumba' },
  { type: 'apartment', label: 'Apartments' },
  { type: 'nyumba', label: 'Nyumba' },
  { type: 'studio', label: 'Studio' },
  { type: 'duka', label: 'Maduka' },
]

// Pre-render all 31 region pages at build time
export function generateStaticParams() {
  return TANZANIA_REGIONS.map(r => ({ region: regionToSlug(r.name) }))
}

export const revalidate = 3600 // refresh listings hourly

export async function generateMetadata({
  params,
}: {
  params: { region: string }
}): Promise<Metadata> {
  const region = slugToRegion(params.region)
  if (!region) return { title: 'Mali | NyumbaFasta' }

  const title = `Nyumba za Kupanga ${region} | NyumbaFasta`
  const description = `Tafuta vyumba, apartments na nyumba za kupanga ${region}, Tanzania. Bei nzuri, picha halisi, zungumza na dalali moja kwa moja kupitia NyumbaFasta.`
  const url = `${APP_URL}/mali/${regionToSlug(region)}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

async function fetchRegionListings(region: string): Promise<SeoListing[]> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('listings')
      .select('id, title, type, district, region, price_monthly, images, description')
      .eq('status', 'active')
      .eq('region', region)
      .order('created_at', { ascending: false })
      .limit(20)
    return (data ?? []) as SeoListing[]
  } catch {
    return []
  }
}

export default async function RegionPage({
  params,
}: {
  params: { region: string }
}) {
  const region = slugToRegion(params.region)
  if (!region) notFound()

  const listings = await fetchRegionListings(region)
  const districts = getDistricts(region)
  const slug = regionToSlug(region)

  // ── JSON-LD: SearchResultsPage ──
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SearchResultsPage',
    name: `Nyumba za Kupanga ${region}`,
    url: `${APP_URL}/mali/${slug}`,
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
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Nyumba za Kupanga {region}
            </h1>
            <p className="text-gray-600 text-sm mt-2 leading-relaxed">
              Tafuta vyumba, apartments, nyumba na studio za kupanga {region}, Tanzania.
              NyumbaFasta inakuunganisha moja kwa moja na madalali wa eneo lako — bei halisi,
              picha za kweli, na mawasiliano ya haraka kupitia WhatsApp.
            </p>
          </header>

          {/* Property type sub-pages */}
          <nav aria-label="Aina za nyumba" className="mb-6">
            <h2 className="sr-only">Tafuta kwa aina ya nyumba {region}</h2>
            <div className="flex flex-wrap gap-2">
              {TYPE_LINKS.map(t => (
                <Link
                  key={t.type}
                  href={`/mali/${slug}/${t.type}`}
                  className="text-sm bg-primary-50 text-primary-700 border border-primary-100 px-4 py-2 rounded-full font-medium hover:bg-primary-100 transition-colors"
                >
                  {t.label} {region}
                </Link>
              ))}
            </div>
          </nav>

          <section aria-label={`Listings ${region}`}>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Nyumba zinazopatikana {region}
            </h2>
            <SeoListingGrid listings={listings} />
          </section>

          {/* District internal links */}
          {districts.length > 0 && (
            <section className="mt-10" aria-label={`Maeneo ya ${region}`}>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">
                Maeneo ya {region}
              </h2>
              <div className="flex flex-wrap gap-2">
                {districts.map(d => (
                  <Link
                    key={d}
                    href={`/mali/${slug}?district=${encodeURIComponent(d)}`}
                    className="text-xs bg-white text-gray-600 border border-gray-200 px-3 py-1.5 rounded-full hover:border-primary-300 transition-colors"
                  >
                    {d}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>
      </div>
    </>
  )
}
