'use client'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/context'

export default function PlatformSettingsPage() {
  const { t } = useLanguage()
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{t('adm_c_settings_title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('adm_c_settings_subtitle')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/admin/whatsapp"
          className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 flex items-start gap-4 hover:border-primary-200 hover:shadow-md transition-all group">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-green-100 transition-colors">
            <i className="ti ti-brand-whatsapp text-green-600 text-lg" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{t('adm_c_settings_wa_title')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t('adm_c_settings_wa_desc')}</p>
          </div>
        </Link>

        <Link href="/admin/adverts"
          className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 flex items-start gap-4 hover:border-primary-200 hover:shadow-md transition-all group">
          <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-orange-100 transition-colors">
            <i className="ti ti-bug text-orange-500 text-lg" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{t('adm_c_settings_diag_title')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t('adm_c_settings_diag_desc')}</p>
          </div>
        </Link>

        <Link href="/admin/accounting?tab=bei"
          className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 flex items-start gap-4 hover:border-primary-200 hover:shadow-md transition-all group">
          <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100 transition-colors">
            <i className="ti ti-tag text-primary-600 text-lg" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{t('adm_c_settings_pricing_title')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t('adm_c_settings_pricing_desc')}</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
