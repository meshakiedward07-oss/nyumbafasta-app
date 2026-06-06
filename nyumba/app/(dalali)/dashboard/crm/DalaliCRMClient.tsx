'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Lead = {
  id: string
  business_name?: string
  phone?: string
  whatsapp?: string
  region?: string
  pipeline_stage?: string
  ai_score?: number
  last_contacted_at?: string
}

type Task = {
  id: string
  title: string
  due_date: string
  lead: { business_name?: string; phone?: string } | null
}

const STAGES = [
  { id: 'new', label: 'Mpya', emoji: '🆕', color: 'bg-blue-100 text-blue-700' },
  { id: 'contacted', label: 'Amepigiwa', emoji: '📞', color: 'bg-yellow-100 text-yellow-700' },
  { id: 'interested', label: 'Anapenda', emoji: '❤️', color: 'bg-orange-100 text-orange-700' },
  { id: 'viewing_scheduled', label: 'Viewing', emoji: '🏠', color: 'bg-purple-100 text-purple-700' },
  { id: 'negotiation', label: 'Mazungumzo', emoji: '🤝', color: 'bg-indigo-100 text-indigo-700' },
  { id: 'closed', label: 'Imefungwa', emoji: '✅', color: 'bg-green-100 text-green-700' },
]

export default function DalaliCRMClient() {
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [activeStage, setActiveStage] = useState('all')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, active: 0, closed: 0, tasks_due: 0 })

  const fetchMyLeads = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('agent_leads')
      .select('id, business_name, phone, whatsapp, region, pipeline_stage, ai_score, last_contacted_at')
      .eq('assigned_to', user?.id)
      .order('ai_score', { ascending: false })

    const rows = (data as Lead[]) || []
    setLeads(rows)
    setStats(prev => ({
      ...prev,
      total: rows.length,
      active: rows.filter(l => !['closed', 'lost'].includes(l.pipeline_stage || 'new')).length,
      closed: rows.filter(l => l.pipeline_stage === 'closed').length,
    }))
    setLoading(false)
  }, [supabase])

  const fetchMyTasks = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('lead_tasks')
      .select('id, title, due_date, lead:lead_id(business_name, phone)')
      .eq('assigned_to', user?.id)
      .eq('is_completed', false)
      .lte('due_date', tomorrow)
      .order('due_date')

    const rows = data as Task[] || []
    setTasks(rows)
    setStats(prev => ({ ...prev, tasks_due: rows.length }))
  }, [supabase])

  useEffect(() => {
    fetchMyLeads()
    fetchMyTasks()
  }, [fetchMyLeads, fetchMyTasks])

  function getScoreEmoji(score: number) {
    if (score >= 80) return '🔥'
    if (score >= 50) return '🌡️'
    return '❄️'
  }

  function getStage(id: string) {
    return STAGES.find(s => s.id === id) || STAGES[0]
  }

  const filteredLeads = activeStage === 'all'
    ? leads
    : leads.filter(l => (l.pipeline_stage || 'new') === activeStage)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-[#1D9E75] px-4 py-4 sticky top-0 z-10">
        <h1 className="text-white font-bold text-lg mb-3">🎯 Leads Zangu</h1>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Zote', value: stats.total, emoji: '📊' },
            { label: 'Active', value: stats.active, emoji: '🔄' },
            { label: 'Closed', value: stats.closed, emoji: '✅' },
            { label: 'Tasks', value: stats.tasks_due, emoji: '⏰' },
          ].map((s, i) => (
            <div key={i} className="bg-white/20 rounded-xl p-2 text-center">
              <div className="text-base">{s.emoji}</div>
              <div className="text-white font-bold">{s.value}</div>
              <div className="text-green-100 text-xs">{s.label}</div>
            </div>
          ))}
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">

        {/* Tasks za Leo */}
        {tasks.length > 0 && (
          <div>
            <p className="font-semibold text-sm text-gray-700 mb-2">
              ⏰ Tasks za Leo ({tasks.length})
            </p>
            <div className="space-y-2">
              {tasks.map(task => (
                <div key={task.id} className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                  <p className="font-medium text-sm text-orange-800">{task.title}</p>
                  <p className="text-xs text-orange-600 mt-0.5">
                    👤 {task.lead?.business_name} · 📞 {task.lead?.phone}
                  </p>
                  <p className="text-xs text-orange-500 mt-0.5">
                    📅 {new Date(task.due_date).toLocaleString('sw-TZ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stage filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
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
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl h-28 animate-pulse" />
          ))
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <div className="text-4xl mb-3">🎯</div>
            <p className="text-gray-500 text-sm">
              Hakuna leads {activeStage !== 'all' ? `za ${activeStage}` : ''} bado
            </p>
          </div>
        ) : filteredLeads.map(lead => {
          const stage = getStage(lead.pipeline_stage || 'new')
          return (
            <div key={lead.id} className="bg-white rounded-2xl p-4 border border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span>{getScoreEmoji(lead.ai_score || 0)}</span>
                    <p className="font-semibold text-gray-900">{lead.business_name}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    📍 {lead.region} · Score: {lead.ai_score}
                  </p>
                  {lead.last_contacted_at && (
                    <p className="text-xs text-gray-400">
                      📅 {new Date(lead.last_contacted_at).toLocaleDateString('sw-TZ')}
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${stage.color}`}>
                  {stage.emoji} {stage.label}
                </span>
              </div>
              <div className="flex gap-2">
                {(lead.whatsapp || lead.phone) && (
                  <a
                    href={`https://wa.me/${(lead.whatsapp || lead.phone)?.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-[#25D366] text-white text-xs py-2.5 rounded-xl text-center font-medium"
                  >
                    💬 WhatsApp
                  </a>
                )}
                {lead.phone && (
                  <a
                    href={`tel:${lead.phone}`}
                    className="flex-1 bg-blue-500 text-white text-xs py-2.5 rounded-xl text-center font-medium"
                  >
                    📞 Piga Simu
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
