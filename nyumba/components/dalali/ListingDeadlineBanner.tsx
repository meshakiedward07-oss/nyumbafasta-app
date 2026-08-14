'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/context'

type Status = {
  hasListings: boolean
  listingCount: number
  daysRemaining: number
  daysSince: number
  deadlineDays: number
}

export function ListingDeadlineBanner() {
  const { t } = useLanguage()
  const [status, setStatus] = useState<Status | null>(null)

  useEffect(() => {
    fetch('/api/v1/dalali/listing-status')
      .then(r => r.json())
      .then((data: Status) => {
        if (typeof data?.daysRemaining === 'number') setStatus(data)
      })
      .catch(() => null)
  }, [])

  if (!status || status.hasListings) return null

  const { daysRemaining, daysSince, deadlineDays } = status
  const pct        = Math.min(100, Math.round((daysSince / deadlineDays) * 100))
  const isCritical  = daysRemaining <= 7
  const isUrgent    = daysRemaining <= 14
  const isWarning   = daysRemaining <= 30

  const colorBar  = isCritical ? 'bg-red-500'    : isUrgent ? 'bg-amber-500'    : isWarning ? 'bg-orange-400' : 'bg-blue-500'
  const colorBg   = isCritical ? 'bg-red-50'     : isUrgent ? 'bg-amber-50'     : isWarning ? 'bg-orange-50'  : 'bg-blue-50'
  const colorBdr  = isCritical ? 'border-red-300' : isUrgent ? 'border-amber-300' : isWarning ? 'border-orange-200' : 'border-blue-200'
  const colorHead = isCritical ? 'text-red-800'  : isUrgent ? 'text-amber-800'  : isWarning ? 'text-orange-800' : 'text-blue-800'
  const colorSub  = isCritical ? 'text-red-600'  : isUrgent ? 'text-amber-600'  : isWarning ? 'text-orange-600' : 'text-blue-600'
  const colorBtn  = isCritical ? 'bg-red-600 hover:bg-red-700' : isUrgent ? 'bg-amber-500 hover:bg-amber-600' : isWarning ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'
  const iconName  = isCritical ? 'alarm' : isUrgent ? 'alert-triangle' : isWarning ? 'clock' : 'info-circle'

  const heading = isCritical
    ? t('dal_deadline_critical').replace('{{n}}', String(daysRemaining))
    : isUrgent
    ? t('dal_deadline_urgent').replace('{{n}}', String(daysRemaining))
    : isWarning
    ? t('dal_deadline_warning').replace('{{n}}', String(daysRemaining))
    : t('dal_deadline_info').replace('{{n}}', String(daysRemaining))

  return (
    <div className={`rounded-xl p-4 mb-4 border-2 ${colorBg} ${colorBdr}`}>
      <div className="flex items-start gap-3">
        <i className={`ti ti-${iconName} text-xl flex-shrink-0`} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm ${colorHead}`}>{heading}</p>
          <p className={`text-xs mt-0.5 ${colorSub}`}>
            {t('dal_deadline_auto_del').replace('{{n}}', String(deadlineDays))}
          </p>
        </div>
        <Link
          href="/dashboard/listings/new"
          className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold text-white ${colorBtn}`}
        >
          {t('dal_deadline_add')}
        </Link>
      </div>

      <div className="mt-3">
        <div className={`flex justify-between text-xs mb-1 ${colorSub}`}>
          <span>{t('dal_deadline_registered')}</span>
          <span>{daysSince}/{deadlineDays} {t('dal_days_unit')}</span>
          <span>{t('dal_deadline_deleted')}</span>
        </div>
        <div className="w-full bg-white/70 rounded-full h-1.5">
          <div className={`h-1.5 rounded-full transition-all ${colorBar}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}
