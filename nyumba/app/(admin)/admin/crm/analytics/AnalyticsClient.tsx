'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type StatItem = { source?: string; stage?: string; count: number }
type DalaliStat = { id: string; name: string; leads: number; closed: number; revenue: number }
type RevenueStats = { total_deals: number; total_revenue: number; total_commission: number; avg_deal_value: number }

const sourceEmojis: Record<string, string> = {
  google_maps: '🗺️', google_business: '🏢', facebook_groups: '👥',
  facebook_pages: '📘', instagram: '📸', tiktok: '🎵', manual: '✍️',
}
const stageEmojis: Record<string, string> = {
  new: '🆕', contacted: '📞', interested: '❤️',
  viewing_scheduled: '🏠', negotiation: '🤝', closed: '✅', lost: '❌',
}

export default function AnalyticsClient() {
  const supabase = createClient()
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week')
  const [sourceStats, setSourceStats] = useState<StatItem[]>([])
  const [stageStats, setStageStats] = useState<StatItem[]>([])
  const [dalaliStats, setDalaliStats] = useState<DalaliStat[]>([])
  const [revenueStats, setRevenueStats] = useState<RevenueStats>({
    total_deals: 0, total_revenue: 0, total_commission: 0, avg_deal_value: 0,
  })
  const [loading, setLoading] = useState(true)

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const now = new Date()
      const startDate = new Date()
      if (period === 'today') startDate.setHours(0, 0, 0, 0)
      else if (period === 'week') startDate.setDate(now.getDate() - 7)
      else startDate.setMonth(now.getMonth() - 1)

      const { data: leads } = await supabase
        .from('agent_leads')
        .select('source, pipeline_stage, ai_score, deal_value')
        .gte('created_at', startDate.toISOString())

      // By source
      const sourceCounts: Record<string, number> = {}
      leads?.forEach(l => { sourceCounts[l.source] = (sourceCounts[l.source] || 0) + 1 })
      setSourceStats(
        Object.entries(sourceCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([source, count]) => ({ source, count }))
      )

      // By stage
      const stageCounts: Record<string, number> = {}
      leads?.forEach(l => {
        const stage = l.pipeline_stage || 'new'
        stageCounts[stage] = (stageCounts[stage] || 0) + 1
      })
      setStageStats(Object.entries(stageCounts).map(([stage, count]) => ({ stage, count })))

      // Revenue
      const closedLeads = leads?.filter(l => l.pipeline_stage === 'closed' && l.deal_value) || []
      const totalRevenue = closedLeads.reduce((sum, l) => sum + (l.deal_value || 0), 0)
      setRevenueStats({
        total_deals: closedLeads.length,
        total_revenue: totalRevenue,
        total_commission: Math.floor(totalRevenue * 0.05),
        avg_deal_value: closedLeads.length ? Math.floor(totalRevenue / closedLeads.length) : 0,
      })

      // Dalali performance
      const { data: assignments } = await supabase
        .from('agent_leads')
        .select('assigned_to, pipeline_stage, deal_value, dalali:assigned_to(full_name)')
        .not('assigned_to', 'is', null)
        .gte('created_at', startDate.toISOString())

      const dalaliMap: Record<string, DalaliStat> = {}
      assignments?.forEach(a => {
        if (!a.assigned_to) return
        if (!dalaliMap[a.assigned_to]) {
          dalaliMap[a.assigned_to] = {
            id: a.assigned_to,
            name: (a.dalali as { full_name?: string } | null)?.full_name || 'Unknown',
            leads: 0, closed: 0, revenue: 0,
          }
        }
        dalaliMap[a.assigned_to].leads++
        if (a.pipeline_stage === 'closed') {
          dalaliMap[a.assigned_to].closed++
          dalaliMap[a.assigned_to].revenue += a.deal_value || 0
        }
      })
      setDalaliStats(Object.values(dalaliMap).sort((a, b) => b.closed - a.closed))
    } finally {
      setLoading(false)
    }
  }, [period, supabase])

  useEffect(() => { fetchAnalytics() }, [fetchAnalytics])

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-[#1D9E75] px-4 py-4 sticky top-0 z-10">
        <h1 className="text-white font-bold text-lg mb-3">📊 CRM Analytics</h1>
        <div className="flex gap-2">
          {(['today', 'week', 'month'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`text-xs px-4 py-2 rounded-xl font-medium transition-all ${
                period === p ? 'bg-white text-[#1D9E75]' : 'bg-white/20 text-white'
              }`}>
              {p === 'today' ? 'Leo' : p === 'week' ? 'Wiki' : 'Mwezi'}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 py-4 space-y-5">

        {/* Revenue */}
        <div>
          <p className="font-semibold text-gray-700 mb-3">💰 Revenue Overview</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Deals Zilizofungwa', value: revenueStats.total_deals, emoji: '✅', color: 'bg-green-50 text-green-700' },
              { label: 'Jumla Revenue', value: `Tsh ${revenueStats.total_revenue.toLocaleString()}`, emoji: '💰', color: 'bg-blue-50 text-blue-700' },
              { label: 'Commission', value: `Tsh ${revenueStats.total_commission.toLocaleString()}`, emoji: '🏦', color: 'bg-purple-50 text-purple-700' },
              { label: 'Wastani kwa Deal', value: `Tsh ${revenueStats.avg_deal_value.toLocaleString()}`, emoji: '📈', color: 'bg-orange-50 text-orange-700' },
            ].map((stat, i) => (
              <div key={i} className={`${stat.color} rounded-2xl p-4`}>
                <div className="text-2xl mb-1">{stat.emoji}</div>
                <div className="font-bold text-lg leading-tight">{stat.value}</div>
                <div className="text-xs opacity-70 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Source Analytics */}
        <div>
          <p className="font-semibold text-gray-700 mb-3">📡 Leads kwa Source</p>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : sourceStats.length === 0 ? (
              <p className="text-gray-400 text-sm p-4 text-center">Hakuna data</p>
            ) : sourceStats.map((s, i) => {
              const max = sourceStats[0]?.count || 1
              const pct = Math.round(((s.count) / max) * 100)
              return (
                <div key={i} className="px-4 py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span>{sourceEmojis[s.source || ''] || '📌'}</span>
                      <span className="text-sm font-medium text-gray-700">
                        {(s.source || '').replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{s.count}</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2">
                    <div className="bg-[#1D9E75] h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pipeline Funnel */}
        <div>
          <p className="font-semibold text-gray-700 mb-3">🎯 Pipeline Funnel</p>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {stageStats.map((s, i) => (
              <div key={i} className="px-4 py-3 border-b border-gray-50 last:border-0 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{stageEmojis[s.stage || ''] || '📌'}</span>
                  <span className="text-sm text-gray-700 capitalize">{(s.stage || '').replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-gray-100 rounded-full h-2 w-24">
                    <div className="bg-[#1D9E75] h-2 rounded-full"
                      style={{ width: `${Math.round((s.count / (stageStats[0]?.count || 1)) * 100)}%` }} />
                  </div>
                  <span className="text-sm font-bold w-8 text-right">{s.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dalali Performance */}
        <div>
          <p className="font-semibold text-gray-700 mb-3">👑 Dalali Performance</p>
          {dalaliStats.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-gray-100">
              <p className="text-gray-400 text-sm">Hakuna leads zilizopewa madalali bado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dalaliStats.map((d, i) => (
                <div key={d.id} className="bg-white rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#1D9E75] flex items-center justify-center text-white font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{d.name}</p>
                      <p className="text-xs text-gray-400">
                        Conversion: {d.leads > 0 ? Math.round((d.closed / d.leads) * 100) : 0}%
                      </p>
                    </div>
                    {i === 0 && <span className="text-2xl">🏆</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Leads', value: d.leads, color: 'text-blue-600' },
                      { label: 'Closed', value: d.closed, color: 'text-green-600' },
                      { label: 'Revenue', value: `${(d.revenue / 1000).toFixed(0)}k`, color: 'text-purple-600' },
                    ].map((stat, j) => (
                      <div key={j} className="text-center bg-gray-50 rounded-xl py-2">
                        <p className={`font-bold text-lg ${stat.color}`}>{stat.value}</p>
                        <p className="text-xs text-gray-400">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
