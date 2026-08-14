'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/context'

export default function PropertyError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useLanguage()
  useEffect(() => {
    console.error('[property-error]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-red-100 p-8 max-w-sm w-full text-center shadow-sm">
        <i className="ti ti-building-off text-5xl text-gray-300 block mb-4" aria-hidden="true" />
        <h2 className="text-lg font-bold text-gray-900 mb-2">{t('common_property_error')}</h2>
        <p className="text-sm text-gray-500 mb-1">
          {error.message || t('common_property_page_error')}
        </p>
        {error.digest && (
          <p className="text-[11px] text-gray-400 mb-4 font-mono">ID: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center mt-4">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-primary-500 text-white rounded-xl font-semibold text-sm hover:bg-primary-600 transition"
          >
            {t('common_retry')}
          </button>
          <Link href="/property/dashboard">
            <button className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition">
              {t('common_dashboard')}
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}
