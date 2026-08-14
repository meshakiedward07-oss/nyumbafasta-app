'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/context'

export default function MaliError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useLanguage()
  useEffect(() => {
    console.error('Mali error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-red-100 p-8 max-w-md w-full text-center shadow-sm">
        <div className="text-5xl mb-4 flex justify-center">
          <i className="ti ti-alert-triangle text-amber-400" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{t('common_error_occurred')}</h2>
        <p className="text-sm text-gray-500 mb-1">
          {error.message || t('common_page_error')}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-4 font-mono">ID: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center mt-4">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-primary-500 text-white rounded-xl font-semibold text-sm"
          >
            {t('common_retry')}
          </button>
          <Link href="/">
            <button className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm">
              {t('common_back_home')}
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}
