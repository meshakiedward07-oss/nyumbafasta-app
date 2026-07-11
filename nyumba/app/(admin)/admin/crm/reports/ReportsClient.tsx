'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Period = 'daily' | 'weekly' | 'monthly'

type ReportData = {
  new_leads: number
  contacted: number
  closed: number
  lost: number
  total_revenue: number
  avg_response_time_hours: number
  top_source: string
  top_region: string
}

const emptyReport: ReportData = {
  new_leads: 0, contacted: 0, closed: 0, lost: 0,
  total_revenue: 0, avg_response_time_hours: 0, top_source: '—', top_region: '—',
}

export default function ReportsClient() {
  const supabase = createClient()
  const [period, setPeriod] = useState<Period>('weekly')
  const [report, setReport] = useState<ReportData>(emptyReport)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const startDate = new Date()
      if (period === 'daily') startDate.setHours(0, 0, 0, 0)
      else if (period === 'weekly') startDate.setDate(startDate.getDate() - 7)
      else startDate.setMonth(startDate.getMonth() - 1)

      const { data: leads } = await supabase
        .from('agent_leads')
        .select('pipeline_stage, source, region, deal_value, created_at, first_contacted_at')
        .gte('created_at', startDate.toISOString())

      if (!leads) { setReport(emptyReport); return }

      const sourceCounts: Record<string, number> = {}
      const regionCounts: Record<string, number> = {}
      let totalRevenue = 0
      let totalResponseMs = 0
      let responseSamples = 0

      leads.forEach(l => {
        sourceCounts[l.source] = (sourceCounts[l.source] || 0) + 1
        regionCounts[l.region] = (regionCounts[l.region] || 0) + 1
        if (l.pipeline_stage === 'closed' && l.deal_value) totalRevenue += l.deal_value
        if (l.first_contacted_at && l.created_at) {
          const diff = new Date(l.first_contacted_at).getTime() - new Date(l.created_at).getTime()
          if (diff > 0) { totalResponseMs += diff; responseSamples++ }
        }
      })

      const topSource = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
      const topRegion = Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
      const avgResponseHours = responseSamples > 0
        ? Math.round((totalResponseMs / responseSamples) / (1000 * 60 * 60))
        : 0

      setReport({
        new_leads: leads.filter(l => l.pipeline_stage === 'new').length,
        contacted: leads.filter(l => ['contacted', 'interested', 'viewing_scheduled', 'negotiation'].includes(l.pipeline_stage)).length,
        closed: leads.filter(l => l.pipeline_stage === 'closed').length,
        lost: leads.filter(l => l.pipeline_stage === 'lost').length,
        total_revenue: totalRevenue,
        avg_response_time_hours: avgResponseHours,
        top_source: topSource.replace(/_/g, ' '),
        top_region: topRegion,
      })
    } finally {
      setLoading(false)
    }
  }, [period, supabase])

  useEffect(() => { fetchReport() }, [fetchReport])

  async function exportCSV() {
    setExporting(true)
    try {
      const startDate = new Date()
      if (period === 'daily') startDate.setHours(0, 0, 0, 0)
      else if (period === 'weekly') startDate.setDate(startDate.getDate() - 7)
      else startDate.setMonth(startDate.getMonth() - 1)

      const { data } = await supabase
        .from('agent_leads')
        .select('business_name, phone, source, region, pipeline_stage, ai_score, deal_value, created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })

      if (!data) return

      const headers = ['Jina', 'Simu', 'Source', 'Mkoa', 'Stage', 'Score', 'Deal Value', 'Tarehe']
      const rows = data.map(d => [
        d.business_name, d.phone, d.source, d.region,
        d.pipeline_stage, d.ai_score, d.deal_value || '', d.created_at,
      ])
      const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `crm-report-${period}-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const periodLabel = { daily: 'Leo', weekly: 'Wiki hii', monthly: 'Mwezi huu' }[period]

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-primary-500 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-white font-bold text-lg"><i className="ti ti-clipboard-list" aria-hidden="true" /> CRM Reports</h1>
          <button onClick={exportCSV} disabled={exporting}
            className="bg-white text-primary-500 text-xs px-4 py-2 rounded-xl font-bold disabled:opacity-50">
            {exporting ? 'Exporting...' : <><i className="ti ti-download" aria-hidden="true" /> CSV</>}
          </button>
        </div>
        <div className="flex gap-2">
          {(['daily', 'weekly', 'monthly'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`text-xs px-4 py-2 rounded-xl font-medium transition-all ${
                period === p ? 'bg-white text-primary-500' : 'bg-white/20 text-white'
              }`}>
              {p === 'daily' ? 'Leo' : p === 'weekly' ? 'Wiki' : 'Mwezi'}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 py-4 space-y-5">
        <div className="bg-primary-500/5 border border-primary-500/20 rounded-2xl p-4">
          <p className="text-primary-500 font-semibold text-sm"><i className="ti ti-calendar" aria-hidden="true" /> Ripoti ya {periodLabel}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {period === 'daily' ? 'Tangu saa 12 usiku wa leo' :
             period === 'weekly' ? 'Siku 7 zilizopita' : 'Mwezi uliopita'}
          </p>
        </div>

        {/* Conversion funnel */}
        <div>
          <p className="font-semibold text-gray-700 mb-3"><i className="ti ti-git-branch" aria-hidden="true" /> Conversion Funnel</p>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-xl animate-pulse mb-2" />
            ))
          ) : (
            <div className="space-y-2">
              {[
                { label: 'Leads Mpya', value: report.new_leads, icon: 'square-rounded-plus', color: 'bg-blue-500' },
                { label: 'Kuwasiliana', value: report.contacted, icon: 'phone', color: 'bg-yellow-500' },
                { label: 'Zilizofungwa', value: report.closed, icon: 'circle-check', color: 'bg-green-500' },
                { label: 'Zilizopotea', value: report.lost, icon: 'circle-x', color: 'bg-red-400' },
              ].map((item, i) => {
                const total = report.new_leads || 1
                const pct = Math.round((item.value / total) * 100)
                return (
                  <div key={i} className="bg-white rounded-xl p-4 flex items-center gap-4">
                    <i className={`ti ti-${item.icon} text-xl`} aria-hidden="true" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700">{item.label}</span>
                        <span className="font-bold text-sm">{item.value}</span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-2">
                        <div className={`${item.color} h-2 rounded-full transition-all`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{pct}% ya leads zote</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Key Metrics */}
        <div>
          <p className="font-semibold text-gray-700 mb-3 flex items-center gap-1.5"><i className="ti ti-chart-bar" aria-hidden="true" /> Viashiria Vikuu</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: 'Revenue Jumla',
                value: `Tsh ${report.total_revenue.toLocaleString()}`,
                icon: 'coin', color: 'bg-green-50 text-green-700',
              },
              {
                label: 'Wastani Muda wa Kujibu',
                value: `Saa ${report.avg_response_time_hours}`,
                icon: 'clock-hour-3', color: 'bg-blue-50 text-blue-700',
              },
              {
                label: 'Top Source',
                value: report.top_source,
                icon: 'radio', color: 'bg-purple-50 text-purple-700',
              },
              {
                label: 'Mkoa Mkubwa',
                value: report.top_region,
                icon: 'map-pin', color: 'bg-orange-50 text-orange-700',
              },
            ].map((m, i) => (
              <div key={i} className={`${m.color} rounded-2xl p-4`}>
                <i className={`ti ti-${m.icon} text-2xl mb-1`} aria-hidden="true" />
                <div className="font-bold text-sm leading-tight">{m.value}</div>
                <div className="text-xs opacity-70 mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Conversion rate */}
        {report.new_leads > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <p className="font-semibold text-gray-700 mb-3"><i className="ti ti-target" aria-hidden="true" /> Conversion Rate</p>
            <div className="text-5xl font-bold text-primary-500 mb-1">
              {Math.round((report.closed / (report.new_leads || 1)) * 100)}%
            </div>
            <p className="text-sm text-gray-500">
              Leads {report.closed} zimefungwa kati ya {report.new_leads} zilizoingia
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
