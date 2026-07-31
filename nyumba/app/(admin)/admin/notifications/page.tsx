'use client'
import { useState, useEffect } from 'react'

function fmt(d: string) { return new Date(d).toLocaleString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }

type Notification = { id: string; title: string; body: string; type: string; created_at: string; data: { audience?: string; sent_by?: string } | null }

export default function NotificationsPage() {
  const [tab, setTab]     = useState<'send' | 'history'>('send')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [audience, setAudience] = useState('all')
  const [href, setHref]   = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult]   = useState<{ sent_to?: number; error?: string } | null>(null)
  const [history, setHistory] = useState<Notification[]>([])
  const [histLoading, setHistLoading] = useState(false)

  useEffect(() => {
    if (tab === 'history') {
      setHistLoading(true)
      fetch('/api/v1/admin/notifications/broadcast')
        .then(r => r.json())
        .then((d: { notifications: Notification[] }) => setHistory(d.notifications ?? []))
        .catch(() => {})
        .finally(() => setHistLoading(false))
    }
  }, [tab])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setResult(null)
    try {
      const res  = await fetch('/api/v1/admin/notifications/broadcast', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title, message, audience, href }),
      })
      const data = await res.json() as { sent_to?: number; error?: string }
      setResult(data)
      if (!data.error) { setTitle(''); setMessage(''); setHref('') }
    } catch {
      setResult({ error: 'Imeshindwa kuunganika' })
    } finally {
      setSending(false)
    }
  }

  const AUDIENCE_OPTS = [
    { value: 'all',    label: 'Watumiaji Wote' },
    { value: 'dalali', label: 'Madalali tu' },
    { value: 'client', label: 'Wateja tu' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Taarifa na Broadcast</h1>
        <p className="text-sm text-gray-500 mt-0.5">Tuma taarifa za ndani kwa watumiaji wote au kikundi maalum</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl w-fit">
        {([['send', 'Tuma Taarifa', 'send'], ['history', 'Historia', 'history']] as const).map(([k, l, ic]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === k ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <i className={`ti ti-${ic} text-base`} />
            {l}
          </button>
        ))}
      </div>

      {tab === 'send' && (
        <form onSubmit={handleSend} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-4">
          {result && (
            <div className={`px-4 py-3 rounded-xl text-sm ${result.error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-primary-50 border border-primary-200 text-primary-700'}`}>
              {result.error
                ? result.error
                : <><i className="ti ti-circle-check" /> Imetumwa kwa watumiaji <strong>{result.sent_to?.toLocaleString()}</strong></>
              }
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Hadhira</label>
            <div className="flex gap-2">
              {AUDIENCE_OPTS.map(o => (
                <button key={o.value} type="button" onClick={() => setAudience(o.value)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${audience === o.value ? 'bg-primary-500 text-white border-primary-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              Kichwa <span className="text-red-400">*</span>
            </label>
            <input required value={title} onChange={e => setTitle(e.target.value)} maxLength={100}
              placeholder="Habari mpya kwa mdalali..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              Ujumbe <span className="text-red-400">*</span>
            </label>
            <textarea required value={message} onChange={e => setMessage(e.target.value)} rows={4} maxLength={500}
              placeholder="Maelezo ya taarifa..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
            <p className="text-xs text-gray-400 text-right mt-1">{message.length}/500</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              Kiungo (hiari) — mfano: /dashboard/listings
            </label>
            <input value={href} onChange={e => setHref(e.target.value)}
              placeholder="/dashboard/..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>

          {/* Preview */}
          {(title || message) && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mfano wa Taarifa</p>
              <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                <p className="text-sm font-semibold text-gray-900">{title || '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">{message || '—'}</p>
              </div>
            </div>
          )}

          <button type="submit" disabled={sending || !title.trim() || !message.trim()}
            className="w-full py-3 bg-primary-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
            {sending
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Inatuma...</>
              : <><i className="ti ti-send" /> Tuma kwa {AUDIENCE_OPTS.find(o => o.value === audience)?.label}</>
            }
          </button>
        </form>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {histLoading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)
          ) : history.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-sm text-gray-400">
              Hakuna taarifa zilizotumwa bado
            </div>
          ) : history.map(n => (
            <div key={n.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>
                </div>
                {n.data?.audience && (
                  <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full flex-shrink-0">
                    {n.data.audience === 'all' ? 'Wote' : n.data.audience}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">{fmt(n.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
