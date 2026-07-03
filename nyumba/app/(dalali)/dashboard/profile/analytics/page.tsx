'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface AnalyticsData {
  username: string | null
  viewsToday:  number
  viewsWeek:   number
  viewsMonth:  number
  viewsTotal:  number
  whatsappClicks: number
  shareCount:  number
  sources: Record<string, number>
  clicks:  Record<string, number>
}

const SOURCE_ICONS: Record<string, string> = {
  whatsapp:  'ti-brand-whatsapp',
  facebook:  'ti-brand-facebook',
  instagram: 'ti-brand-instagram',
  tiktok:    'ti-brand-tiktok',
  twitter:   'ti-brand-twitter',
  google:    'ti-brand-google',
  direct:    'ti-link',
  other:     'ti-world',
}

const SOURCE_LABELS: Record<string, string> = {
  whatsapp:  'WhatsApp',
  facebook:  'Facebook',
  instagram: 'Instagram',
  tiktok:    'TikTok',
  twitter:   'Twitter/X',
  google:    'Google',
  direct:    'Moja kwa moja',
  other:     'Nyingine',
}

export default function ProfileAnalyticsPage() {
  const [data, setData]     = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/v1/profile/analytics')
      .then(r => r.json())
      .then((d: AnalyticsData & { error?: string }) => {
        if (d.error) { setError(d.error); return }
        setData(d)
      })
      .catch(() => setError('Imeshindwa kupakia data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center text-gray-500">
        <i className="ti ti-chart-off text-3xl block mb-3" aria-hidden="true" />
        <p className="text-sm">{error ?? 'Hakuna data'}</p>
        <Link href="/dashboard/profile/username" className="text-xs text-primary-500 underline mt-2 inline-block">
          Weka username kwanza
        </Link>
      </div>
    )
  }

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
  const profileUrl = data.username ? `${APP_URL}/agent/${data.username}` : null
  const totalSources = Object.values(data.sources).reduce((s, v) => s + v, 0)

  const statCards = [
    { label: 'Leo',       value: data.viewsToday,  icon: 'ti-eye'        },
    { label: 'Wiki hii',  value: data.viewsWeek,   icon: 'ti-chart-line' },
    { label: 'Mwezi huu', value: data.viewsMonth,  icon: 'ti-calendar'   },
    { label: 'Jumla yote',value: data.viewsTotal,  icon: 'ti-chart-bar'  },
    { label: 'WhatsApp clicks', value: data.whatsappClicks, icon: 'ti-brand-whatsapp' },
    { label: 'Walioshare', value: data.shareCount, icon: 'ti-share'      },
  ]

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div>
        <Link href="/dashboard/profile/username" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-3">
          <i className="ti ti-arrow-left text-xs" aria-hidden="true" /> Rudi
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Analytics ya profile</h1>
        {profileUrl && (
          <a href={profileUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-primary-500 font-mono mt-0.5 inline-block hover:underline">
            nyumbafasta.co/agent/{data.username}
          </a>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <i className={`ti ${s.icon} text-2xl text-gray-200 block mb-2`} aria-hidden="true" />
            <p className="text-2xl font-bold text-gray-900">{s.value.toLocaleString('sw-TZ')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Traffic sources */}
      {Object.keys(data.sources).length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Wamekuja kutoka wapi (mwezi huu)
          </h2>
          <div className="space-y-3">
            {Object.entries(data.sources)
              .sort(([, a], [, b]) => b - a)
              .map(([source, count]) => {
                const pct = totalSources > 0 ? Math.round((count / totalSources) * 100) : 0
                return (
                  <div key={source}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <i className={`ti ${SOURCE_ICONS[source] ?? 'ti-world'} text-base text-gray-400`} aria-hidden="true" />
                        {SOURCE_LABELS[source] ?? source}
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {count} <span className="text-xs font-normal text-gray-400">({pct}%)</span>
                      </span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Click breakdown */}
      {Object.keys(data.clicks).length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Vitendo vya wateja (mwezi huu)</h2>
          <div className="space-y-2">
            {[
              { key: 'whatsapp_click',       label: 'Waliobonyeza Wasiliana',   icon: 'ti-lock' },
              { key: 'share_click',           label: 'Walioshare profile',       icon: 'ti-share' },
              { key: 'listing_view',          label: 'Waliangalia listing',      icon: 'ti-home' },
              { key: 'explore_nyumbafasta',   label: 'Walikwenda NyumbaFasta',  icon: 'ti-home-2' },
            ].filter(item => data.clicks[item.key]).map(item => (
              <div key={item.key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <i className={`ti ${item.icon} text-gray-400`} aria-hidden="true" />
                  {item.label}
                </div>
                <span className="text-sm font-semibold text-gray-900">{data.clicks[item.key]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.viewsTotal === 0 && (
        <div className="text-center py-8 text-gray-400">
          <i className="ti ti-chart-bar text-4xl block mb-3" aria-hidden="true" />
          <p className="text-sm font-medium">Hakuna data bado</p>
          <p className="text-xs mt-1">Share link yako ili watu watembelee profile yako</p>
          {profileUrl && (
            <button
              onClick={() => navigator.clipboard.writeText(profileUrl).catch(() => {})}
              className="mt-3 px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
            >
              <i className="ti ti-copy text-xs" aria-hidden="true" />
              Nakili link yako
            </button>
          )}
        </div>
      )}
    </div>
  )
}
