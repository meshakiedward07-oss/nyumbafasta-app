'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Lead = {
  id: string
  business_name?: string
  phone?: string
  region?: string
  ai_score?: number
}

type Dalali = {
  id: string
  full_name?: string
  dalali_profiles?: { rating_avg?: number; is_premium_verified?: boolean } | null
}

export default function AssignClient() {
  const supabase = createClient()
  const [unassignedLeads, setUnassignedLeads] = useState<Lead[]>([])
  const [madalali, setMadalali] = useState<Dalali[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [leadsRes, madalaliRes] = await Promise.all([
      supabase.from('agent_leads').select('*')
        .is('assigned_to', null)
        .gte('ai_score', 50)
        .order('ai_score', { ascending: false })
        .limit(50),
      supabase.from('users')
        .select('id, full_name, avatar_url, dalali_profiles(rating_avg, is_premium_verified)')
        .eq('role', 'dalali')
        .eq('is_active', true),
    ])
    setUnassignedLeads((leadsRes.data as Lead[]) || [])
    setMadalali((madalaliRes.data as Dalali[]) || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  async function assignLead(leadId: string, dalaliId: string) {
    setAssigning(leadId)
    try {
      const res = await fetch('/api/v1/agent/leads/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, dalaliId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        console.error('Assign failed:', err.error)
      }
      fetchData()
    } finally {
      setAssigning(null)
    }
  }

  async function autoAssign() {
    if (unassignedLeads.length === 0 || madalali.length === 0) return
    setLoading(true)
    // Sort madalali by premium first, then by rating desc
    const sorted = [...madalali].sort((a, b) => {
      const aP = (a.dalali_profiles as { is_premium_verified?: boolean } | null)?.is_premium_verified ? 1 : 0
      const bP = (b.dalali_profiles as { is_premium_verified?: boolean } | null)?.is_premium_verified ? 1 : 0
      if (bP !== aP) return bP - aP
      const aR = (a.dalali_profiles as { rating_avg?: number } | null)?.rating_avg ?? 0
      const bR = (b.dalali_profiles as { rating_avg?: number } | null)?.rating_avg ?? 0
      return bR - aR
    })
    for (let i = 0; i < unassignedLeads.length; i++) {
      const dalali = sorted[i % sorted.length]
      await assignLead(unassignedLeads[i].id, dalali.id)
      await new Promise(r => setTimeout(r, 150))
    }
    setLoading(false)
  }

  function getScoreEmoji(score: number) {
    if (score >= 80) return '🔥'
    if (score >= 50) return '🌡️'
    return '❄️'
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-[#1D9E75] px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg">🎯 Lead Assignment</h1>
            <p className="text-green-100 text-xs">Leads {unassignedLeads.length} bila dalali</p>
          </div>
          <button onClick={autoAssign} disabled={loading || unassignedLeads.length === 0}
            className="bg-white text-[#1D9E75] text-xs px-4 py-2 rounded-xl font-bold disabled:opacity-50">
            ⚡ Auto-Assign Zote
          </button>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">

        {/* Madalali */}
        <div>
          <p className="font-semibold text-sm text-gray-700 mb-2">
            👨‍💼 Madalali Available ({madalali.length})
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {madalali.map(d => (
              <div key={d.id} className="flex-shrink-0 bg-white rounded-xl p-3 border border-gray-100 text-center w-24">
                <div className="w-10 h-10 rounded-full bg-[#1D9E75] flex items-center justify-center text-white font-bold mx-auto mb-1 text-sm">
                  {d.full_name?.[0]}
                </div>
                <p className="text-xs font-medium text-gray-700 line-clamp-1">{d.full_name?.split(' ')[0]}</p>
                {(d.dalali_profiles as { rating_avg?: number } | null)?.rating_avg && (
                  <p className="text-xs text-gray-400">⭐ {(d.dalali_profiles as { rating_avg?: number }).rating_avg}</p>
                )}
              </div>
            ))}
            {madalali.length === 0 && (
              <p className="text-gray-400 text-sm py-2">Hakuna madalali active</p>
            )}
          </div>
        </div>

        {/* Unassigned leads */}
        <div>
          <p className="font-semibold text-sm text-gray-700 mb-2">🎯 Leads Zinazosubiri</p>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl h-24 animate-pulse mb-3" />
            ))
          ) : unassignedLeads.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-gray-500">Leads zote zimepewa madalali</p>
            </div>
          ) : unassignedLeads.map(lead => (
            <div key={lead.id} className="bg-white rounded-2xl p-4 border border-gray-100 mb-3">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span>{getScoreEmoji(lead.ai_score || 0)}</span>
                    <p className="font-semibold text-sm">{lead.business_name}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    📍 {lead.region} · 📞 {lead.phone || 'Haipo'}
                  </p>
                </div>
                <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                  {lead.ai_score}/100
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-2">Chagua dalali:</p>
                <div className="flex gap-2 overflow-x-auto">
                  {madalali.map(d => (
                    <button key={d.id} onClick={() => assignLead(lead.id, d.id)}
                      disabled={assigning === lead.id}
                      className="flex-shrink-0 bg-[#1D9E75] text-white text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50">
                      {assigning === lead.id ? '...' : d.full_name?.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
