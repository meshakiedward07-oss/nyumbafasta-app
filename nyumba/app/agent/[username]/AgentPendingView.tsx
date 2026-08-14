'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/context'

interface Props {
  agentName: string
}

export default function AgentPendingView({ agentName }: Props) {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <i className="ti ti-clock text-3xl text-amber-500" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-bold text-gray-800 mb-2">{t('cl_agent_pending_title')}</h1>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          {t('cl_role_dalali')} <strong>{agentName}</strong> {t('cl_agent_pending_suffix')}
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-primary-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
        >
          <i className="ti ti-home" aria-hidden="true" /> {t('cl_footer_search_home')}
        </Link>
      </div>
    </div>
  )
}
