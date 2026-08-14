'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/context'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useLanguage()
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-red-100 p-8 max-w-md w-full text-center shadow-sm">
        <div className="text-5xl mb-4 flex justify-center"><i className="ti ti-home-off text-gray-400" aria-hidden="true" /></div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{t('common_sorry_error')}</h2>
        <p className="text-sm text-gray-500 mb-4">
          {error.message || t('common_try_again_msg')}
        </p>
        <div className="flex gap-3 justify-center">
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
