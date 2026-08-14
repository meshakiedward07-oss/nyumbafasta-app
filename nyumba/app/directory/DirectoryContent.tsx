'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/context'

interface Props {
  cities: string[]
}

export default function DirectoryContent({ cities }: Props) {
  const { t } = useLanguage()

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">⭐ {t('cl_dir_title')}</h1>
        <p className="text-gray-500">{t('cl_dir_subtitle')}</p>
      </div>

      {cities.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">🏙️</div>
          <h2 className="text-xl font-bold text-gray-600 mb-2">{t('cl_dir_empty_title')}</h2>
          <p className="text-sm">{t('cl_dir_empty_body')}</p>
          <Link
            href="/advertising/register"
            className="inline-block mt-4 bg-primary-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary-600 transition"
          >
            {t('cl_dir_register_free')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {cities.map(city => (
            <Link
              key={city}
              href={`/directory/${encodeURIComponent(city)}`}
              className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-primary-300 transition text-center"
            >
              <div className="text-3xl mb-2">🏙️</div>
              <h2 className="font-bold text-gray-800">{city}</h2>
              <p className="text-sm text-primary-600 mt-1">{t('cl_dir_view_biz')}</p>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 text-center">
        <p className="text-sm text-gray-400">
          {t('cl_dir_has_biz')}{' '}
          <Link href="/advertising" className="text-primary-600 hover:underline font-medium">
            {t('cl_dir_advertise')}
          </Link>
        </p>
      </div>
    </div>
  )
}
