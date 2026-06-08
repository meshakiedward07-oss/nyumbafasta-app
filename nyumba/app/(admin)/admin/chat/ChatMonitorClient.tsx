'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ChatSession {
  id: string; platform: string; phone: string | null; name: string | null
  flow_type: string; flow_step: string; created_at: string; updated_at: string
}
interface ChatMessage {
  id: string; session_id: string; role: string; content: string; created_at: string
}

export default function ChatMonitorClient() {
  const supabase = createClient()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [selected, setSelected] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, today: 0, care: 0, client: 0 })

  useEffect(() => {
    fetchSessions()
    const channel = supabase
      .channel('chat_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions' }, () => fetchSessions())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchSessions() {
    setLoading(true)
    const { data } = await supabase
      .from('chat_sessions')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(50)
    const rows = data || []
    setSessions(rows)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    setStats({
      total: rows.length,
      today: rows.filter(s => new Date(s.created_at) >= today).length,
      care: rows.filter(s => s.flow_type === 'customer_care').length,
      client: rows.filter(s => s.flow_type === 'client').length,
    })
    setLoading(false)
  }

  async function fetchMessages(sessionId: string) {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
    setMessages(data || [])
  }

  function flowEmoji(t: string) {
    const m: Record<string, string> = { client: '🔍', dalali_register: '👨‍💼', dalali_listing: '🏠', customer_care: '🎧' }
    return m[t] ?? '💬'
  }
  function platformEmoji(p: string) {
    const m: Record<string, string> = { whatsapp: '💬', facebook: '📘', instagram: '📸' }
    return m[p] ?? '📱'
  }
  function timeAgo(d: string) {
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
    if (mins < 1) return 'Sasa hivi'
    if (mins < 60) return `Dakika ${mins}`
    const h = Math.floor(mins / 60)
    if (h < 24) return `Masaa ${h}`
    return `Siku ${Math.floor(h / 24)}`
  }
  function flowBadge(t: string) {
    const m: Record<string, string> = {
      customer_care: 'bg-orange-100 text-orange-600',
      dalali_register: 'bg-blue-100 text-blue-600',
      dalali_listing: 'bg-purple-100 text-purple-600',
    }
    return m[t] ?? 'bg-green-100 text-green-600'
  }

  const STATS = [
    { label: 'Chats Zote', value: stats.total, emoji: '💬', color: 'bg-blue-50 text-blue-700' },
    { label: 'Leo', value: stats.today, emoji: '🆕', color: 'bg-green-50 text-green-700' },
    { label: 'Wateja', value: stats.client, emoji: '🔍', color: 'bg-purple-50 text-purple-700' },
    { label: 'Support', value: stats.care, emoji: '🎧', color: 'bg-orange-50 text-orange-700' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop header */}
      <div className="hidden lg:flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">💬 Chat Monitor</h1>
          <p className="text-gray-500 mt-1">Mazungumzo yote ya AI Bot</p>
        </div>
        <button
          onClick={fetchSessions}
          className="px-4 py-2 bg-[#1D9E75] text-white rounded-xl text-sm font-medium"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Mobile header */}
      <header className="lg:hidden bg-[#1D9E75] px-4 py-4 sticky top-0 z-10">
        <h1 className="text-white font-bold text-lg">💬 Chat Monitor</h1>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-4 lg:px-0 py-4 lg:py-0 lg:mb-6">
        {STATS.map((s, i) => (
          <div key={i} className={`${s.color} rounded-2xl p-4`}>
            <div className="text-2xl mb-1">{s.emoji}</div>
            <div className="font-bold text-2xl">{s.value}</div>
            <div className="text-xs opacity-70 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Desktop split view */}
      <div className="hidden lg:grid grid-cols-3 gap-6">
        {/* Sessions list */}
        <div className="col-span-1 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="font-semibold text-gray-700">
              Mazungumzo ({sessions.length})
              {loading && <span className="ml-2 text-xs text-gray-400">Loading...</span>}
            </p>
          </div>
          <div className="overflow-y-auto max-h-[600px]">
            {sessions.map(s => (
              <div
                key={s.id}
                onClick={() => { setSelected(s); fetchMessages(s.id) }}
                className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${selected?.id === s.id ? 'bg-green-50 border-l-4 border-l-[#1D9E75]' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span>{platformEmoji(s.platform)}</span>
                    <span className="font-medium text-sm truncate max-w-[120px]">
                      {s.name || s.phone || 'Unknown'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{timeAgo(s.updated_at || s.created_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs">{flowEmoji(s.flow_type)}</span>
                  <span className="text-xs text-gray-500">{s.flow_type?.replace(/_/g, ' ')}</span>
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${flowBadge(s.flow_type)}`}>
                    {s.flow_step}
                  </span>
                </div>
              </div>
            ))}
            {!loading && sessions.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-12">Hakuna chats bado</p>
            )}
          </div>
        </div>

        {/* Messages panel */}
        <div className="col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {selected ? (
            <>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                <span className="text-2xl">{platformEmoji(selected.platform)}</span>
                <div>
                  <p className="font-semibold">{selected.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-400">
                    📞 {selected.phone} · {flowEmoji(selected.flow_type)} {selected.flow_type?.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto max-h-[520px]">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-sm lg:max-w-md px-4 py-2.5 rounded-2xl text-sm ${
                      msg.role === 'assistant'
                        ? 'bg-gray-100 text-gray-800 rounded-tl-sm'
                        : 'bg-[#1D9E75] text-white rounded-tr-sm'
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <p className={`text-xs mt-1 ${msg.role === 'assistant' ? 'text-gray-400' : 'text-green-100'}`}>
                        {new Date(msg.created_at).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-8">Hakuna messages bado</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="text-5xl mb-3">💬</div>
                <p className="text-gray-400">Chagua mazungumzo kuona messages</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile list */}
      <div className="lg:hidden px-4 space-y-3 pb-20 mt-2">
        {sessions.map(s => (
          <div
            key={s.id}
            onClick={() => { setSelected(s); fetchMessages(s.id) }}
            className="bg-white rounded-2xl p-4 border border-gray-100 active:bg-gray-50"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{platformEmoji(s.platform)}</span>
                <div>
                  <p className="font-semibold text-sm">{s.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-400">{s.phone}</p>
                </div>
              </div>
              <span className="text-xs text-gray-400">{timeAgo(s.updated_at || s.created_at)}</span>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${flowBadge(s.flow_type)}`}>
              {flowEmoji(s.flow_type)} {s.flow_type?.replace(/_/g, ' ')}
            </span>
          </div>
        ))}
        {!loading && sessions.length === 0 && (
          <p className="text-center text-gray-400 py-12">Hakuna chats bado</p>
        )}
      </div>

      {/* Mobile message modal */}
      {selected && (
        <div className="lg:hidden fixed inset-0 bg-white z-50 flex flex-col">
          <div className="bg-[#1D9E75] px-4 py-3 flex items-center gap-3">
            <button onClick={() => setSelected(null)} className="text-white text-xl mr-1">←</button>
            <span className="text-xl">{platformEmoji(selected.platform)}</span>
            <div>
              <p className="text-white font-semibold text-sm">{selected.name || 'Unknown'}</p>
              <p className="text-green-100 text-xs">{selected.phone}</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                  msg.role === 'assistant'
                    ? 'bg-white text-gray-800 rounded-tl-sm shadow-sm'
                    : 'bg-[#1D9E75] text-white rounded-tr-sm'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-xs mt-1 ${msg.role === 'assistant' ? 'text-gray-400' : 'text-green-100'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
