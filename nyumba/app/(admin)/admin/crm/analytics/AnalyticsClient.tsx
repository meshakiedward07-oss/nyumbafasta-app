'use client'
import { useState, useEffect, useCallback } from 'react'
import { PIPELINE_STAGES, SOURCE_LABELS } from '@/lib/crm/constants'

type Stats = {
  totalActive:       number
  byStage:           Record<string, number>
  bySource:          Record<string, number>
  conversionRate:    number
  avgDaysToConvert:  number
  followupsDueToday: number
  uncontacted:       number
}

export default function AnalyticsClient() {
  const [stats, setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/crm/stats')
      const data = await res.json()
      setStats(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 p-4 space-y-4">
        {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-32 animate-pulse" />)}
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Hitilafu kupakia takwimu</p>
      </div>
    )
  }

  // Onboarding funnel (ordered stages)
  const funnelStages = PIPELINE_STAGES.filter(s => s.key !== 'amepotea')
  const topCount = stats.byStage[funnelStages[0]?.key] || 1

  // Sources sorted by count
  const sourcesOrdered = Object.entries(stats.bySource)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8)
  const topSourceCount = sourcesOrdered[0]?.[1] || 1

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-primary-500 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-white font-bold text-lg mb-1"><i className="ti ti-chart-bar" aria-hidden="true" /> CRM Analytics</h1>
        <p className="text-green-100 text-xs">Takwimu za uandikishaji wa madalali watarajiwa</p>
      </header>

      <div className="px-4 py-4 space-y-5">

        {/* Key metrics */}
        <div>
          <p className="font-semibold text-gray-700 mb-3 text-sm flex items-center gap-1.5"><i className="ti ti-target" aria-hidden="true" /> Muhtasari</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: 'Leads Hai',
                value: stats.totalActive,
                icon: 'chart-bar',
                color: 'bg-blue-50 text-blue-700',
              },
              {
                label: 'Conversion Rate',
                value: `${stats.conversionRate}%`,
                icon: 'circle-check',
                color: 'bg-green-50 text-green-700',
              },
              {
                label: 'Follow-up Leo',
                value: stats.followupsDueToday,
                icon: 'clock',
                color: 'bg-amber-50 text-amber-700',
              },
              {
                label: 'Hawajaguswa',
                value: stats.uncontacted,
                icon: 'alert-triangle',
                color: 'bg-red-50 text-red-700',
              },
            ].map((m, i) => (
              <div key={i} className={`${m.color} rounded-2xl p-4`}>
                <i className={`ti ti-${m.icon} text-2xl mb-1`} aria-hidden="true" />
                <div className="font-bold text-xl leading-tight">{m.value}</div>
                <div className="text-xs opacity-70 mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>

          {stats.avgDaysToConvert > 0 && (
            <div className="mt-3 bg-purple-50 rounded-2xl p-4">
              <p className="text-sm font-semibold text-purple-800">
                <i className="ti ti-clock" aria-hidden="true" /> Wastani wa siku {stats.avgDaysToConvert} kutoka lead hadi mfanikiwa
              </p>
              <p className="text-xs text-purple-600 mt-0.5">
                Kwa leads zilizobadilika kuwa madalali kamili
              </p>
            </div>
          )}
        </div>

        {/* Onboarding funnel */}
        <div>
          <p className="font-semibold text-gray-700 mb-3 text-sm flex items-center gap-1.5"><i className="ti ti-rocket" aria-hidden="true" /> Funnel ya Uandikishaji</p>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {funnelStages.map(stage => {
              const count = stats.byStage[stage.key] || 0
              const pct   = Math.round((count / topCount) * 100)
              return (
                <div key={stage.key} className="px-4 py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <i className={`ti ti-${stage.icon} text-base`} aria-hidden="true" />
                      <span className="text-sm font-medium text-gray-700">{stage.label}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{count}</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{stage.description}</p>
                </div>
              )
            })}
            {/* Lost */}
            <div className="px-4 py-3 bg-red-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className="ti ti-x text-base" aria-hidden="true" />
                  <span className="text-sm font-medium text-red-700">Amepotea</span>
                </div>
                <span className="text-sm font-bold text-red-700">
                  {stats.byStage['amepotea'] || 0}
                </span>
              </div>
              <p className="text-xs text-red-400 mt-0.5">
                Hawakufuata — hawapatikani au hawakupenda
              </p>
            </div>
          </div>
        </div>

        {/* Leads by source */}
        {sourcesOrdered.length > 0 && (
          <div>
            <p className="font-semibold text-gray-700 mb-3 text-sm"><i className="ti ti-antenna" aria-hidden="true" /> Chanzo cha Leads</p>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {sourcesOrdered.map(([source, count], i) => {
                const pct = Math.round((count / topSourceCount) * 100)
                const label = SOURCE_LABELS[source] || source.replace(/_/g, ' ')
                return (
                  <div key={i} className="px-4 py-3 border-b border-gray-50 last:border-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                      <span className="text-sm font-bold text-gray-900">{count}</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-primary-500 h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Action items */}
        {(stats.uncontacted > 0 || stats.followupsDueToday > 0) && (
          <div>
            <p className="font-semibold text-gray-700 mb-3 text-sm"><i className="ti ti-bolt" aria-hidden="true" /> Hatua Zinazohitajika</p>
            <div className="space-y-2">
              {stats.uncontacted > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
                  <i className="ti ti-alert-triangle text-2xl" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-sm text-red-700">
                      {stats.uncontacted} leads hawajaguswa bado
                    </p>
                    <p className="text-xs text-red-500 mt-0.5">
                      Wasiliana nao haraka kabla hawajapoteza nia
                    </p>
                  </div>
                </div>
              )}
              {stats.followupsDueToday > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
                  <i className="ti ti-clock-hour-4 text-2xl text-amber-500" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-sm text-amber-700">
                      {stats.followupsDueToday} follow-up zimefika leo
                    </p>
                    <p className="text-xs text-amber-500 mt-0.5">
                      Angalia CRM na wasiliana na leads hizo
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
