'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const STAGES = [
  { id: 'new',        label: 'Mpya',       emoji: '🆕', color: 'bg-blue-100 text-blue-700' },
  { id: 'contacted',  label: 'Amepigiwa',  emoji: '📞', color: 'bg-yellow-100 text-yellow-700' },
  { id: 'interested', label: 'Anapenda',   emoji: '❤️', color: 'bg-orange-100 text-orange-700' },
  { id: 'documents',  label: 'Nyaraka',    emoji: '📄', color: 'bg-purple-100 text-purple-700' },
  { id: 'registered', label: 'Amesajili',  emoji: '✅', color: 'bg-green-100 text-green-700' },
  { id: 'lost',       label: 'Amekataa',   emoji: '❌', color: 'bg-red-100 text-red-700' },
]

type Lead = {
  id: string
  business_name?: string
  phone?: string
  whatsapp?: string
  region?: string
  source?: string
  pipeline_stage?: string
  ai_score?: number
  last_contacted_at?: string
  notes?: string
}

const sourceEmoji: Record<string, string> = {
  google_maps: '🗺️', google_business: '🏢', facebook_pages: '📘',
  facebook_groups: '👥', instagram: '📸', tiktok: '🎵',
  whatsapp_amina: '💬', instagram_amina: '📸', facebook_amina: '📘', manual: '✍️',
}

export default function StaffLeadsClient({
  currentUserId,
  isAdmin,
}: {
  currentUserId: string
  isAdmin: boolean
}) {
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [activeStage, setActiveStage] = useState('all')
  const [stats, setStats] = useState({ total: 0, active: 0, registered: 0 })

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('agent_leads')
      .select('id, business_name, phone, whatsapp, region, source, pipeline_stage, ai_score, last_contacted_at, notes')
      .order('ai_score', { ascending: false })

    // Staff see only their own; admin sees all
    if (!isAdmin) {
      query = query.eq('assigned_to', currentUserId)
    }

    const { data } = await query
    const rows = (data as Lead[]) || []
    setLeads(rows)
    setStats({
      total: rows.length,
      active: rows.filter(l => !['registered', 'lost'].includes(l.pipeline_stage || 'new')).length,
      registered: rows.filter(l => l.pipeline_stage === 'registered').length,
    })
    setLoading(false)
  }, [supabase, currentUserId, isAdmin])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  async function updateStage(leadId: string, stage: string) {
    const now = new Date().toISOString()
    const contactStages = ['contacted', 'interested', 'documents', 'registered']
    const updates: Record<string, string> = { pipeline_stage: stage }
    if (contactStages.includes(stage)) updates.last_contacted_at = now

    await supabase.from('agent_leads').update(updates).eq('id', leadId)
    await supabase.from('lead_communications').insert({
      lead_id: leadId,
      type: 'note',
      direction: 'outbound',
      content: `Hatua imebadilishwa hadi: ${STAGES.find(s => s.id === stage)?.label ?? stage}`,
    })
    fetch('/api/v1/staff/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionType:   'lead_stage_updated',
        resourceType: 'agent_leads',
        resourceId:   leadId,
        description:  `Hatua → ${STAGES.find(s => s.id === stage)?.label ?? stage}`,
      }),
    }).catch(() => {})
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, pipeline_stage: stage } : l))
    if (stage === 'registered') {
      // Update stats
      setStats(prev => ({
        ...prev,
        active: prev.active - 1,
        registered: prev.registered + 1,
      }))
    }
  }

  function getStage(id: string) {
    return STAGES.find(s => s.id === id) || STAGES[0]
  }

  function getScoreEmoji(score: number) {
    if (score >= 80) return '🔥'
    if (score >= 50) return '🌡️'
    return '❄️'
  }

  const filteredLeads = activeStage === 'all'
    ? leads
    : leads.filter(l => (l.pipeline_stage || 'new') === activeStage)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-[#1D9E75] px-4 py-4 sticky top-0 z-10">
        <h1 className="text-white font-bold text-lg mb-3">
          {isAdmin ? '👥 Leads za Wafanyakazi' : '🎯 Prospects Zangu'}
        </h1>
        <p className="text-green-100 text-xs mb-3">
          {isAdmin
            ? 'Leads zote za wafanyakazi wote'
            : 'Madalali watarajiwa uliogawiwa kwa kuwasiliana nao'}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Jumla',      value: stats.total,      emoji: '📊' },
            { label: 'Active',     value: stats.active,     emoji: '🔄' },
            { label: 'Walisajili', value: stats.registered, emoji: '✅' },
          ].map((s, i) => (
            <div key={i} className="bg-white/20 rounded-xl p-2 text-center">
              <div className="text-base">{s.emoji}</div>
              <div className="text-white font-bold">{s.value}</div>
              <div className="text-green-100 text-xs">{s.label}</div>
            </div>
          ))}
        </div>
      </header>

      <div className="px-4 py-4">
        {/* Stage filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          <button onClick={() => setActiveStage('all')}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium ${
              activeStage === 'all' ? 'bg-[#1D9E75] text-white' : 'bg-white text-gray-600'
            }`}>
            Zote ({leads.length})
          </button>
          {STAGES.map(stage => (
            <button key={stage.id} onClick={() => setActiveStage(stage.id)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium ${
                activeStage === stage.id ? 'bg-[#1D9E75] text-white' : 'bg-white text-gray-600'
              }`}>
              {stage.emoji} {stage.label} ({leads.filter(l => (l.pipeline_stage || 'new') === stage.id).length})
            </button>
          ))}
        </div>

        {/* Leads list */}
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl h-28 animate-pulse mb-3" />
          ))
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <div className="text-4xl mb-3">🎯</div>
            <p className="text-gray-500 font-medium">
              {activeStage === 'all'
                ? isAdmin
                  ? 'Hakuna leads bado'
                  : 'Hujagawiwa leads bado — subiri admin'
                : `Hakuna leads za ${getStage(activeStage).label}`}
            </p>
          </div>
        ) : filteredLeads.map(lead => {
          const stage = getStage(lead.pipeline_stage || 'new')
          return (
            <div key={lead.id} className="bg-white rounded-2xl p-4 border border-gray-100 mb-3">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span>{getScoreEmoji(lead.ai_score || 0)}</span>
                    <p className="font-semibold text-gray-900">{lead.business_name}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    📍 {lead.region || '—'} · {sourceEmoji[lead.source ?? ''] ?? '📌'} {lead.source?.replace(/_/g, ' ')}
                  </p>
                  {lead.last_contacted_at && (
                    <p className="text-xs text-gray-400">
                      📅 Mwisho: {new Date(lead.last_contacted_at).toLocaleDateString('sw-TZ')}
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${stage.color}`}>
                  {stage.emoji} {stage.label}
                </span>
              </div>

              {/* Contact buttons */}
              <div className="flex gap-2 mb-3">
                {(lead.whatsapp || lead.phone) && (
                  <a href={`https://wa.me/${(lead.whatsapp || lead.phone)?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Habari! Ninawasiliana nawe kutoka NyumbaFasta Tanzania. Tungependa kukukaribisha kujiunga nasi kama dalali wa mali. Je, una dakika kuzungumza?')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 bg-[#25D366] text-white text-xs py-2.5 rounded-xl text-center font-medium">
                    💬 WhatsApp
                  </a>
                )}
                {lead.phone && (
                  <a href={`tel:${lead.phone}`}
                    className="flex-1 bg-blue-500 text-white text-xs py-2.5 rounded-xl text-center font-medium">
                    📞 Piga Simu
                  </a>
                )}
              </div>

              {/* Stage update */}
              <select
                value={lead.pipeline_stage || 'new'}
                onChange={e => updateStage(lead.id, e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-gray-700"
              >
                {STAGES.map(s => (
                  <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>
                ))}
              </select>

              {lead.notes && (
                <p className="text-xs text-gray-400 mt-2 line-clamp-2">📝 {lead.notes}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
