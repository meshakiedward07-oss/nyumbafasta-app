'use client'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import ListingsSection from '@/components/listings/ListingsSection'
import type { ListingWithDalali } from '@/lib/types/database'

// Isolated so useSearchParams doesn't block SSR of the header + listings above it
function WelcomeModal() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const show = searchParams.get('welcome') === 'true' && !dismissed

  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-xl">
        <div className="text-5xl mb-3 flex justify-center"><i className="ti ti-confetti text-primary-500" aria-hidden="true" /></div>
        <h2 className="font-bold text-xl mb-2 text-gray-900">Karibu NyumbaFasta!</h2>
        <p className="text-gray-500 text-sm mb-5 leading-relaxed">
          Akaunti yako imethibitishwa vizuri. Uko tayari kutafuta nyumba na vyumba Tanzania!
        </p>
        <button
          onClick={() => { setDismissed(true); router.replace('/') }}
          className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
        >
          Anza Kutumia →
        </button>
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

      {/* Listings — logo + search bar + filters + cards; all in one component */}
      <ListingsSection initialListings={initialListings} initialTotal={initialTotal} />

      {/* Welcome modal isolated in Suspense so it never blocks the SSR of content above */}
      <Suspense fallback={null}>
        <WelcomeModal />
      </Suspense>

    </div>
  )
}
