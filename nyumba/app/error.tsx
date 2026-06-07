'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-red-100 p-8 max-w-md w-full text-center shadow-sm">
        <div className="text-5xl mb-4">🏚️</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Samahani, kuna tatizo</h2>
        <p className="text-sm text-gray-500 mb-4">
          {error.message || 'Hitilafu imetokea. Tafadhali jaribu tena.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-[#1D9E75] text-white rounded-xl font-semibold text-sm"
          >
            Jaribu tena
          </button>
          <Link href="/">
            <button className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm">
              Rudi Nyumbani
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}
