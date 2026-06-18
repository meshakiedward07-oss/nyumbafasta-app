import Link from 'next/link'
import Image from 'next/image'

const TYPE_LABELS: Record<string, string> = {
  chumba: 'Chumba',
  apartment: 'Apartment',
  nyumba: 'Nyumba',
  studio: 'Studio',
  duka: 'Duka',
}

function formatPrice(amount: number): string {
  if (amount >= 1_000_000) return `Tsh ${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `Tsh ${(amount / 1_000).toFixed(0)}k`
  return `Tsh ${amount}`
}

export interface SeoListing {
  id: string
  title: string | null
  type: string
  district: string | null
  region: string | null
  price_monthly: number
  images: string[] | null
  description?: string | null
}

// Simple, server-rendered grid of listing cards for SEO landing pages.
// Each card is a crawlable <a> linking to the full listing detail page.
export default function SeoListingGrid({ listings }: { listings: SeoListing[] }) {
  if (listings.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">🏠</div>
        <p className="text-gray-700 font-semibold mb-1">Hakuna listings bado hapa</p>
        <p className="text-gray-400 text-sm mb-5">
          Kuwa wa kwanza kupost nyumba eneo hili!
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 bg-primary-500 text-white px-5 py-3 rounded-xl text-sm font-semibold"
        >
          🏠 Ongeza Listing
        </Link>
      </div>
    )
  }

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0">
      {listings.map((l, i) => {
        const typeLabel = TYPE_LABELS[l.type] ?? l.type
        const heading = l.title || `${typeLabel} – ${l.district ?? ''}`
        const cover = l.images?.[0]
        return (
          <li key={l.id}>
            <Link
              href={`/listings/${l.id}`}
              className="block bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow h-full"
            >
              <div className="relative h-44 bg-gray-100">
                {cover ? (
                  <Image
                    src={cover}
                    alt={heading}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                    loading={i < 3 ? 'eager' : 'lazy'}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">
                    🏠
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                  {heading}
                </h3>
                <p className="text-primary-600 font-bold text-base mt-1">
                  {formatPrice(l.price_monthly)} <span className="text-xs font-normal text-gray-400">/ mwezi</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  📍 {l.district}, {l.region}
                </p>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
