'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import PropertyMatches from './PropertyMatches'

type Stage = { id: string; label: string; color: string; emoji: string }

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
}

type Communication = {
  id: string
  type: string
  content: string
  created_at: string
}

type Task = {
  id: string
  title: string
  type: string
  priority: string
  due_date: string
  is_completed: boolean
}

type CallLog = {
  id: string
  outcome: string
  duration_seconds: number
  notes?: string
  next_action?: string
  called_at: string
}

type AIRec = {
  recommendation: string
  action: string
  priority: number
  reasoning: string
  best_time: string
  message_hint: string
}

export default function LeadDetailModal({
  lead,
  onClose,
  onUpdate,
  stages,
}: {
  lead: Lead
  onClose: () => void
  onUpdate: () => void
  stages: Stage[]
}) {
  const supabase = createClient()
  const [tab, setTab] = useState<'info' | 'history' | 'tasks' | 'matches' | 'calls'>('info')
  const [communications, setCommunications] = useState<Communication[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [calls, setCalls] = useState<CallLog[]>([])
  const [showCallForm, setShowCallForm] = useState(false)
  const [callForm, setCallForm] = useState({
    duration_seconds: 0,
    outcome: 'answered',
    notes: '',
    next_action: 'followup',
  })
  const [aiRec, setAiRec] = useState<AIRec | null>(null)
  const [loadingAI, setLoadingAI] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [newTask, setNewTask] = useState({
    title: '',
    type: 'followup',
    due_date: '',
    priority: 'medium',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchCommunications()
    fetchTasks()
    fetchCalls()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id])

  async function fetchCommunications() {
    const { data } = await supabase
      .from('lead_communications')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
    setCommunications(data || [])
  }

  async function fetchTasks() {
    const { data } = await supabase
      .from('lead_tasks')
      .select('*')
      .eq('lead_id', lead.id)
      .order('due_date', { ascending: true })
    setTasks(data || [])
  }

  async function fetchCalls() {
    const { data } = await supabase
      .from('call_logs')
      .select('*')
      .eq('lead_id', lead.id)
      .order('called_at', { ascending: false })
    setCalls((data as CallLog[]) || [])
  }

  async function saveCallLog() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('call_logs').insert({
        lead_id: lead.id,
        dalali_id: user?.id,
        ...callForm,
      })
      await supabase.from('lead_communications').insert({
        lead_id: lead.id,
        user_id: user?.id,
        type: 'call',
        content: `Simu: ${callForm.outcome} — ${callForm.notes || ''}`,
      })
      await supabase
        .from('agent_leads')
        .update({ last_contacted_at: new Date().toISOString() })
        .eq('id', lead.id)
      setShowCallForm(false)
      setCallForm({ duration_seconds: 0, outcome: 'answered', notes: '', next_action: 'followup' })
      fetchCalls()
      fetchCommunications()
      onUpdate()
    } finally {
      setLoading(false)
    }
  }

  async function getAIRecommendation() {
    setLoadingAI(true)
    try {
      const res = await fetch('/api/v1/crm/ai-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id }),
      })
      const data = await res.json() as AIRec
      setAiRec(data)
    } finally {
      setLoadingAI(false)
    }
  }

  async function addNote() {
    if (!newNote.trim()) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('lead_communications').insert({
      lead_id: lead.id,
      user_id: user?.id,
      type: 'note',
      content: newNote,
    })
    setNewNote('')
    fetchCommunications()
    setLoading(false)
  }

  async function addCommunication(type: string) {
    const { data: { user } } = await supabase.auth.getUser()
    const content =
      type === 'call' ? 'Simu imepigwa' :
      type === 'whatsapp' ? 'WhatsApp imetumwa' :
      type === 'viewing' ? 'Viewing imepangwa' :
      'Mawasiliano'
    await supabase.from('lead_communications').insert({
      lead_id: lead.id,
      user_id: user?.id,
      type,
      content,
    })
    await supabase
      .from('agent_leads')
      .update({ last_contacted_at: new Date().toISOString() })
      .eq('id', lead.id)
    fetchCommunications()
    onUpdate()
  }

  async function addTask() {
    if (!newTask.title || !newTask.due_date) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('lead_tasks').insert({
      lead_id: lead.id,
      assigned_to: user?.id,
      created_by: user?.id,
      ...newTask,
    })
    setNewTask({ title: '', type: 'followup', due_date: '', priority: 'medium' })
    fetchTasks()
    setLoading(false)
  }

  async function completeTask(taskId: string) {
    await supabase
      .from('lead_tasks')
      .update({ is_completed: true, completed_at: new Date().toISOString() })
      .eq('id', taskId)
    fetchTasks()
  }

  async function moveStage(stage: string) {
    await supabase
      .from('agent_leads')
      .update({ pipeline_stage: stage })
      .eq('id', lead.id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('lead_communications').insert({
      lead_id: lead.id,
      user_id: user?.id,
      type: 'note',
      content: `Pipeline imebadilishwa → ${stages.find(s => s.id === stage)?.label}`,
    })
    fetchCommunications()
    onUpdate()
  }

  function getCommIcon(type: string) {
    const icons: Record<string, string> = {
      call: '📞', whatsapp: '💬', sms: '📱',
      email: '✉️', note: '📝', viewing: '🏠', meeting: '🤝',
    }
    return icons[type] || '📌'
  }

  function getPriorityColor(priority: string) {
    const colors: Record<string, string> = {
      urgent: 'text-red-600 bg-red-50',
      high: 'text-orange-600 bg-orange-50',
      medium: 'text-yellow-600 bg-yellow-50',
      low: 'text-gray-600 bg-gray-50',
    }
    return colors[priority] || colors.medium
  }

  const currentStage = lead.pipeline_stage || 'new'
  const phoneClean = lead.phone?.replace(/[^0-9]/g, '') || ''
  const waClean = lead.whatsapp?.replace(/[^0-9]/g, '') || ''

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white w-full rounded-t-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-lg">{lead.business_name}</h3>
              <p className="text-gray-400 text-xs">{lead.phone} · {lead.region}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 mb-3 overflow-x-auto">
            {lead.whatsapp && (
              <a
                href={`https://wa.me/${waClean}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => addCommunication('whatsapp')}
                className="flex-shrink-0 bg-[#25D366] text-white text-xs px-3 py-2 rounded-xl font-medium"
              >
                💬 WhatsApp
              </a>
            )}
            {lead.phone && (
              <a
                href={`tel:${phoneClean}`}
                onClick={() => addCommunication('call')}
                className="flex-shrink-0 bg-blue-500 text-white text-xs px-3 py-2 rounded-xl font-medium"
              >
                📞 Piga Simu
              </a>
            )}
            <button
              onClick={() => addCommunication('viewing')}
              className="flex-shrink-0 bg-purple-500 text-white text-xs px-3 py-2 rounded-xl font-medium"
            >
              🏠 Panga Viewing
            </button>
          </div>

          {/* Pipeline stage selector */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {stages.filter(s => s.id !== 'lost').map(stage => (
              <button
                key={stage.id}
                onClick={() => moveStage(stage.id)}
                className={`flex-shrink-0 text-xs px-2 py-1 rounded-full font-medium transition-all ${
                  currentStage === stage.id
                    ? stage.color + ' text-white scale-105'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {stage.emoji} {stage.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4 overflow-x-auto">
          {([
            { id: 'info', label: 'ℹ️ Info' },
            { id: 'history', label: '📋 Historia' },
            { id: 'tasks', label: '✅ Tasks' },
            { id: 'calls', label: '📞 Simu' },
            { id: 'matches', label: '🏠 Nyumba' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-3 text-xs font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-[#1D9E75] text-[#1D9E75]'
                  : 'border-transparent text-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4">

          {/* INFO TAB */}
          {tab === 'info' && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                {[
                  { label: '📞 Simu', value: lead.phone },
                  { label: '💬 WhatsApp', value: lead.whatsapp },
                  { label: '✉️ Email', value: lead.email },
                  { label: '📍 Mkoa', value: lead.region },
                  { label: '📡 Source', value: lead.source },
                  { label: '🤖 Score', value: lead.ai_score != null ? `${lead.ai_score}/100` : null },
                ].filter(i => i.value).map((item, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">{item.label}</span>
                    <span className="text-sm font-medium">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 rounded-xl p-4">
                <p className="font-semibold text-sm text-blue-800 mb-3">🏠 Mahitaji ya Mteja</p>
                <div className="space-y-2">
                  {[
                    { label: 'Eneo', value: lead.preferred_location || 'Haijawekwa' },
                    {
                      label: 'Bajeti',
                      value: lead.budget_min && lead.budget_max
                        ? `Tsh ${lead.budget_min.toLocaleString()} - ${lead.budget_max.toLocaleString()}`
                        : 'Haijawekwa',
                    },
                    { label: 'Aina', value: lead.property_type || 'Haijawekwa' },
                    { label: 'Vyumba', value: lead.bedrooms?.toString() || 'Haijawekwa' },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-sm text-blue-600">{item.label}</span>
                      <span className="text-sm font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {lead.ai_notes && (
                <div className="bg-purple-50 rounded-xl p-4">
                  <p className="font-semibold text-sm text-purple-800 mb-2">🤖 AI Analysis</p>
                  <p className="text-sm text-purple-600">{lead.ai_notes}</p>
                </div>
              )}

              {/* AI Recommendation */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-sm text-purple-800">🤖 AI Recommendation</p>
                  <button onClick={getAIRecommendation} disabled={loadingAI}
                    className="bg-purple-500 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50">
                    {loadingAI ? '⏳ ...' : '✨ Analyze'}
                  </button>
                </div>
                {aiRec ? (
                  <div className="space-y-2">
                    <div className="bg-white rounded-xl p-3">
                      <p className="font-semibold text-sm text-gray-800">{aiRec.recommendation}</p>
                      <p className="text-xs text-gray-500 mt-1">{aiRec.reasoning}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full">
                        🎯 {aiRec.action}
                      </span>
                      <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                        ⏰ {aiRec.best_time}
                      </span>
                      <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                        Priority: {aiRec.priority}/10
                      </span>
                    </div>
                    {aiRec.message_hint && (
                      <div className="bg-yellow-50 rounded-xl p-3">
                        <p className="text-xs font-medium text-yellow-800 mb-1">💬 Message ya kutumia:</p>
                        <p className="text-xs text-yellow-700">{aiRec.message_hint}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-purple-600 text-sm">
                    Bonyeza &quot;Analyze&quot; kupata shauri la AI kuhusu lead hii
                  </p>
                )}
              </div>
            </div>
          )}

          {/* HISTORY TAB */}
          {tab === 'history' && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <textarea
                  placeholder="Andika note, matokeo ya simu, etc..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  rows={3}
                  className="w-full bg-transparent text-sm resize-none focus:outline-none"
                />
                <button
                  onClick={addNote}
                  disabled={!newNote.trim() || loading}
                  className="w-full bg-[#1D9E75] text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50 mt-2"
                >
                  {loading ? 'Inahifadhi...' : '📝 Hifadhi Note'}
                </button>
              </div>

              {communications.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">Hakuna historia bado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {communications.map(comm => (
                    <div key={comm.id} className="bg-white border border-gray-100 rounded-xl p-3">
                      <div className="flex items-start gap-2">
                        <span className="text-xl">{getCommIcon(comm.type)}</span>
                        <div className="flex-1">
                          <p className="text-sm text-gray-700">{comm.content}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(comm.created_at).toLocaleString('sw-TZ')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TASKS TAB */}
          {tab === 'tasks' && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="font-semibold text-sm mb-3">➕ Task Mpya</p>
                <input
                  type="text"
                  placeholder="Mfano: Piga simu kesho asubuhi"
                  value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none mb-2"
                />
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <select
                    value={newTask.type}
                    onChange={e => setNewTask({ ...newTask, type: e.target.value })}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="followup">📞 Follow-up</option>
                    <option value="call">📱 Piga Simu</option>
                    <option value="viewing">🏠 Viewing</option>
                    <option value="send_photos">📸 Tuma Picha</option>
                    <option value="meeting">🤝 Meeting</option>
                  </select>
                  <select
                    value={newTask.priority}
                    onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="urgent">🔴 Haraka</option>
                    <option value="high">🟠 Juu</option>
                    <option value="medium">🟡 Kati</option>
                    <option value="low">🟢 Chini</option>
                  </select>
                </div>
                <input
                  type="datetime-local"
                  value={newTask.due_date}
                  onChange={e => setNewTask({ ...newTask, due_date: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none mb-2"
                />
                <button
                  onClick={addTask}
                  disabled={!newTask.title || !newTask.due_date || loading}
                  className="w-full bg-[#1D9E75] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  ➕ Ongeza Task
                </button>
              </div>

              {tasks.map(task => (
                <div
                  key={task.id}
                  className={`bg-white border rounded-xl p-3 ${
                    task.is_completed ? 'border-green-100 opacity-60' : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => completeTask(task.id)}
                      className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                        task.is_completed
                          ? 'bg-green-500 border-green-500'
                          : 'border-gray-300'
                      }`}
                    >
                      {task.is_completed && <span className="text-white text-xs">✓</span>}
                    </button>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${
                        task.is_completed ? 'line-through text-gray-400' : 'text-gray-800'
                      }`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                        <span className="text-xs text-gray-400">
                          📅 {new Date(task.due_date).toLocaleDateString('sw-TZ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {tasks.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">Hakuna tasks — ongeza ya kwanza!</p>
                </div>
              )}
            </div>
          )}

          {/* CALLS TAB */}
          {tab === 'calls' && (
            <div className="space-y-3">
              <button onClick={() => setShowCallForm(!showCallForm)}
                className="w-full bg-blue-500 text-white py-3 rounded-xl font-semibold text-sm">
                📞 Rekodi Simu Mpya
              </button>

              {showCallForm && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Matokeo ya Simu</label>
                    <select value={callForm.outcome}
                      onChange={e => setCallForm(f => ({ ...f, outcome: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none">
                      <option value="answered">✅ Alijibu</option>
                      <option value="no_answer">📵 Hakujibu</option>
                      <option value="busy">🔴 Busy</option>
                      <option value="wrong_number">❌ Nambari Mbaya</option>
                      <option value="callback">📞 Atapigia Baadaye</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Muda (dakika)</label>
                    <input type="number" placeholder="0"
                      value={callForm.duration_seconds ? callForm.duration_seconds / 60 : ''}
                      onChange={e => setCallForm(f => ({ ...f, duration_seconds: (parseInt(e.target.value) || 0) * 60 }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Notes</label>
                    <textarea placeholder="Mazungumzo yalikuwa kuhusu..."
                      value={callForm.notes}
                      onChange={e => setCallForm(f => ({ ...f, notes: e.target.value }))}
                      rows={3}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Hatua Inayofuata</label>
                    <select value={callForm.next_action}
                      onChange={e => setCallForm(f => ({ ...f, next_action: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none">
                      <option value="followup">📞 Follow-up</option>
                      <option value="send_photos">📸 Tuma Picha</option>
                      <option value="schedule_viewing">🏠 Panga Viewing</option>
                      <option value="close_deal">✅ Funga Deal</option>
                      <option value="nurture">💬 Endelea Kuzungumza</option>
                    </select>
                  </div>
                  <button onClick={saveCallLog} disabled={loading}
                    className="w-full bg-[#1D9E75] text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50">
                    {loading ? 'Inahifadhi...' : '💾 Hifadhi Log'}
                  </button>
                </div>
              )}

              {/* Calls history */}
              <div className="space-y-2">
                {calls.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-6">
                    Hakuna simu zilizorekodiwa bado
                  </p>
                ) : calls.map(call => (
                  <div key={call.id} className="bg-white border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        call.outcome === 'answered' ? 'bg-green-100 text-green-700' :
                        call.outcome === 'no_answer' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {call.outcome === 'answered' ? '✅ Alijibu' :
                         call.outcome === 'no_answer' ? '📵 Hakujibu' :
                         call.outcome === 'busy' ? '🔴 Busy' :
                         call.outcome}
                      </span>
                      <span className="text-xs text-gray-400">
                        {call.duration_seconds > 0
                          ? `${Math.floor(call.duration_seconds / 60)}:${String(call.duration_seconds % 60).padStart(2, '0')} · `
                          : ''}
                        {new Date(call.called_at).toLocaleDateString('sw-TZ')}
                      </span>
                    </div>
                    {call.notes && <p className="text-sm text-gray-600">{call.notes}</p>}
                    {call.next_action && (
                      <p className="text-xs text-blue-500 mt-1">→ {call.next_action}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PROPERTY MATCHES TAB */}
          {tab === 'matches' && (
            <PropertyMatches lead={lead} supabase={supabase} />
          )}
        </div>
      </div>
    </div>
  )
}
