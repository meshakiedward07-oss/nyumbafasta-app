'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = 'amina' | 'pending' | 'admin' | 'resolved'

interface WASession {
  id: string
  phone_number: string
  status: Status
  assigned_admin_id: string | null
  escalation_reason: string | null
  escalated_at: string | null
  last_message_at: string
  last_message?: { content: string; sender: string; direction: string; created_at: string } | null
  message_count: number
}

interface WAMessage {
  id: string
  phone_number: string
  direction: 'inbound' | 'outbound'
  sender: 'user' | 'amina' | 'admin' | 'system'
  content: string
  message_id: string | null
  status: string
  created_at: string
}

interface Instruction {
  id: string
  instruction: string
  scope: 'global' | 'phone_specific'
  phone_number: string | null
  created_at: string
}

// ── Status display helpers ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<Status, { label: string; dot: string; bg: string; text: string }> = {
  pending:  { label: 'Inasubiri',  dot: 'bg-red-500',    bg: 'bg-red-50',    text: 'text-red-700'   },
  admin:    { label: 'Admin',      dot: 'bg-amber-500',  bg: 'bg-amber-50',  text: 'text-amber-700' },
  amina:    { label: 'Amina',      dot: 'bg-green-500',  bg: 'bg-green-50',  text: 'text-green-700' },
  resolved: { label: 'Imefungwa', dot: 'bg-gray-400',   bg: 'bg-gray-50',   text: 'text-gray-600'  },
}

function StatusBadge({ status }: { status: Status }) {
  const c = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: WAMessage }) {
  const time = new Date(msg.created_at).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })
  const isSystem = msg.sender === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[10px] text-gray-400 bg-gray-100 rounded-full px-3 py-1 italic">
          {msg.content}
        </span>
      </div>
    )
  }

  const isUser  = msg.sender === 'user'
  const isAdmin = msg.sender === 'admin'
  const isAmina = msg.sender === 'amina'

  const bubbleClass = isUser
    ? 'bg-blue-500 text-white rounded-tl-2xl rounded-tr-2xl rounded-br-2xl'
    : isAdmin
      ? 'bg-amber-500 text-white rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl'
      : 'bg-[#E1F5EE] text-gray-800 rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl'

  const label = isUser ? 'Mteja' : isAdmin ? 'Admin' : isAmina ? 'Amina' : ''
  const labelColor = isUser ? 'text-blue-600' : isAdmin ? 'text-amber-600' : 'text-[#1D9E75]'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-[75%] ${isUser ? '' : ''}`}>
        <p className={`text-[10px] font-semibold mb-0.5 ${isUser ? 'text-right' : 'text-left'} ${labelColor}`}>
          {label}
        </p>
        <div className={`px-3 py-2 text-sm ${bubbleClass}`}>
          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        </div>
        <p className={`text-[9px] text-gray-400 mt-0.5 ${isUser ? 'text-right' : 'text-left'}`}>{time}</p>
      </div>
    </div>
  )
}

// ── Relative time ─────────────────────────────────────────────────────────────

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'sasa hivi'
  if (m < 60) return `dakika ${m}`
  const h = Math.floor(m / 60)
  if (h < 24) return `saa ${h}`
  return `siku ${Math.floor(h / 24)}`
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WhatsAppPanel() {
  const [sessions, setSessions] = useState<WASession[]>([])
  const [selected, setSelected] = useState<WASession | null>(null)
  const [messages, setMessages] = useState<WAMessage[]>([])
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all')
  const [search, setSearch] = useState('')
  const [msgText, setMsgText] = useState('')
  const [noteText, setNoteText] = useState('')
  const [instrText, setInstrText] = useState('')
  const [instrScope, setInstrScope] = useState<'global' | 'phone_specific'>('phone_specific')
  const [instructions, setInstructions] = useState<Instruction[]>([])
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'chat' | 'controls'>('chat')

  const bottomRef = useRef<HTMLDivElement>(null)

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    const url = statusFilter !== 'all'
      ? `/api/v1/whatsapp/sessions?status=${statusFilter}&limit=50`
      : '/api/v1/whatsapp/sessions?limit=50'
    const res = await fetch(url)
    if (!res.ok) return
    const data = await res.json()
    setSessions(data.sessions ?? [])
    setLoading(false)
  }, [statusFilter])

  const fetchMessages = useCallback(async (phone: string) => {
    const res = await fetch(`/api/v1/whatsapp/sessions/${encodeURIComponent(phone)}`)
    if (!res.ok) return
    const data = await res.json()
    setMessages(data.messages ?? [])
    if (data.session) {
      setSessions(prev => prev.map(s => s.phone_number === phone ? { ...s, ...data.session } : s))
      setSelected(prev => prev?.phone_number === phone ? { ...prev, ...data.session } : prev)
    }
  }, [])

  const fetchInstructions = useCallback(async (phone: string) => {
    const res = await fetch(`/api/v1/whatsapp/instructions?phone=${phone}`)
    if (!res.ok) return
    const data = await res.json()
    setInstructions(data.instructions ?? [])
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  useEffect(() => {
    if (!selected) return
    fetchMessages(selected.phone_number)
    fetchInstructions(selected.phone_number)
  }, [selected?.phone_number, fetchMessages, fetchInstructions])

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Real-time subscriptions ────────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient()
    const suffix   = Math.random().toString(36).slice(2)

    let sessionChannel: ReturnType<typeof supabase.channel> | null = null
    let msgChannel: ReturnType<typeof supabase.channel> | null = null

    try {
      sessionChannel = supabase
        .channel(`wa-sessions-${suffix}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_sessions' }, () => {
          fetchSessions()
          if (selected) fetchMessages(selected.phone_number)
        })
        .subscribe()

      msgChannel = supabase
        .channel(`wa-messages-${suffix}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
          const newMsg = payload.new as WAMessage
          if (newMsg.phone_number === selected?.phone_number) {
            setMessages(prev => [...prev, newMsg])
          }
          fetchSessions()
        })
        .subscribe()
    } catch {
      // realtime not available or table missing — polling fallback is fine
    }

    return () => {
      if (sessionChannel) supabase.removeChannel(sessionChannel)
      if (msgChannel)     supabase.removeChannel(msgChannel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.phone_number])

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleTakeover() {
    if (!selected) return
    setSending(true)
    await fetch(`/api/v1/whatsapp/sessions/${encodeURIComponent(selected.phone_number)}/takeover`, { method: 'POST' })
    await fetchMessages(selected.phone_number)
    setSending(false)
  }

  async function handleHandback() {
    if (!selected) return
    setSending(true)
    await fetch(`/api/v1/whatsapp/sessions/${encodeURIComponent(selected.phone_number)}/handback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: noteText.trim() || undefined }),
    })
    setNoteText('')
    await fetchMessages(selected.phone_number)
    setSending(false)
  }

  async function handleResolve() {
    if (!selected) return
    setSending(true)
    await fetch(`/api/v1/whatsapp/sessions/${encodeURIComponent(selected.phone_number)}/resolve`, { method: 'POST' })
    await fetchMessages(selected.phone_number)
    setSending(false)
  }

  async function handleSend() {
    if (!selected || !msgText.trim()) return
    setSending(true)
    await fetch(`/api/v1/whatsapp/sessions/${encodeURIComponent(selected.phone_number)}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msgText.trim() }),
    })
    setMsgText('')
    await fetchMessages(selected.phone_number)
    setSending(false)
  }

  async function handleAddInstruction() {
    if (!instrText.trim()) return
    setSending(true)
    await fetch('/api/v1/whatsapp/instructions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instruction: instrText.trim(),
        scope: instrScope,
        phone_number: instrScope === 'phone_specific' ? selected?.phone_number : undefined,
      }),
    })
    setInstrText('')
    if (selected) fetchInstructions(selected.phone_number)
    setSending(false)
  }

  async function handleDeleteInstruction(id: string) {
    await fetch(`/api/v1/whatsapp/instructions/${id}`, { method: 'DELETE' })
    if (selected) fetchInstructions(selected.phone_number)
  }

  // ── Filtered sessions ──────────────────────────────────────────────────────

  const filtered = sessions.filter(s => {
    if (search) return s.phone_number.includes(search)
    return true
  })

  const counts = {
    pending:  sessions.filter(s => s.status === 'pending').length,
    admin:    sessions.filter(s => s.status === 'admin').length,
    amina:    sessions.filter(s => s.status === 'amina').length,
    resolved: sessions.filter(s => s.status === 'resolved').length,
  }

  const canSend = selected?.status === 'admin'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ── LEFT: Conversation list ──────────────────────────────────────── */}
      <div className={`w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col ${selected ? 'hidden lg:flex' : 'flex'}`}>

        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-bold text-gray-900 text-sm">Mazungumzo ya WhatsApp</h1>
            <Link href="/admin/whatsapp/broadcast" className="text-xs text-[#1D9E75] font-semibold">
              Broadcast
            </Link>
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tafuta namba..."
            className="w-full bg-gray-100 rounded-xl px-3 py-2 text-xs text-gray-700 outline-none"
          />

          {/* Status filter tabs */}
          <div className="flex gap-1 mt-2 flex-wrap">
            {(['all', 'pending', 'admin', 'amina', 'resolved'] as const).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`text-[10px] font-semibold px-2 py-1 rounded-lg transition-all ${
                  statusFilter === f
                    ? 'bg-[#1D9E75] text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {f === 'all' ? 'Zote' : STATUS_CONFIG[f].label}
                {f !== 'all' && counts[f] > 0 && (
                  <span className="ml-1 opacity-75">({counts[f]})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400 mt-8">
              Hakuna mazungumzo
            </div>
          ) : (
            filtered.map(session => (
              <button
                key={session.phone_number}
                onClick={() => setSelected(session)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-all hover:bg-gray-50 ${
                  selected?.phone_number === session.phone_number ? 'bg-[#E1F5EE]' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-800 font-mono">
                    +{session.phone_number}
                  </span>
                  <StatusBadge status={session.status} />
                </div>
                {session.last_message && (
                  <p className="text-[10px] text-gray-500 truncate">
                    {session.last_message.sender === 'admin' ? '(Admin) ' : ''}
                    {session.last_message.content}
                  </p>
                )}
                <p className="text-[9px] text-gray-400 mt-0.5">
                  {relativeTime(session.last_message_at)} iliyopita
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── MIDDLE + RIGHT (when conversation selected) ──────────────────── */}
      {selected ? (
        <div className="flex-1 flex overflow-hidden min-w-0">

          {/* ── MIDDLE: Chat window ──────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0">

            {/* Chat header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
              <button
                onClick={() => setSelected(null)}
                className="lg:hidden p-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs"
              >
                ←
              </button>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm font-mono">+{selected.phone_number}</p>
                {selected.escalation_reason && (
                  <p className="text-[10px] text-red-600 truncate">Sababu: {selected.escalation_reason}</p>
                )}
              </div>
              <StatusBadge status={selected.status} />

              {/* Mobile tab toggle */}
              <div className="flex lg:hidden gap-1">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`text-xs px-2 py-1 rounded-lg ${activeTab === 'chat' ? 'bg-[#1D9E75] text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab('controls')}
                  className={`text-xs px-2 py-1 rounded-lg ${activeTab === 'controls' ? 'bg-[#1D9E75] text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  Dhibiti
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className={`flex-1 overflow-y-auto p-4 space-y-1 ${activeTab !== 'chat' ? 'hidden lg:block' : ''}`}>
              {messages.length === 0 ? (
                <div className="text-center text-xs text-gray-400 mt-8">
                  Hakuna ujumbe bado
                </div>
              ) : (
                messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
              )}
              <div ref={bottomRef} />
            </div>

            {/* Message input */}
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
                  <button
                    onClick={handleSend}
                    disabled={sending || !msgText.trim()}
                    className="bg-[#1D9E75] text-white px-4 rounded-xl text-sm font-semibold disabled:opacity-50 self-end py-2"
                  >
                    Tuma
                  </button>
                </>
              ) : (
                <div className="flex-1 text-center py-2 text-xs text-gray-400">
                  {selected.status === 'pending'
                    ? 'Bonyeza "Chukua" ili uanze kujibu'
                    : selected.status === 'amina'
                      ? 'Amina anashughulikia mazungumzo haya'
                      : 'Mazungumzo yamefungwa'}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Controls ──────────────────────────────────────── */}
          <div className={`w-72 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-y-auto ${activeTab !== 'controls' ? 'hidden lg:flex' : 'flex w-full lg:w-72'}`}>

            {/* Session controls */}
            <div className="p-4 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">Udhibiti wa Mazungumzo</p>

              <div className="space-y-2">
                {selected.status === 'pending' && (
                  <button
                    onClick={handleTakeover}
                    disabled={sending}
                    className="w-full bg-amber-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                  >
                    Chukua Mazungumzo
                  </button>
                )}

                {selected.status === 'amina' && (
                  <button
                    onClick={handleTakeover}
                    disabled={sending}
                    className="w-full bg-amber-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                  >
                    Chukua kutoka Amina
                  </button>
                )}

                {selected.status === 'admin' && (
                  <>
                    <div>
                      <textarea
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        placeholder="Maelezo kwa Amina (hiari)..."
                        rows={2}
                        className="w-full bg-gray-100 rounded-xl px-3 py-2 text-xs resize-none outline-none text-gray-700 mb-2"
                      />
                      <button
                        onClick={handleHandback}
                        disabled={sending}
                        className="w-full bg-[#1D9E75] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                      >
                        Rudisha kwa Amina
                      </button>
                    </div>
                    <button
                      onClick={handleResolve}
                      disabled={sending}
                      className="w-full bg-gray-800 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                    >
                      Funge Tatizo
                    </button>
                  </>
                )}

                {selected.status === 'resolved' && (
                  <button
                    onClick={handleTakeover}
                    disabled={sending}
                    className="w-full bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                  >
                    Fungua Tena
                  </button>
                )}
              </div>
            </div>

            {/* Escalation info */}
            {selected.escalation_reason && (
              <div className="p-4 border-b border-gray-100">
                <p className="text-xs font-bold text-red-600 mb-1.5 uppercase tracking-wider">Sababu ya Kupanda</p>
                <p className="text-xs text-red-700 bg-red-50 rounded-xl p-3 leading-relaxed">
                  {selected.escalation_reason}
                </p>
                {selected.escalated_at && (
                  <p className="text-[9px] text-gray-400 mt-1">
                    {new Date(selected.escalated_at).toLocaleString('sw-TZ')}
                  </p>
                )}
              </div>
            )}

            {/* Amina instructions */}
            <div className="p-4 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">Maelekezo kwa Amina</p>

              {/* Add instruction */}
              <div className="mb-3 space-y-2">
                <div className="flex gap-1">
                  <button
                    onClick={() => setInstrScope('phone_specific')}
                    className={`flex-1 text-[10px] py-1.5 rounded-lg font-semibold ${instrScope === 'phone_specific' ? 'bg-[#1D9E75] text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    Kwa namba hii
                  </button>
                  <button
                    onClick={() => setInstrScope('global')}
                    className={`flex-1 text-[10px] py-1.5 rounded-lg font-semibold ${instrScope === 'global' ? 'bg-[#1D9E75] text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    Kwa wote
                  </button>
                </div>
                <textarea
                  value={instrText}
                  onChange={e => setInstrText(e.target.value)}
                  placeholder={instrScope === 'global' ? 'Mfano: Leo kuna matengenezo 2pm...' : 'Mfano: Mwambie apate refund...'}
                  rows={2}
                  className="w-full bg-gray-100 rounded-xl px-3 py-2 text-xs resize-none outline-none text-gray-700"
                />
                <button
                  onClick={handleAddInstruction}
                  disabled={sending || !instrText.trim()}
                  className="w-full bg-[#1D9E75] text-white py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  Ongeza Maelekezo
                </button>
              </div>

              {/* Active instructions */}
              {instructions.length > 0 ? (
                <div className="space-y-2">
                  {instructions.map(instr => (
                    <div key={instr.id} className="bg-[#E1F5EE] rounded-xl p-2.5 flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] text-[#1D9E75] font-bold mb-0.5">
                          {instr.scope === 'global' ? 'Kwa wote' : 'Namba hii'}
                        </p>
                        <p className="text-xs text-gray-700 leading-relaxed">{instr.instruction}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteInstruction(instr.id)}
                        className="text-red-400 hover:text-red-600 text-xs flex-shrink-0 mt-0.5"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-gray-400 text-center">Hakuna maelekezo</p>
              )}
            </div>

            {/* Quick stats */}
            <div className="p-4">
              <p className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Takwimu</p>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-gray-50 rounded-xl p-2">
                  <p className="text-base font-bold text-gray-800">{messages.filter(m => m.direction === 'inbound').length}</p>
                  <p className="text-[9px] text-gray-500">Ujumbe wa Mteja</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2">
                  <p className="text-base font-bold text-gray-800">{messages.filter(m => m.direction === 'outbound' && m.sender === 'amina').length}</p>
                  <p className="text-[9px] text-gray-500">Majibu ya Amina</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── Empty state ─────────────────────────────────────────────── */
        <div className="hidden lg:flex flex-1 items-center justify-center flex-col gap-3 text-gray-400">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center text-3xl">💬</div>
          <p className="text-sm font-medium">Chagua mazungumzo kuanza</p>
          {counts.pending > 0 && (
            <p className="text-xs text-red-500 font-semibold">
              Mazungumzo {counts.pending} yanasubiri msaada
            </p>
          )}
        </div>
      )}
    </div>
  )
}
