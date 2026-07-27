'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function ClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[client-error]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-red-100 p-8 max-w-sm w-full text-center shadow-sm">
        <i className="ti ti-mood-sad text-5xl text-gray-300 block mb-4" aria-hidden="true" />
        <h2 className="text-lg font-bold text-gray-900 mb-2">Samahani, kuna tatizo</h2>
        <p className="text-sm text-gray-500 mb-1">
          {error.message || 'Hitilafu imetokea kwenye ukurasa huu.'}
        </p>
        {error.digest && (
          <p className="text-[11px] text-gray-400 mb-4 font-mono">ID: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center mt-4">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-primary-500 text-white rounded-xl font-semibold text-sm hover:bg-primary-600 transition"
          >
            Jaribu tena
          </button>
          <Link href="/">
            <button className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition">
              Nyumbani
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}
