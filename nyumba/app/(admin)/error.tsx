'use client'
import { useEffect } from 'react'
import { useLanguage } from '@/lib/i18n/context'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useLanguage()
  useEffect(() => {
    console.error('Admin error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-red-100 p-8 max-w-md w-full text-center shadow-sm">
        <div className="text-5xl mb-4 flex justify-center"><i className="ti ti-alert-triangle text-amber-500" aria-hidden="true" /></div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{t('common_error_occurred')}</h2>
        <p className="text-sm text-gray-500 mb-1">
          {error.message || t('common_page_error')}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-4 font-mono">ID: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mt-4 px-6 py-3 bg-primary-500 text-white rounded-xl font-semibold text-sm"
        >
          {t('common_retry')}
        </button>
      </div>
    </div>
  )
}
