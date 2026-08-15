'use client'
import { useRouter, useParams } from 'next/navigation'
import UploadCreative from '@/components/ads/UploadCreative'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/context'

export default function CampaignCreativePage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const { t }  = useLanguage()

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <Link
          href="/advertising/dashboard"
          className="text-sm text-gray-400 hover:text-gray-600 transition mb-3 inline-block"
        >
          {t('adv_back_to_dashboard')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">{t('adv_upload_creative_title')}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {t('adv_upload_creative_desc')}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <UploadCreative
          campaignId={id}
          onDone={() => router.push('/advertising/dashboard?creative=1')}
          onSkip={() => router.push('/advertising/dashboard')}
        />
      </div>

      {/* What gets generated */}
      <div className="mt-4 bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
        <p className="font-semibold text-gray-700 mb-2">{t('adv_auto_formats')}</p>
        <ul className="space-y-1 text-xs text-gray-500">
          <li>🎯 {t('adv_format_banner')}</li>
          <li>🔍 {t('adv_format_search')}</li>
          <li>📍 {t('adv_format_nearby')}</li>
          <li>⭐ {t('adv_format_featured')}</li>
          <li>🎬 {t('adv_format_thumb')}</li>
        </ul>
      </div>
    </div>
  )
}
