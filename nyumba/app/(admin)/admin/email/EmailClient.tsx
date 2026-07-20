'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

type EmailRow = {
  id: string
  thread_id: string
  direction: 'outbound' | 'inbound'
  subject: string
  body_text: string
  from_email: string
  from_name: string | null
  to_email: string
  to_name: string | null
  recipient_type: string | null
  sent_by_name: string | null
  status: string
  created_at: string
}

type Contact = {
  id: string
  name: string
  email: string
  type: 'client' | 'dalali' | 'advertiser'
  meta?: string
}

type Folder = 'sent' | 'inbox'

// ── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  client:     { label: 'Mteja',       color: 'bg-blue-100 text-blue-700',    icon: 'user' },
  dalali:     { label: 'Dalali',      color: 'bg-green-100 text-green-700',  icon: 'home' },
  advertiser: { label: 'Mfanyabiashara', color: 'bg-purple-100 text-purple-700', icon: 'speakerphone' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  pending:  { label: 'Inasubiri',    color: 'text-amber-600',  dot: 'bg-amber-400' },
  sent:     { label: 'Imetumwa',     color: 'text-blue-600',   dot: 'bg-blue-400'  },
  delivered:{ label: 'Imepokelewa',  color: 'text-green-600',  dot: 'bg-green-400' },
  failed:   { label: 'Imeshindwa',   color: 'text-red-600',    dot: 'bg-red-400'   },
  bounced:  { label: 'Ilirudishwa',  color: 'text-red-600',    dot: 'bg-red-400'   },
  received: { label: 'Imepokelewa',  color: 'text-green-600',  dot: 'bg-green-400' },
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)    return 'Sasa hivi'
  if (s < 3600)  return `Dakika ${Math.floor(s / 60)} zilizopita`
  if (s < 86400) return `Saa ${Math.floor(s / 3600)} zilizopita`
  return new Date(iso).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short' })
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

// ── Compose Form ─────────────────────────────────────────────────────────────

function ComposeDrawer({
  onClose,
  onSent,
  replyTo,
}: {
  onClose: () => void
  onSent:  () => void
  replyTo?: EmailRow | null
}) {
  const [to,      setTo]      = useState<Contact | null>(replyTo ? { name: replyTo.from_name ?? replyTo.from_email, email: replyTo.from_email, type: 'client', id: '' } : null)
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, '')}` : '')
  const [body,    setBody]    = useState('')
  const [type,    setType]    = useState<'all' | 'client' | 'dalali' | 'advertiser'>('all')
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<Contact[]>([])
  const [searching, setSearching] = useState(false)
  const [sending,   setSending]   = useState(false)
  const [error,     setError]     = useState('')
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchContacts = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res  = await fetch(`/api/v1/email/contacts?q=${encodeURIComponent(q)}&type=${type}`)
      const data = await res.json() as { contacts: Contact[] }
      setResults(data.contacts ?? [])
    } finally {
      setSearching(false)
    }
  }, [type])

  function handleQueryChange(v: string) {
    setQuery(v)
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => searchContacts(v), 350)
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!to) { setError('Chagua mpokeaji kwanza'); return }
    if (!subject.trim()) { setError('Jaza kichwa cha barua pepe'); return }
    if (!body.trim()) { setError('Jaza maudhui ya barua pepe'); return }
    setSending(true); setError('')
    try {
      const res = await fetch('/api/v1/email/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_email:       to.email,
          to_name:        to.name,
          subject:        subject.trim(),
          body_text:      body.trim(),
          recipient_type: to.type,
          recipient_id:   to.id || undefined,
          thread_id:      replyTo?.thread_id ?? undefined,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Imeshindwa kutuma'); return }
      onSent()
      onClose()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div
        className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl shadow-2xl
                   max-h-[95vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center">
              <i className="ti ti-mail-forward text-primary-600 text-lg" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">
                {replyTo ? 'Jibu Barua Pepe' : 'Barua Pepe Mpya'}
              </h2>
              {replyTo && (
                <p className="text-xs text-gray-400">kwa {replyTo.from_name ?? replyTo.from_email}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSend} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Recipient type selector */}
          {!replyTo && (
            <div className="flex gap-2">
              {(['all', 'client', 'dalali', 'advertiser'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setType(t); setResults([]) }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    type === t
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {t === 'all' ? 'Wote' : TYPE_LABELS[t]?.label ?? t}
                </button>
              ))}
            </div>
          )}

          {/* To field */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Kwa (To)
            </label>
            {to && !replyTo ? (
              <div className="flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-xl px-3 py-2.5">
                <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                  {initials(to.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{to.name}</p>
                  <p className="text-xs text-gray-500 truncate">{to.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setTo(null); setQuery(''); setResults([]) }}
                  className="text-gray-400 hover:text-red-500 p-1"
                >
                  <i className="ti ti-x text-sm" aria-hidden="true" />
                </button>
              </div>
            ) : replyTo ? (
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                  {initials(replyTo.from_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{replyTo.from_name ?? replyTo.from_email}</p>
                  <p className="text-xs text-gray-500 truncate">{replyTo.from_email}</p>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5">
                  <i className="ti ti-search text-gray-400 text-sm flex-shrink-0" aria-hidden="true" />
                  <input
                    type="text"
                    placeholder="Tafuta jina, barua pepe, au simu..."
                    value={query}
                    onChange={e => handleQueryChange(e.target.value)}
                    className="flex-1 text-sm focus:outline-none bg-transparent"
                  />
                  {searching && (
                    <div className="w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin flex-shrink-0" />
                  )}
                </div>
                {results.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-10 overflow-hidden max-h-56 overflow-y-auto">
                    {results.map(c => {
                      const tc = TYPE_LABELS[c.type]
                      return (
                        <button
                          key={c.id + c.email}
                          type="button"
                          onClick={() => { setTo(c); setQuery(''); setResults([]) }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors border-b border-gray-50 last:border-0"
                        >
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-bold text-xs flex-shrink-0">
                            {initials(c.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                            <p className="text-xs text-gray-500 truncate">{c.email}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${tc?.color ?? ''}`}>
                            {tc?.label ?? c.type}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Kichwa (Subject)
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Mada ya barua pepe..."
              className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Ujumbe
            </label>
            <textarea
              required
              rows={7}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Andika ujumbe wako hapa...

Mfano:
Habari,

Tunakujulisha kuhusu akaunti yako kwenye NyumbaFasta.
..."
              className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">{body.length} herufi</p>
          </div>

          <button
            type="submit"
            disabled={sending || (!to && !replyTo)}
            className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-40 text-white py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {sending
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Inatuma...</>
              : <><i className="ti ti-send" aria-hidden="true" />Tuma Barua Pepe</>}
          </button>

          <p className="text-center text-xs text-gray-400">
            Itatumwa kupitia <strong>noreply@nyumbafasta.co</strong> kwa kutumia Resend
          </p>
        </form>
      </div>
    </div>
  )
}

// ── Email Detail / Thread View ───────────────────────────────────────────────

function EmailDetail({
  email,
  onClose,
  onReply,
}: {
  email: EmailRow
  onClose: () => void
  onReply: (e: EmailRow) => void
}) {
  const [thread, setThread] = useState<EmailRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/v1/email/${email.id}`)
      .then(r => r.json())
      .then(d => setThread(d.thread ?? [email]))
      .catch(() => setThread([email]))
      .finally(() => setLoading(false))
  }, [email])

  const counterpart = email.direction === 'outbound'
    ? { name: email.to_name ?? email.to_email, email: email.to_email }
    : { name: email.from_name ?? email.from_email, email: email.from_email }

  const typeCfg = email.recipient_type ? TYPE_LABELS[email.recipient_type] : null

  return (
    <div className="flex flex-col h-full">
      {/* Detail header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 flex-shrink-0">
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 flex-shrink-0 lg:hidden"
        >
          <i className="ti ti-arrow-left" aria-hidden="true" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 text-sm truncate">{email.subject}</h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p className="text-xs text-gray-500 truncate">
              {email.direction === 'outbound' ? 'Kwa: ' : 'Kutoka: '}
              <span className="font-medium text-gray-700">{counterpart.name}</span>
            </p>
            {typeCfg && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${typeCfg.color}`}>
                {typeCfg.label}
              </span>
            )}
          </div>
        </div>
        {email.direction === 'inbound' && (
          <button
            onClick={() => onReply(email)}
            className="flex-shrink-0 flex items-center gap-1.5 bg-primary-500 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-primary-600 transition"
          >
            <i className="ti ti-corner-up-left" aria-hidden="true" />
            Jibu
          </button>
        )}
      </div>

      {/* Thread messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1,2].map(i => (
              <div key={i} className="bg-gray-50 rounded-2xl p-4 animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded w-40" />
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          thread.map((msg, i) => {
            const isOut = msg.direction === 'outbound'
            const st    = STATUS_CONFIG[msg.status] ?? STATUS_CONFIG['sent']
            return (
              <div key={msg.id} className={`${i === 0 ? '' : 'border-t border-gray-100 pt-4'}`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isOut ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {isOut ? initials(msg.sent_by_name) : initials(msg.from_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">
                        {isOut ? (msg.sent_by_name ?? 'Timu ya NyumbaFasta') : (msg.from_name ?? msg.from_email)}
                      </span>
                      {isOut && (
                        <span className="text-xs text-gray-400">
                          → {msg.to_name ?? msg.to_email}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{timeAgo(msg.created_at)}</span>
                      <span className={`flex items-center gap-1 text-[10px] font-semibold ${st.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={`rounded-2xl px-4 py-3.5 ${
                  isOut ? 'bg-primary-50 border border-primary-100' : 'bg-gray-50 border border-gray-100'
                }`}>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{msg.body_text}</p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Email List Item ───────────────────────────────────────────────────────────

function EmailListItem({
  email,
  isSelected,
  onClick,
}: {
  email: EmailRow
  isSelected: boolean
  onClick: () => void
}) {
  const isOut  = email.direction === 'outbound'
  const name   = isOut ? (email.to_name ?? email.to_email) : (email.from_name ?? email.from_email)
  const addr   = isOut ? email.to_email : email.from_email
  const tc     = email.recipient_type ? TYPE_LABELS[email.recipient_type] : null
  const st     = STATUS_CONFIG[email.status] ?? STATUS_CONFIG['sent']

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-gray-100 last:border-0 transition-colors ${
        isSelected ? 'bg-primary-50' : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
          isSelected ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'
        }`}>
          {initials(name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className={`text-sm font-semibold truncate ${isSelected ? 'text-primary-700' : 'text-gray-900'}`}>
              {name}
            </span>
            <span className="text-[11px] text-gray-400 flex-shrink-0">{timeAgo(email.created_at)}</span>
          </div>
          <p className={`text-xs truncate mb-1 ${isSelected ? 'text-primary-600' : 'text-gray-700'} font-medium`}>
            {email.subject}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400 truncate">{addr}</span>
            {tc && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${tc.color}`}>
                {tc.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-1">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`} />
            <span className={`text-[10px] font-semibold ${st.color}`}>{st.label}</span>
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function EmailClient({ senderName }: { senderName: string }) {
  const [folder,    setFolder]    = useState<Folder>('sent')
  const [emails,    setEmails]    = useState<EmailRow[]>([])
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState<EmailRow | null>(null)
  const [composing, setComposing] = useState(false)
  const [replyTo,   setReplyTo]   = useState<EmailRow | null>(null)
  const [q,         setQ]         = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [toast,     setToast]     = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const loadEmails = useCallback(async () => {
    setLoading(true)
    try {
      const direction = folder === 'inbox' ? 'inbound' : 'outbound'
      const url = `/api/v1/email/list?direction=${direction}&q=${encodeURIComponent(q)}&type=${typeFilter}&page=${page}`
      const res  = await fetch(url)
      const data = await res.json() as { emails: EmailRow[]; total: number }
      setEmails(data.emails ?? [])
      setTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [folder, q, typeFilter, page])

  useEffect(() => { loadEmails() }, [loadEmails])

  // Reset page when folder/filter changes
  useEffect(() => { setPage(1); setSelected(null) }, [folder, typeFilter, q])

  function handleSent() {
    showToast('Barua pepe imetumwa!')
    setFolder('sent')
    loadEmails()
  }

  function handleReply(email: EmailRow) {
    setReplyTo(email)
    setComposing(true)
  }

  const totalPages = Math.ceil(total / 25)
  const hasInbox   = folder === 'inbox'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-xl shadow-xl text-sm text-white font-medium transition-all ${
          toast.ok ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toast.ok
            ? <i className="ti ti-circle-check mr-2" aria-hidden="true" />
            : <i className="ti ti-circle-x mr-2" aria-hidden="true" />}
          {toast.msg}
        </div>
      )}

      {/* Compose drawer */}
      {composing && (
        <ComposeDrawer
          replyTo={replyTo}
          onClose={() => { setComposing(false); setReplyTo(null) }}
          onSent={handleSent}
        />
      )}

      <div className="max-w-7xl mx-auto">

        {/* ── Page header ── */}
        <div className="px-5 pt-6 pb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <i className="ti ti-mail text-primary-500" aria-hidden="true" />
              Barua Pepe
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Unatuma kama <span className="font-medium text-gray-700">{senderName}</span>
            </p>
          </div>
          <button
            onClick={() => { setReplyTo(null); setComposing(true) }}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all active:scale-[0.97] shadow-sm"
          >
            <i className="ti ti-pencil-plus" aria-hidden="true" />
            <span className="hidden sm:inline">Andika</span>
          </button>
        </div>

        <div className="px-5 pb-6 flex flex-col lg:flex-row gap-5">

          {/* ── Left: folder list + email list ── */}
          <div className={`flex flex-col gap-3 ${selected ? 'hidden lg:flex lg:w-[380px] xl:w-[420px]' : 'w-full lg:w-[380px] xl:w-[420px]'} flex-shrink-0`}>

            {/* Folder tabs */}
            <div className="bg-white rounded-2xl border border-gray-200 p-1.5 flex gap-1">
              {([
                { key: 'sent',  label: 'Zilizotumwa', icon: 'send' },
                { key: 'inbox', label: 'Inbox',        icon: 'inbox' },
              ] as const).map(f => (
                <button
                  key={f.key}
                  onClick={() => setFolder(f.key)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    folder === f.key
                      ? 'bg-primary-500 text-white shadow-sm'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <i className={`ti ti-${f.icon}`} aria-hidden="true" />
                  {f.label}
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" aria-hidden="true" />
                <input
                  type="text"
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Tafuta..."
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                />
              </div>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="border border-gray-200 rounded-xl px-2.5 py-2 text-sm text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                <option value="all">Wote</option>
                <option value="client">Wateja</option>
                <option value="dalali">Madalali</option>
                <option value="advertiser">Wafanyabiashara</option>
              </select>
            </div>

            {/* Email list */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden min-h-[200px]">
              {loading ? (
                <div className="divide-y divide-gray-50">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="px-4 py-3.5 flex gap-3 animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 bg-gray-100 rounded w-32" />
                        <div className="h-3 bg-gray-100 rounded w-full" />
                        <div className="h-3 bg-gray-100 rounded w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : emails.length === 0 ? (
                <div className="py-16 text-center">
                  <i className={`ti ti-${hasInbox ? 'inbox' : 'send'} text-5xl text-gray-200 block mb-3`} aria-hidden="true" />
                  <p className="text-gray-500 font-medium text-sm">
                    {hasInbox ? 'Hakuna barua pepe zilizopokelewa' : 'Bado hujatuma barua pepe'}
                  </p>
                  {!hasInbox && (
                    <button
                      onClick={() => { setReplyTo(null); setComposing(true) }}
                      className="mt-3 text-primary-600 hover:underline text-sm font-medium"
                    >
                      Tuma ya kwanza →
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="divide-y divide-gray-100">
                    {emails.map(email => (
                      <EmailListItem
                        key={email.id}
                        email={email}
                        isSelected={selected?.id === email.id}
                        onClick={() => setSelected(email)}
                      />
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                      <button
                        disabled={page <= 1}
                        onClick={() => setPage(p => p - 1)}
                        className="text-xs text-gray-500 disabled:opacity-30 hover:text-gray-700 font-medium"
                      >
                        ← Iliyotangulia
                      </button>
                      <span className="text-xs text-gray-400">
                        Ukurasa {page} / {totalPages} · {total} jumla
                      </span>
                      <button
                        disabled={page >= totalPages}
                        onClick={() => setPage(p => p + 1)}
                        className="text-xs text-gray-500 disabled:opacity-30 hover:text-gray-700 font-medium"
                      >
                        Inayofuata →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Right: detail pane ── */}
          <div className={`flex-1 min-w-0 ${selected ? 'block' : 'hidden lg:block'}`}>
            {selected ? (
              <div className="bg-white rounded-2xl border border-gray-200 h-full flex flex-col" style={{ minHeight: '500px' }}>
                <EmailDetail
                  email={selected}
                  onClose={() => setSelected(null)}
                  onReply={handleReply}
                />
              </div>
            ) : (
              <div className="hidden lg:flex bg-white rounded-2xl border border-gray-200 items-center justify-center py-24 text-center">
                <div>
                  <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <i className="ti ti-mail-opened text-primary-400 text-3xl" aria-hidden="true" />
                  </div>
                  <p className="font-semibold text-gray-600 mb-1">Chagua barua pepe kuisoma</p>
                  <p className="text-sm text-gray-400">Au andika barua pepe mpya</p>
                  <button
                    onClick={() => { setReplyTo(null); setComposing(true) }}
                    className="mt-4 bg-primary-500 hover:bg-primary-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition"
                  >
                    <i className="ti ti-pencil-plus mr-2" aria-hidden="true" />
                    Andika Barua Pepe
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
