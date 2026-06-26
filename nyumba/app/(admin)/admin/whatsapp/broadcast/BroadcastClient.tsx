'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

type Target  = 'all_dalali' | 'active_dalali' | 'new_dalali' | 'specific'
type Tone    = 'personal' | 'formal' | 'urgent'
type BStatus = 'pending' | 'sending' | 'completed' | 'failed'

interface BroadcastRecord {
  id: string
  target: string
  message: string
  tone: string
  recipients_count: number
  sent_count: number
  failed_count: number
  status: BStatus
  created_at: string
  completed_at: string | null
}

const TARGET_OPTIONS: { value: Target; label: string; desc: string }[] = [
  { value: 'all_dalali',    label: 'Madalali Wote',             desc: 'Madalali wote waliojisajili' },
  { value: 'active_dalali', label: 'Subscription Active',       desc: 'Madalali wenye subscription inayoendelea' },
  { value: 'new_dalali',    label: 'Madalali Wapya (wiki hii)', desc: 'Waliojisajili wiki hii' },
]

const TONE_OPTIONS: { value: Tone; label: string; prefix: string }[] = [
  { value: 'personal', label: 'Personal',  prefix: 'Habari {jina}! 😊' },
  { value: 'formal',   label: 'Rasmi',     prefix: 'Kwa heshima, {jina},' },
  { value: 'urgent',   label: 'Dharura',   prefix: 'MUHIMU — {jina},' },
]

function StatusPill({ status }: { status: BStatus }) {
  const map: Record<BStatus, { label: string; cls: string }> = {
    pending:   { label: 'Inasubiri', cls: 'bg-gray-100 text-gray-600'   },
    sending:   { label: 'Inatuma…',  cls: 'bg-amber-100 text-amber-700' },
    completed: { label: 'Imekamilika', cls: 'bg-green-100 text-green-700' },
    failed:    { label: 'Imeshindwa', cls: 'bg-red-100 text-red-700'   },
  }
  const c = map[status]
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.cls}`}>{c.label}</span>
}

export default function BroadcastClient() {
  const [target,  setTarget]  = useState<Target>('all_dalali')
  const [tone,    setTone]    = useState<Tone>('personal')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [result,  setResult]  = useState<{ sent_count: number; failed_count: number; recipients_count: number } | null>(null)
  const [history, setHistory] = useState<BroadcastRecord[]>([])

  useEffect(() => { fetchHistory() }, [])

  useEffect(() => {
    const tonePrefix = TONE_OPTIONS.find(t => t.value === tone)?.prefix ?? ''
    const sample = `${tonePrefix}\n\n${message}`.replace(/\{jina\}/gi, 'John')
    setPreview(sample)
  }, [tone, message])

  async function fetchHistory() {
    const res = await fetch('/api/v1/whatsapp/broadcast')
    if (!res.ok) return
    const data = await res.json()
    setHistory(data.broadcasts ?? [])
  }

  async function handleSend() {
    if (!message.trim()) return
    if (!confirm(`Utumie ujumbe kwa ${TARGET_OPTIONS.find(t => t.value === target)?.label}?\n\nHii itafanywa MARA MOJA na haiwezi kubatilishwa.`)) return

    setSending(true)
    setResult(null)
    setSendError('')

    const res = await fetch('/api/v1/whatsapp/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, message: message.trim(), tone }),
    })

    const data = await res.json()
    setSending(false)

    if (res.ok) {
      setResult({ sent_count: data.sent_count, failed_count: data.failed_count, recipients_count: data.recipients_count })
      setMessage('')
      fetchHistory()
    } else {
      setSendError(data.error ?? 'Imeshindwa kutuma ujumbe')
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/whatsapp" className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 text-sm">
          ←
        </Link>
        <div>
          <h1 className="font-bold text-gray-900 text-lg">Tuma Ujumbe wa Wingi</h1>
          <p className="text-xs text-gray-500">Broadcast WhatsApp kwa madalali</p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">

        {/* Target */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm font-bold text-gray-900 mb-3">Wapokeaji</p>
          <div className="space-y-2">
            {TARGET_OPTIONS.map(opt => (
              <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                target === opt.value ? 'border-[#1D9E75] bg-[#E1F5EE]' : 'border-gray-100 bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="target"
                  value={opt.value}
                  checked={target === opt.value}
                  onChange={() => setTarget(opt.value)}
                  className="mt-0.5 accent-[#1D9E75]"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Tone */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm font-bold text-gray-900 mb-3">Sauti ya Ujumbe</p>
          <div className="flex gap-2 flex-wrap">
            {TONE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTone(opt.value)}
                className={`flex-1 py-2.5 px-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                  tone === opt.value
                    ? 'border-[#1D9E75] bg-[#1D9E75] text-white'
                    : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                <div>{opt.label}</div>
                <div className="font-normal opacity-70 mt-0.5 truncate">{opt.prefix.replace('{jina}','John')}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm font-bold text-gray-900 mb-1">Ujumbe</p>
          <p className="text-xs text-gray-400 mb-3">Tumia <code className="bg-gray-100 px-1 rounded">{'{jina}'}</code> kwa jina la mtu binafsi</p>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={4}
            placeholder="Andika ujumbe wako hapa..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 resize-none outline-none focus:border-[#1D9E75]"
          />
          <p className="text-[10px] text-gray-400 text-right mt-1">{message.length} herufi</p>
        </div>

        {/* Preview */}
        {message.trim() && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-sm font-bold text-gray-900 mb-3">Mfano wa Ujumbe</p>
            <div className="bg-[#E1F5EE] rounded-xl p-4">
              <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{preview}</p>
            </div>
          </div>
        )}

        {/* Send error */}
        {sendError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-xl">❌</span>
            <div>
              <p className="text-sm font-bold text-red-800">Broadcast Imeshindwa</p>
              <p className="text-xs text-red-700 mt-1">{sendError}</p>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-xl">✅</span>
            <div>
              <p className="text-sm font-bold text-green-800">Broadcast Imekamilika!</p>
              <p className="text-xs text-green-700 mt-1">
                Imetumwa: <strong>{result.sent_count}</strong> kati ya <strong>{result.recipients_count}</strong>
                {result.failed_count > 0 && <span className="text-red-600"> · Imeshindwa: {result.failed_count}</span>}
              </p>
            </div>
          </div>
        )}

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={sending || !message.trim()}
          className="w-full bg-[#1D9E75] text-white py-4 rounded-2xl text-sm font-bold disabled:opacity-50 shadow-md"
        >
          {sending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span> Inatuma...
            </span>
          ) : (
            'Tuma kwa Wote'
          )}
        </button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Historia ya Broadcast</h2>
          <div className="space-y-3">
            {history.map(b => (
              <div key={b.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-xs font-semibold text-gray-700 truncate flex-1">
                    {b.target.replace('_', ' ')} · {b.tone}
                  </p>
                  <StatusPill status={b.status} />
                </div>
                <p className="text-xs text-gray-600 line-clamp-2 mb-2">{b.message}</p>
                <div className="flex gap-3 text-[10px] text-gray-500">
                  <span>Wapokeaji: {b.recipients_count}</span>
                  <span className="text-green-600">Imetumwa: {b.sent_count}</span>
                  {b.failed_count > 0 && <span className="text-red-500">Imeshindwa: {b.failed_count}</span>}
                </div>
                <p className="text-[9px] text-gray-400 mt-1">
                  {new Date(b.created_at).toLocaleString('sw-TZ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
