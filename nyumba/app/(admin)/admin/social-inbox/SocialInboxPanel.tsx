'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PlatformLogo } from '@/components/shared/PlatformLogo'

// ── Types ──────────────────────────────────────────────────────────────────────

type Platform = 'instagram' | 'facebook'
type Status   = 'amina' | 'pending' | 'admin' | 'resolved'

interface SocialSession {
  id: string
  platform: Platform
  sender_id: string
  sender_name: string | null
  status: Status
  escalation_reason: string | null
  escalated_at: string | null
  last_message_at: string
}

interface DMRow {
  message_text: string
  reply_text: string | null
  reply_sent: boolean
  created_at: string
}

interface AdminMsg {
  role: 'admin' | 'system'
  content: string
  sent_at: string
  sent_by: string | null
}

type MsgItem = { kind: 'user' | 'amina' | 'admin' | 'system'; text: string; at: string }

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<Status, { label: string; dot: string; bg: string; text: string }> = {
  pending:  { label: 'Inasubiri',  dot: 'bg-red-500',    bg: 'bg-red-50',    text: 'text-red-700'   },
  admin:    { label: 'Admin',      dot: 'bg-amber-500',  bg: 'bg-amber-50',  text: 'text-amber-700' },
  amina:    { label: 'Amina',      dot: 'bg-green-500',  bg: 'bg-green-50',  text: 'text-green-700' },
  resolved: { label: 'Imefungwa', dot: 'bg-gray-400',   bg: 'bg-gray-50',   text: 'text-gray-600'  },
}

function StatusBadge({ status }: { status: Status }) {
  const c = STATUS_CFG[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

function relTime(ts: string): string {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (m < 1) return 'sasa hivi'
  if (m < 60) return `dakika ${m}`
  const h = Math.floor(m / 60)
  if (h < 24) return `saa ${h}`
  return `siku ${Math.floor(h / 24)}`
}

function buildTimeline(dms: DMRow[], adminMsgs: AdminMsg[]): MsgItem[] {
  const items: MsgItem[] = []
  for (const d of dms) {
    items.push({ kind: 'user',  text: d.message_text, at: d.created_at })
    if (d.reply_sent && d.reply_text) {
      items.push({ kind: 'amina', text: d.reply_text, at: d.created_at })
    }
  }
  for (const m of adminMsgs) {
    items.push({ kind: m.role === 'system' ? 'system' : 'admin', text: m.content, at: m.sent_at })
  }
  return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
}

function Bubble({ item }: { item: MsgItem }) {
  const time = new Date(item.at).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })

  if (item.kind === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[10px] text-gray-400 bg-gray-100 rounded-full px-3 py-1 italic">{item.text}</span>
      </div>
    )
  }

  const isUser  = item.kind === 'user'
  const isAdmin = item.kind === 'admin'
  const bubble  = isUser
    ? 'bg-blue-500 text-white rounded-tl-2xl rounded-tr-2xl rounded-br-2xl'
    : isAdmin
      ? 'bg-amber-500 text-white rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl'
      : 'bg-primary-50 text-gray-800 rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl'
  const label      = isUser ? 'Mteja' : isAdmin ? 'Admin' : 'Amina'
  const labelColor = isUser ? 'text-blue-600' : isAdmin ? 'text-amber-600' : 'text-primary-500'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className="max-w-[75%]">
        <p className={`text-[10px] font-semibold mb-0.5 ${isUser ? 'text-right' : 'text-left'} ${labelColor}`}>{label}</p>
        <div className={`px-3 py-2 text-sm ${bubble}`}>
          <p className="whitespace-pre-wrap break-words">{item.text}</p>
        </div>
        <p className={`text-[9px] text-gray-400 mt-0.5 ${isUser ? 'text-right' : 'text-left'}`}>{time}</p>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SocialInboxPanel() {
  const [sessions,    setSessions]    = useState<SocialSession[]>([])
  const [selected,    setSelected]    = useState<SocialSession | null>(null)
  const [messages,    setMessages]    = useState<MsgItem[]>([])
  const [platform,    setPlatform]    = useState<Platform>('instagram')
  const [statusFilter,setStatusFilter] = useState<Status | 'all'>('all')
  const [msgText,     setMsgText]     = useState('')
  const [sending,     setSending]     = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [activeTab,   setActiveTab]   = useState<'chat' | 'controls'>('chat')
  const [toast,       setToast]       = useState<{ msg: string; ok: boolean } | null>(null)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500)
  }

  const fetchSessions = useCallback(async () => {
    try {
      const params = new URLSearchParams({ platform, status: statusFilter })
      const res = await fetch(`/api/v1/social/sessions?${params}`)
      if (res.ok) {
        const d = await res.json()
        setSessions(d.sessions ?? [])
      }
    } catch { /* keep existing */ }
    setLoading(false)
  }, [platform, statusFilter])

  const fetchMessages = useCallback(async (sess: SocialSession) => {
    const res = await fetch(`/api/v1/social/sessions/${encodeURIComponent(sess.sender_id)}?platform=${sess.platform}`)
    if (!res.ok) return
    const d = await res.json()
    setMessages(buildTimeline(d.dms ?? [], d.adminMessages ?? []))
    if (d.session) {
      setSessions(prev => prev.map(s => s.sender_id === sess.sender_id ? { ...s, ...d.session } : s))
      setSelected(prev => prev?.sender_id === sess.sender_id ? { ...prev, ...d.session } : prev)
    }
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  useEffect(() => {
    if (!selected) return
    fetchMessages(selected)
  }, [selected, fetchMessages])

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages])

  // Realtime
  useEffect(() => {
    const supabase = createClient()
    const suffix = Math.random().toString(36).slice(2)
    let ch: ReturnType<typeof supabase.channel> | null = null
    try {
      ch = supabase.channel(`social-sessions-${suffix}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'social_sessions' }, () => {
          fetchSessions()
          if (selected) fetchMessages(selected)
        })
        .subscribe()
    } catch { /* realtime may be unavailable */ }
    const poll = setInterval(() => {
      fetchSessions()
      if (selected) fetchMessages(selected)
    }, 30_000)
    return () => {
      clearInterval(poll)
      if (ch) supabase.removeChannel(ch)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.sender_id])

  // ── Actions ────────────────────────────────────────────────────────────────

  async function callAction(path: string, body?: Record<string, string>) {
    if (!selected) return
    setSending(true)
    try {
      const res = await fetch(
        `/api/v1/social/sessions/${encodeURIComponent(selected.sender_id)}/${path}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: selected.platform, ...body }) },
      )
      const d = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
      if (!res.ok) { showToast(d.error ?? 'Imeshindwa', false); return }
      showToast(
        path === 'takeover' ? 'Umechukua mazungumzo ✓' :
        path === 'handback' ? 'Kimerudishwa kwa Amina ✓' :
        'Mazungumzo yamefungwa ✓'
      )
      await fetchMessages(selected)
    } catch { showToast('Tatizo la mtandao', false) }
    setSending(false)
  }

  async function handleSend() {
    if (!selected || !msgText.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/v1/social/sessions/${encodeURIComponent(selected.sender_id)}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: selected.platform, message: msgText.trim() }),
      })
      const d = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
      if (!res.ok) { showToast(d.error ?? 'Imeshindwa kutuma', false); return }
      setMsgText('')
      await fetchMessages(selected)
    } catch { showToast('Tatizo la mtandao', false) }
    setSending(false)
  }

  const counts = {
    pending:  sessions.filter(s => s.status === 'pending').length,
    admin:    sessions.filter(s => s.status === 'admin').length,
    amina:    sessions.filter(s => s.status === 'amina').length,
    resolved: sessions.filter(s => s.status === 'resolved').length,
  }
  const canSend = selected?.status === 'admin'

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white ${toast.ok ? 'bg-gray-900' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* ── LEFT: session list ──────────────────────────────────────────── */}
      <div className={`w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col ${selected ? 'hidden lg:flex' : 'flex'}`}>

        <div className="px-4 py-4 border-b border-gray-100">
          <h1 className="font-bold text-gray-900 text-sm mb-3">DMs ya Social Media</h1>

          {/* Platform tabs */}
          <div className="flex gap-1 mb-3">
            {(['instagram', 'facebook'] as Platform[]).map(p => (
              <button
                key={p}
                onClick={() => { setPlatform(p); setSelected(null) }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${platform === p ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                <PlatformLogo platform={p} size={12} />
                {p === 'instagram' ? 'IG' : 'FB'}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex gap-1 flex-wrap">
            {(['all', 'pending', 'admin', 'amina', 'resolved'] as const).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`text-[10px] font-semibold px-2 py-1 rounded-lg transition-all ${statusFilter === f ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {f === 'all' ? 'Zote' : STATUS_CFG[f].label}
                {f !== 'all' && counts[f] > 0 && <span className="ml-1 opacity-75">({counts[f]})</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400 mt-8">Hakuna mazungumzo</div>
          ) : sessions.map(sess => (
            <button
              key={sess.sender_id}
              onClick={() => setSelected(sess)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-all hover:bg-gray-50 ${selected?.sender_id === sess.sender_id ? 'bg-primary-50' : ''}`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-gray-800 truncate">
                  {sess.sender_name ?? sess.sender_id.slice(0, 12) + '...'}
                </span>
                <StatusBadge status={sess.status} />
              </div>
              <div className="flex items-center gap-1.5">
                <PlatformLogo platform={sess.platform} size={10} />
                <p className="text-[9px] text-gray-400">{relTime(sess.last_message_at)} iliyopita</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── MIDDLE + RIGHT ──────────────────────────────────────────────── */}
      {selected ? (
        <div className="flex-1 flex overflow-hidden min-w-0">

          {/* Chat */}
          <div className="flex-1 flex flex-col min-w-0">

            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
              <button onClick={() => setSelected(null)} className="lg:hidden p-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs">←</button>
              <PlatformLogo platform={selected.platform} size={18} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{selected.sender_name ?? selected.sender_id}</p>
                {selected.escalation_reason && (
                  <p className="text-[10px] text-red-600 truncate">Sababu: {selected.escalation_reason}</p>
                )}
              </div>
              <StatusBadge status={selected.status} />
              <div className="flex lg:hidden gap-1">
                {(['chat', 'controls'] as const).map(t => (
                  <button key={t} onClick={() => setActiveTab(t)}
                    className={`text-xs px-2 py-1 rounded-lg ${activeTab === t ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {t === 'chat' ? 'Chat' : 'Dhibiti'}
                  </button>
                ))}
              </div>
            </div>

            {/* Messages */}
            <div ref={messagesRef} className={`flex-1 overflow-y-auto p-4 space-y-1 ${activeTab !== 'chat' ? 'hidden lg:block' : ''}`}>
              {messages.length === 0
                ? <div className="text-center text-xs text-gray-400 mt-8">Hakuna ujumbe bado</div>
                : messages.map((m, i) => <Bubble key={i} item={m} />)
              }
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className={`border-t border-gray-200 bg-white px-4 py-3 flex-shrink-0 ${activeTab !== 'chat' ? 'hidden lg:flex' : 'flex'} gap-2`}>
              {canSend ? (
                <>
                  <textarea
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                    placeholder="Andika ujumbe wako..."
                    rows={2}
                    className="flex-1 bg-gray-100 rounded-xl px-3 py-2 text-sm resize-none outline-none text-gray-800"
                  />
                  <button onClick={handleSend} disabled={sending || !msgText.trim()}
                    className="bg-primary-500 text-white px-4 rounded-xl text-sm font-semibold disabled:opacity-50 self-end py-2">
                    Tuma
                  </button>
                </>
              ) : (
                <div className="flex-1 text-center py-2 text-xs text-gray-400">
                  {selected.status === 'pending' ? 'Bonyeza "Chukua Mazungumzo" ili uanze kujibu'
                    : selected.status === 'amina' ? 'Amina anashughulikia mazungumzo haya'
                    : 'Mazungumzo yamefungwa'}
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className={`w-64 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-y-auto ${activeTab !== 'controls' ? 'hidden lg:flex' : 'flex w-full lg:w-64'}`}>
            <div className="p-4 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">Udhibiti</p>
              <div className="space-y-2">
                {(selected.status === 'pending' || selected.status === 'amina') && (
                  <button onClick={() => callAction('takeover')} disabled={sending}
                    className="w-full bg-amber-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
                    {selected.status === 'amina' ? 'Chukua kutoka Amina' : 'Chukua Mazungumzo'}
                  </button>
                )}
                {selected.status === 'admin' && (
                  <>
                    <button onClick={() => callAction('handback')} disabled={sending}
                      className="w-full bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
                      Rudisha kwa Amina
                    </button>
                    <button onClick={() => callAction('resolve')} disabled={sending}
                      className="w-full bg-gray-800 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
                      Funge Tatizo
                    </button>
                  </>
                )}
                {selected.status === 'resolved' && (
                  <button onClick={() => callAction('takeover')} disabled={sending}
                    className="w-full bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
                    Fungua Tena
                  </button>
                )}
              </div>
            </div>

            {selected.escalation_reason && (
              <div className="p-4 border-b border-gray-100">
                <p className="text-xs font-bold text-red-600 mb-1.5 uppercase tracking-wider">Sababu ya Kupanda</p>
                <p className="text-xs text-red-700 bg-red-50 rounded-xl p-3 leading-relaxed">{selected.escalation_reason}</p>
              </div>
            )}

            <div className="p-4">
              <p className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Takwimu</p>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-gray-50 rounded-xl p-2">
                  <p className="text-base font-bold text-gray-800">{messages.filter(m => m.kind === 'user').length}</p>
                  <p className="text-[9px] text-gray-500">Ujumbe wa Mteja</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2">
                  <p className="text-base font-bold text-gray-800">{messages.filter(m => m.kind === 'amina').length}</p>
                  <p className="text-[9px] text-gray-500">Majibu ya Amina</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center flex-col gap-3 text-gray-400">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center text-3xl">
            <i className="ti ti-message-dots text-gray-400" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium">Chagua mazungumzo kuanza</p>
          {counts.pending > 0 && (
            <p className="text-xs text-red-500 font-semibold">DMs {counts.pending} zinasubiri msaada</p>
          )}
        </div>
      )}
    </div>
  )
}
