'use client'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/context'

export default function SiteFooter() {
  const { t } = useLanguage()
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-gray-100 bg-white py-8 px-6 mt-4 pb-24 lg:pb-8">
      <div className="max-w-screen-xl mx-auto">
        {/* Desktop: 3-column layout */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-8 mb-8">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">NyumbaFasta</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              {t('cl_footer_desc')}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('cl_footer_links')}</p>
            <div className="space-y-2">
              <Link href="/" className="block text-xs text-gray-500 hover:text-primary-600 hover:underline">{t('cl_footer_search_home')}</Link>
              <Link href="/directory" className="block text-xs text-gray-500 hover:text-primary-600 hover:underline">{t('nav_directory')}</Link>
              <Link href="/blog" className="block text-xs text-gray-500 hover:text-primary-600 hover:underline">{t('cl_footer_blog')}</Link>
              <Link href="/register" className="block text-xs text-gray-500 hover:text-primary-600 hover:underline">{t('cl_footer_register_agent')}</Link>
              <Link href="/advertising" className="block text-xs text-gray-500 hover:text-primary-600 hover:underline">{t('cl_footer_advertise')}</Link>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('cl_footer_help')}</p>
            <div className="space-y-2">
              <Link href="/terms" className="block text-xs text-gray-500 hover:text-primary-600 hover:underline">{t('cl_footer_terms')}</Link>
              <Link href="/privacy" className="block text-xs text-gray-500 hover:text-primary-600 hover:underline">{t('cl_footer_privacy')}</Link>
              <Link href="/data-deletion" className="block text-xs text-gray-500 hover:text-primary-600 hover:underline">{t('cl_footer_data_deletion')}</Link>
              <a href="mailto:support@nyumbafasta.co" className="block text-xs text-gray-500 hover:text-primary-600 hover:underline">support@nyumbafasta.co</a>
            </div>
          </div>
        </div>

        {/* Mobile: centered links */}
        <div className="lg:hidden flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-gray-500 mb-3">
          <Link href="/advertising" className="hover:text-primary-600 hover:underline font-medium">{t('cl_footer_advertise_mob')}</Link>
          <Link href="/blog" className="hover:text-primary-600 hover:underline">{t('cl_footer_blog')}</Link>
          <Link href="/terms" className="hover:text-primary-600 hover:underline">{t('cl_footer_terms')}</Link>
          <Link href="/privacy" className="hover:text-primary-600 hover:underline">{t('cl_footer_privacy')}</Link>
          <Link href="/data-deletion" className="hover:text-primary-600 hover:underline">{t('cl_footer_data_deletion')}</Link>
          <a href="mailto:support@nyumbafasta.co" className="hover:text-primary-600 hover:underline">{t('cl_footer_contact')}</a>
        </div>

        <div className="border-t border-gray-100 lg:pt-6 pt-3">
          <p className="text-center text-xs text-gray-400">
            © {year} NyumbaFasta Tanzania · {t('cl_footer_rights')}
          </p>
        </div>
      </div>
    </footer>
  )
}
