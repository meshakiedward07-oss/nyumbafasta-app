'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import LeadDetailModal from './LeadDetailModal'

const PIPELINE_STAGES = [
  { id: 'new',               label: 'Mpya',       color: 'bg-blue-500',   emoji: '🆕' },
  { id: 'contacted',         label: 'Amepigiwa',  color: 'bg-yellow-500', emoji: '📞' },
  { id: 'interested',        label: 'Anapenda',   color: 'bg-orange-500', emoji: '❤️' },
  { id: 'viewing_scheduled', label: 'Viewing',    color: 'bg-purple-500', emoji: '🏠' },
  { id: 'negotiation',       label: 'Mazungumzo', color: 'bg-indigo-500', emoji: '🤝' },
  { id: 'closed',            label: 'Imefungwa',  color: 'bg-green-500',  emoji: '✅' },
  { id: 'lost',              label: 'Imepotea',   color: 'bg-red-500',    emoji: '❌' },
]

type Lead = {
  id: string
  business_name?: string
  phone?: string
  whatsapp?: string
  email?: string
  region?: string
  source?: string
  ai_score?: number
  ai_notes?: string
  pipeline_stage?: string
  preferred_location?: string
  budget_min?: number
  budget_max?: number
  property_type?: string
  bedrooms?: number
  created_at: string
}

type Stats = { total: number; today: number; closed: number; hot: number }

export default function CRMClient() {
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, closed: 0, hot: 0 })

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('agent_leads')
      .select('*')
      .order('created_at', { ascending: false })
    setLeads((data as Lead[]) || [])
    setLoading(false)
  }, [supabase])

  const fetchStats = useCallback(async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [total, todayLeads, closed, hot] = await Promise.all([
      supabase.from('agent_leads').select('id', { count: 'exact', head: true }),
      supabase.from('agent_leads').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabase.from('agent_leads').select('id', { count: 'exact', head: true }).eq('pipeline_stage', 'closed'),
      supabase.from('agent_leads').select('id', { count: 'exact', head: true }).gte('ai_score', 80),
    ])

    setStats({
      total: total.count || 0,
      today: todayLeads.count || 0,
      closed: closed.count || 0,
      hot: hot.count || 0,
    })
  }, [supabase])

  useEffect(() => {
    fetchLeads()
    fetchStats()
  }, [fetchLeads, fetchStats])

  async function moveLeadToStage(leadId: string, stage: string) {
    await supabase
      .from('agent_leads')
      .update({ pipeline_stage: stage })
      .eq('id', leadId)
    fetchLeads()
  }

  function getLeadsByStage(stage: string) {
    return leads.filter(l => (l.pipeline_stage || 'new') === stage)
  }

  function getScoreEmoji(score: number) {
    if (score >= 80) return '🔥'
    if (score >= 50) return '🌡️'
    return '❄️'
  }

  const stageColorMap = Object.fromEntries(PIPELINE_STAGES.map(s => [s.id, s.color]))

  function getScoreColor(score: number) {
    if (score >= 80) return 'text-green-600 bg-green-100'
    if (score >= 50) return 'text-yellow-600 bg-yellow-100'
    return 'text-gray-500 bg-gray-100'
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* ════════════════════════════════
          DESKTOP VIEW
      ════════════════════════════════ */}
      <div className="hidden lg:block p-6">
        {/* Desktop header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🎯 CRM — Lead Pipeline</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Leads {stats.total} · Leo +{stats.today} · 🔥 Hot {stats.hot} · ✅ Closed {stats.closed}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setView('pipeline')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                view === 'pipeline' ? 'bg-[#1D9E75] text-white' : 'bg-white border border-gray-200 text-gray-600'
              }`}>
              🎯 Pipeline
            </button>
            <button onClick={() => setView('list')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                view === 'list' ? 'bg-[#1D9E75] text-white' : 'bg-white border border-gray-200 text-gray-600'
              }`}>
              📋 List
            </button>
          </div>
        </div>

        {/* Desktop pipeline — 7 columns */}
        {view === 'pipeline' && (
          <div className="grid grid-cols-7 gap-3">
            {PIPELINE_STAGES.map(stage => (
              <div key={stage.id} className="flex flex-col min-h-64">
                {/* Stage header */}
                <div className={`${stage.color} rounded-xl px-3 py-2 mb-3 text-center`}>
                  <p className="text-white font-semibold text-xs">{stage.emoji} {stage.label}</p>
                  <p className="text-white/80 text-xs">{getLeadsByStage(stage.id).length}</p>
                </div>
                {/* Stage leads */}
                <div className="space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-280px)]">
                  {loading && <div className="bg-white rounded-xl h-16 animate-pulse" />}
                  {getLeadsByStage(stage.id).map(lead => (
                    <div
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className="bg-white rounded-xl p-3 border border-gray-100 cursor-pointer
                        hover:shadow-md transition-all hover:-translate-y-0.5"
                    >
                      <p className="font-semibold text-xs text-gray-800 line-clamp-2 mb-1">
                        {lead.business_name}
                      </p>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400 truncate">{lead.region?.slice(0, 12)}</span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${getScoreColor(lead.ai_score || 0)}`}>
                          {lead.ai_score || 0}
                        </span>
                      </div>
                      {lead.phone && (
                        <p className="text-xs text-gray-400">📞 {lead.phone}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Desktop list view */}
        {view === 'list' && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Biashara', 'Simu', 'Mkoa', 'Stage', 'Score', 'Tarehe', 'Hatua'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.map(lead => (
                  <tr key={lead.id} onClick={() => setSelectedLead(lead)}
                    className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>{getScoreEmoji(lead.ai_score || 0)}</span>
                        <div>
                          <p className="font-medium text-sm">{lead.business_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()}
                        className="text-sm text-blue-600 hover:underline">{lead.phone || '—'}</a>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">📍 {lead.region || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full text-white ${
                        stageColorMap[lead.pipeline_stage || 'new'] || 'bg-gray-400'
                      }`}>
                        {PIPELINE_STAGES.find(s => s.id === (lead.pipeline_stage || 'new'))?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getScoreColor(lead.ai_score || 0)}`}>
                        {lead.ai_score || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400">
                        {new Date(lead.created_at).toLocaleDateString('sw-TZ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {lead.whatsapp && (
                        <a href={`https://wa.me/${lead.whatsapp.replace(/[^0-9]/g, '')}`}
                          target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="bg-[#25D366] text-white text-xs px-2.5 py-1.5 rounded-lg">
                          💬 WA
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && leads.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-16 text-gray-400">Hakuna leads bado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ════════════════════════════════
          MOBILE VIEW
      ════════════════════════════════ */}
      <div className="lg:hidden">

      {/* Header */}
      <header className="bg-[#1D9E75] sticky top-0 z-10 px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-white font-bold text-lg">🎯 CRM — Lead Pipeline</h1>
            <p className="text-green-100 text-xs">
              Leads {stats.total} | Leo +{stats.today} | 🔥 Hot {stats.hot}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setView('pipeline')}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                view === 'pipeline' ? 'bg-white text-[#1D9E75]' : 'bg-white/20 text-white'
              }`}
            >
              🎯 Pipeline
            </button>
            <button
              onClick={() => setView('list')}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                view === 'list' ? 'bg-white text-[#1D9E75]' : 'bg-white/20 text-white'
              }`}
            >
              📋 List
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Jumla',  value: stats.total,  emoji: '📊' },
            { label: 'Leo',    value: stats.today,  emoji: '🆕' },
            { label: 'Closed', value: stats.closed, emoji: '✅' },
            { label: 'Hot',    value: stats.hot,    emoji: '🔥' },
          ].map((s, i) => (
            <div key={i} className="bg-white/20 rounded-xl p-2 text-center">
              <div className="text-lg">{s.emoji}</div>
              <div className="text-white font-bold text-sm">{s.value}</div>
              <div className="text-green-100 text-xs">{s.label}</div>
            </div>
          ))}
        </div>
      </header>

      {/* ── PIPELINE VIEW ── */}
      {view === 'pipeline' && (
        <div className="overflow-x-auto px-4 py-4">
          <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
            {PIPELINE_STAGES.map(stage => (
              <div key={stage.id} className="w-72 flex-shrink-0">
                <div className={`${stage.color} rounded-xl px-3 py-2 mb-3 flex items-center justify-between`}>
                  <span className="text-white font-semibold text-sm">
                    {stage.emoji} {stage.label}
                  </span>
                  <span className="bg-white/30 text-white text-xs px-2 py-0.5 rounded-full">
                    {getLeadsByStage(stage.id).length}
                  </span>
                </div>

                <div className="space-y-2 min-h-20">
                  {loading && <div className="bg-white rounded-xl h-20 animate-pulse" />}
                  {getLeadsByStage(stage.id).map(lead => (
                    <div
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className="bg-white rounded-xl p-3 border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-gray-800 line-clamp-1">
                            {lead.business_name}
                          </p>
                          {lead.phone && (
                            <p className="text-xs text-gray-400">📞 {lead.phone}</p>
                          )}
                        </div>
                        <span className="text-lg ml-1">{getScoreEmoji(lead.ai_score || 0)}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                          📍 {lead.region || 'Haijulikani'}
                        </span>
                        <span className="text-xs font-bold text-gray-600">
                          {lead.ai_score || 0}pts
                        </span>
                      </div>

                      {/* Move buttons — next 2 stages */}
                      <div className="flex gap-1 mt-2">
                        {PIPELINE_STAGES
                          .filter(s => s.id !== stage.id)
                          .slice(0, 2)
                          .map(s => (
                            <button
                              key={s.id}
                              onClick={e => { e.stopPropagation(); moveLeadToStage(lead.id, s.id) }}
                              className={`text-xs px-2 py-0.5 rounded-full text-white ${s.color}`}
                            >
                              → {s.label}
                            </button>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <div className="px-4 py-4 space-y-3">
          {leads.map(lead => (
            <div
              key={lead.id}
              onClick={() => setSelectedLead(lead)}
              className="bg-white rounded-2xl p-4 border border-gray-100 cursor-pointer hover:shadow-md"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getScoreEmoji(lead.ai_score || 0)}</span>
                    <p className="font-semibold text-gray-900">{lead.business_name}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    📍 {lead.region} · 📞 {lead.phone || 'Haipo'}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full text-white ${
                  stageColorMap[lead.pipeline_stage || 'new'] || 'bg-gray-400'
                }`}>
                  {PIPELINE_STAGES.find(s => s.id === (lead.pipeline_stage || 'new'))?.label}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-2 items-center">
                  {lead.whatsapp && (
                    <a
                      href={`https://wa.me/${lead.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Habari! Ninawasiliana nawe kuhusu nyumba.')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="bg-[#25D366] text-white text-xs px-2 py-1 rounded-lg"
                    >
                      💬 WA
                    </a>
                  )}
                  <span className="text-xs text-gray-400">Score: {lead.ai_score || 0}/100</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(lead.created_at).toLocaleDateString('sw-TZ')}
                </span>
              </div>
            </div>
          ))}

          {!loading && leads.length === 0 && (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">🎯</div>
              <p className="text-gray-500 font-medium">Hakuna leads bado</p>
            </div>
          )}
        </div>
      )}

      </div> {/* end lg:hidden mobile view */}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={fetchLeads}
          stages={PIPELINE_STAGES}
        />
      )}
    </div>
  )
}
