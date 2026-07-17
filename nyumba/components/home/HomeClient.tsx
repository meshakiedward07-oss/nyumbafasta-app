'use client'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import ListingsSection from '@/components/listings/ListingsSection'
import BannerAd from '@/components/ads/BannerAd'
import type { ListingWithDalali } from '@/lib/types/database'

// Isolated so useSearchParams doesn't block SSR of the header + listings above it
function WelcomeModal() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const show = searchParams.get('welcome') === 'true' && !dismissed

  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="bg-primary-500 px-6 pt-6 pb-5 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
            <i className="ti ti-rosette-discount-check text-white text-3xl" aria-hidden="true" />
          </div>
          <h2 className="font-bold text-lg text-white leading-tight">Akaunti Imethibitishwa</h2>
          <p className="text-primary-100 text-sm mt-1">Karibu NyumbaFasta Tanzania</p>
        </div>
        <div className="px-6 py-5 text-center">
          <p className="text-gray-600 text-sm leading-relaxed">
            Uko tayari kutafuta nyumba na vyumba bora Tanzania yote.
          </p>
          <button
            onClick={() => { setDismissed(true); router.replace('/') }}
            className="mt-4 w-full bg-primary-500 text-white py-3 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
          >
            Anza Kutumia
          </button>
        </div>
      </div>
    </div>
  )
}

type Props = {
  initialListings: ListingWithDalali[]
  initialTotal: number
}

export default function HomeClient({ initialListings, initialTotal }: Props) {
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Banner Ad — shows above listings */}
      <BannerAd />

      {/* Listings — logo + search bar + filters + cards; all in one component */}
      <ListingsSection initialListings={initialListings} initialTotal={initialTotal} />

      {/* Welcome modal isolated in Suspense so it never blocks the SSR of content above */}
      <Suspense fallback={null}>
        <WelcomeModal />
      </Suspense>

    </div>
  )
}
