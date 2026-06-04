'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ListingsSection from '@/components/listings/ListingsSection'

function HomeContent() {
  const searchParams = useSearchParams()
  const [welcomeDismissed, setWelcomeDismissed] = useState(false)
  const showWelcome = searchParams.get('welcome') === 'true' && !welcomeDismissed

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Sticky header — logo + account button */}
      <header className="bg-[#1D9E75] sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="h-12 w-[55%] sm:w-[45%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/transparent_logo_nyumbafasta.png"
              alt="NyumbaFasta"
              className="h-full w-full object-contain object-left"
            />
          </div>
          <Link href="/account">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-lg">👤</span>
            </div>
          </Link>
        </div>
      </header>

      {/* Main content — search, filters, map/grid toggle, listings, bottom nav */}
      <ListingsSection />

      {/* Welcome modal — shown after email verification */}
      {showWelcome && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-xl">
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="font-bold text-xl mb-2 text-gray-900">Karibu NyumbaFasta!</h2>
            <p className="text-gray-500 text-sm mb-5 leading-relaxed">
              Akaunti yako imethibitishwa vizuri. Uko tayari kutafuta nyumba na vyumba Tanzania!
            </p>
            <button
              onClick={() => setWelcomeDismissed(true)}
              className="w-full bg-[#1D9E75] text-white py-3 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
            >
              Anza Kutumia →
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

export default function HomeClient() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <HomeContent />
    </Suspense>
  )
}
