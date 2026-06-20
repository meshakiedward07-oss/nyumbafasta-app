'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Lead = {
  id: string
  business_name?: string
  phone?: string
  region?: string
  source?: string
  ai_score?: number
}

type StaffMember = {
  id: string
  full_name?: string
  staff_title?: string
  phone?: string
}

export default function AssignClient() {
  const supabase = createClient()
  const [unassignedLeads, setUnassignedLeads] = useState<Lead[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [leadsRes, staffRes] = await Promise.all([
      supabase.from('agent_leads').select('id, business_name, phone, region, source, ai_score')
        .is('assigned_to', null)
        .order('ai_score', { ascending: false })
        .limit(100),
      supabase.from('users')
        .select('id, full_name, staff_title, phone')
        .eq('role', 'staff')
        .eq('is_active', true),
    ])
    setUnassignedLeads((leadsRes.data as Lead[]) || [])
    setStaff((staffRes.data as StaffMember[]) || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  async function assignLead(leadId: string, staffId: string) {
    setAssigning(leadId)
    try {
      const res = await fetch('/api/v1/agent/leads/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, staffId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        console.error('Assign failed:', err.error)
      }
      await fetchData()
    } finally {
      setAssigning(null)
    }
  }

  async function autoAssign() {
    if (unassignedLeads.length === 0 || staff.length === 0) return
    setLoading(true)
    // Round-robin: distribute evenly across staff
    for (let i = 0; i < unassignedLeads.length; i++) {
      const member = staff[i % staff.length]
      await assignLead(unassignedLeads[i].id, member.id)
      await new Promise(r => setTimeout(r, 150))
    }
    setLoading(false)
  }

  function getScoreEmoji(score: number) {
    if (score >= 80) return '🔥'
    if (score >= 50) return '🌡️'
    return '❄️'
  }

  const sourceEmoji: Record<string, string> = {
    google_maps: '🗺️', google_business: '🏢', facebook_pages: '📘',
    facebook_groups: '👥', instagram: '📸', tiktok: '🎵',
    whatsapp_amina: '💬', instagram_amina: '📸', facebook_amina: '📘', manual: '✍️',
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-[#1D9E75] px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg">🎯 Gawa Prospects</h1>
            <p className="text-green-100 text-xs">
              Prospects {unassignedLeads.length} bila mfanyakazi
            </p>
          </div>
          <button onClick={autoAssign} disabled={loading || unassignedLeads.length === 0 || staff.length === 0}
            className="bg-white text-[#1D9E75] text-xs px-4 py-2 rounded-xl font-bold disabled:opacity-50">
            ⚡ Gawa Zote Moja kwa Moja
          </button>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">

        {/* Staff members */}
        <div>
          <p className="font-semibold text-sm text-gray-700 mb-2">
            👥 Wafanyakazi Available ({staff.length})
          </p>
          {staff.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-amber-800 font-medium text-sm">⚠️ Hakuna wafanyakazi (role=staff)</p>
              <p className="text-amber-600 text-xs mt-1">
                Unda akaunti za wafanyakazi wako kwanza. Nenda Admin → Users, badilisha role kuwa &quot;staff&quot;.
              </p>
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {staff.map(member => (
                <div key={member.id}
                  className="flex-shrink-0 bg-white rounded-xl p-3 border border-gray-100 text-center w-28">
                  <div className="w-10 h-10 rounded-full bg-[#1D9E75] flex items-center justify-center
                    text-white font-bold mx-auto mb-1 text-sm">
                    {member.full_name?.[0]}
                  </div>
                  <p className="text-xs font-medium text-gray-700 line-clamp-1">
                    {member.full_name?.split(' ')[0]}
                  </p>
                  {member.staff_title && (
                    <p className="text-xs text-gray-400 line-clamp-1">{member.staff_title}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unassigned prospects */}
        <div>
          <p className="font-semibold text-sm text-gray-700 mb-2">
            🎯 Prospects Zinazosubiri
          </p>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl h-24 animate-pulse mb-3" />
            ))
          ) : unassignedLeads.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-gray-500">Prospects zote zimegawiwa</p>
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
                    📍 {lead.region || '—'} · 📞 {lead.phone || 'Haipo'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {sourceEmoji[lead.source ?? ''] ?? '📌'} {lead.source?.replace(/_/g, ' ')}
                  </p>
                </div>
                <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                  {lead.ai_score}/100
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-2">Chagua mfanyakazi:</p>
                <div className="flex gap-2 overflow-x-auto">
                  {staff.map(member => (
                    <button key={member.id} onClick={() => assignLead(lead.id, member.id)}
                      disabled={assigning === lead.id}
                      className="flex-shrink-0 bg-[#1D9E75] text-white text-xs px-3 py-1.5
                        rounded-lg font-medium disabled:opacity-50">
                      {assigning === lead.id ? '...' : member.full_name?.split(' ')[0]}
                    </button>
                  ))}
                  {staff.length === 0 && (
                    <p className="text-xs text-gray-400 italic">Hakuna staff — unda akaunti kwanza</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
