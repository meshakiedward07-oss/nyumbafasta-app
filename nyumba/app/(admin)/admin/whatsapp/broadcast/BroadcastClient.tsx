'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

type Stage   = 'compose' | 'generating' | 'review' | 'sending' | 'done'
type Target  = 'all_dalali' | 'active_dalali' | 'new_dalali'
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

interface SendResult {
  sent_count: number
  failed_count: number
  recipients_count: number
}

const TARGET_OPTIONS: { value: Target; label: string; desc: string }[] = [
  { value: 'all_dalali',    label: 'Madalali Wote',             desc: 'Madalali wote waliojisajili' },
  { value: 'active_dalali', label: 'Subscription Active',       desc: 'Madalali wenye subscription inayoendelea' },
  { value: 'new_dalali',    label: 'Madalali Wapya (wiki hii)', desc: 'Waliojisajili wiki hii' },
]

const TONE_OPTIONS: { value: Tone; label: string; prefix: string }[] = [
  { value: 'personal', label: 'Personal', prefix: 'Habari {jina}! 😊' },
  { value: 'formal',   label: 'Rasmi',    prefix: 'Kwa heshima, {jina},' },
  { value: 'urgent',   label: 'Dharura',  prefix: 'MUHIMU — {jina},' },
]

function StatusPill({ status }: { status: BStatus }) {
  const map: Record<BStatus, { label: string; cls: string }> = {
    pending:   { label: 'Inasubiri',   cls: 'bg-gray-100 text-gray-600'    },
    sending:   { label: 'Inatuma…',    cls: 'bg-amber-100 text-amber-700'  },
    completed: { label: 'Imekamilika', cls: 'bg-green-100 text-green-700'  },
    failed:    { label: 'Imeshindwa',  cls: 'bg-red-100 text-red-700'      },
  }
  const c = map[status]
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.cls}`}>{c.label}</span>
}

export default function BroadcastClient() {
  const [stage,       setStage]       = useState<Stage>('compose')
  const [target,      setTarget]      = useState<Target>('all_dalali')
  const [tone,        setTone]        = useState<Tone>('personal')
  const [instruction, setInstruction] = useState('')
  const [draft,       setDraft]       = useState('')
  const [sendResult,  setSendResult]  = useState<SendResult | null>(null)
  const [sendError,   setSendError]   = useState('')
  const [genError,    setGenError]    = useState('')
  const [counts,      setCounts]      = useState<Record<Target, number | null>>({
    all_dalali: null, active_dalali: null, new_dalali: null,
  })
  const [history, setHistory] = useState<BroadcastRecord[]>([])

  useEffect(() => { fetchHistory() }, [])
  useEffect(() => { fetchCounts() }, [])

  async function fetchHistory() {
    const res = await fetch('/api/v1/whatsapp/broadcast')
    if (!res.ok) return
    const data = await res.json()
    setHistory(data.broadcasts ?? [])
  }

  async function fetchCounts() {
    const targets: Target[] = ['all_dalali', 'active_dalali', 'new_dalali']
    const results = await Promise.all(
      targets.map(async (t) => {
        const res = await fetch(`/api/v1/whatsapp/broadcast/count?target=${t}`)
        if (!res.ok) return [t, null] as const
        const json = await res.json() as { count: number }
        return [t, json.count] as const
      })
    )
    const updated: Record<Target, number | null> = { all_dalali: null, active_dalali: null, new_dalali: null }
    for (const [t, count] of results) updated[t] = count
    setCounts(updated)
  }

  const tonePrefix = TONE_OPTIONS.find(t => t.value === tone)?.prefix ?? ''
  const previewFull = `${tonePrefix.replace('{jina}', 'John')}\n\n${draft}`
  const targetLabel = TARGET_OPTIONS.find(t => t.value === target)?.label ?? target
  const targetCount = counts[target]

  async function handleGenerate(prevDraft?: string) {
    if (!instruction.trim()) return
    setGenError('')
    setStage('generating')

    const res = await fetch('/api/v1/whatsapp/broadcast/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction: instruction.trim(), target, tone, previousDraft: prevDraft }),
    })

    if (!res.ok) {
      const data = await res.json() as { error?: string }
      setGenError(data.error ?? 'Amina hakuweza kuandika ujumbe')
      setStage('compose')
      return
    }

    const data = await res.json() as { draft: string }
    setDraft(data.draft ?? '')
    setStage('review')
  }

  async function handleSend() {
    setSendError('')
    setStage('sending')

    const res = await fetch('/api/v1/whatsapp/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, message: draft.trim(), tone }),
    })

    const data = await res.json() as { sent_count?: number; failed_count?: number; recipients_count?: number; error?: string }

    if (res.ok) {
      setSendResult({
        sent_count: data.sent_count ?? 0,
        failed_count: data.failed_count ?? 0,
        recipients_count: data.recipients_count ?? 0,
      })
      setStage('done')
      fetchHistory()
    } else {
      setSendError(data.error ?? 'Imeshindwa kutuma ujumbe')
      setStage('review')
    }
  }

  function handleReset() {
    setStage('compose')
    setInstruction('')
    setDraft('')
    setSendResult(null)
    setSendError('')
    setGenError('')
    fetchHistory()
  }

  // ── GENERATING ────────────────────────────────────────────────────────────

  if (stage === 'generating') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-center min-h-[50vh] flex-col gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center">
            <i className="ti ti-sparkles text-3xl text-primary-500" aria-hidden="true" />
          </div>
          <p className="font-bold text-gray-900 text-base">Amina anaandika ujumbe...</p>
          <p className="text-sm text-gray-500 text-center max-w-xs">
            Subiri sekunde chache wakati Amina anaandaa ujumbe bora kwa madalali wako
          </p>
          <div className="flex gap-1.5 mt-2">
            {[0, 150, 300].map(delay => (
              <span
                key={delay}
                className="w-2.5 h-2.5 rounded-full bg-primary-400 animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── SENDING ───────────────────────────────────────────────────────────────

  if (stage === 'sending') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-center min-h-[50vh] flex-col gap-4">
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center">
            <i className="ti ti-send text-3xl text-green-500 animate-pulse" aria-hidden="true" />
          </div>
          <p className="font-bold text-gray-900 text-base">Inatuma ujumbe...</p>
          <p className="text-sm text-gray-500 text-center max-w-xs">
            Ujumbe unatumwa kwa{' '}
            {targetCount != null ? `${targetCount} watu` : targetLabel}.
            Hii inaweza kuchukua muda mfupi.
          </p>
        </div>
      </div>
    )
  }

  // ── DONE ──────────────────────────────────────────────────────────────────

  if (stage === 'done' && sendResult) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin/whatsapp" className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600">
            <i className="ti ti-arrow-left text-sm" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="font-bold text-gray-900 text-lg">Broadcast Imekamilika</h1>
            <p className="text-xs text-gray-500">Matokeo ya utumaji</p>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center mb-6">
          <i className="ti ti-circle-check text-4xl text-green-600 mb-3 block" aria-hidden="true" />
          <p className="font-bold text-green-800 text-lg mb-1">Imekamilika!</p>
          <p className="text-sm text-green-700">
            Imetumwa kwa <strong>{sendResult.sent_count}</strong> kati ya{' '}
            <strong>{sendResult.recipients_count}</strong> watu
          </p>
          {sendResult.failed_count > 0 && (
            <p className="text-xs text-red-600 mt-1">Imeshindwa: {sendResult.failed_count}</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {([
            { label: 'Wapokeaji',  value: sendResult.recipients_count, cls: 'text-gray-700'  },
            { label: 'Imetumwa',   value: sendResult.sent_count,        cls: 'text-green-600' },
            { label: 'Imeshindwa', value: sendResult.failed_count,      cls: 'text-red-500'   },
          ] as const).map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
              <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <button
          onClick={handleReset}
          className="w-full bg-primary-500 text-white py-4 rounded-2xl text-sm font-bold shadow-md flex items-center justify-center gap-2"
        >
          <i className="ti ti-plus" aria-hidden="true" />
          Broadcast Mpya
        </button>
      </div>
    )
  }

  // ── REVIEW ────────────────────────────────────────────────────────────────

  if (stage === 'review') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setStage('compose')}
            className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600"
          >
            <i className="ti ti-arrow-left text-sm" aria-hidden="true" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900 text-lg">Kagua Ujumbe wa Amina</h1>
            <p className="text-xs text-gray-500">Hariri au thibitisha kabla ya kutuma</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Editable draft */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <i className="ti ti-sparkles text-primary-500" aria-hidden="true" />
              <p className="text-sm font-bold text-gray-900">Ujumbe wa Amina</p>
              <span className="text-[10px] text-gray-400 ml-auto">Unaweza kuhariri</span>
            </div>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={5}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 resize-none outline-none focus:border-primary-500"
            />
            <p className="text-[10px] text-gray-400 text-right mt-1">{draft.length} herufi</p>
          </div>

          {/* Full message preview */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-sm font-bold text-gray-900 mb-3">
              <i className="ti ti-eye text-gray-400 mr-1" aria-hidden="true" />
              Mfano wa Ujumbe Kamili
              <span className="text-[10px] font-normal text-gray-400 ml-1">(kama John ataona)</span>
            </p>
            <div className="bg-primary-50 rounded-xl p-4 border-l-4 border-primary-300">
              <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{previewFull}</p>
            </div>
          </div>

          {/* Target summary */}
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 shadow-sm flex items-center gap-3">
            <i className="ti ti-users text-primary-500 text-lg" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold text-gray-800">{targetLabel}</p>
              <p className="text-[10px] text-gray-500">
                {targetCount != null
                  ? `${targetCount} watu watapokea ujumbe huu`
                  : 'Inakokotoa wapokeaji...'}
              </p>
            </div>
          </div>

          {/* Send error */}
          {sendError && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <i className="ti ti-alert-circle text-xl text-red-500" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-red-800">Broadcast Imeshindwa</p>
                <p className="text-xs text-red-700 mt-1">{sendError}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => handleGenerate(draft)}
              className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 text-sm font-semibold text-gray-700 flex items-center justify-center gap-2"
            >
              <i className="ti ti-refresh" aria-hidden="true" />
              Omba Tofauti
            </button>
            <button
              onClick={handleSend}
              disabled={!draft.trim()}
              className="flex-[2] bg-primary-500 text-white py-3.5 rounded-2xl text-sm font-bold shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <i className="ti ti-send" aria-hidden="true" />
              Tuma kwa {targetCount != null ? `${targetCount}` : ''} Watu
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── COMPOSE (default) ─────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/whatsapp" className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600">
          <i className="ti ti-arrow-left text-sm" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="font-bold text-gray-900 text-lg">Tuma Ujumbe wa Wingi</h1>
          <p className="text-xs text-gray-500">Amina ataandika broadcast kwa madalali</p>
        </div>
      </div>

      <div className="space-y-4">

        {/* Target */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm font-bold text-gray-900 mb-3">Wapokeaji</p>
          <div className="space-y-2">
            {TARGET_OPTIONS.map(opt => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  target === opt.value ? 'border-primary-500 bg-primary-50' : 'border-gray-100 bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="target"
                  value={opt.value}
                  checked={target === opt.value}
                  onChange={() => setTarget(opt.value)}
                  className="mt-0.5 accent-primary-500"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                    {counts[opt.value] != null && (
                      <span className="text-[10px] font-bold text-primary-600 bg-primary-50 border border-primary-200 px-2 py-0.5 rounded-full shrink-0">
                        {counts[opt.value]} watu
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
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
                    ? 'border-primary-500 bg-primary-500 text-white'
                    : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                <div>{opt.label}</div>
                <div className="font-normal opacity-70 mt-0.5 truncate">
                  {opt.prefix.replace('{jina}', 'John')}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Instruction for Amina */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <i className="ti ti-sparkles text-primary-500" aria-hidden="true" />
            <p className="text-sm font-bold text-gray-900">Maelekezo kwa Amina</p>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Mwambie Amina unataka kusema nini — yeye ataandika ujumbe wa kitaalamu kwa Kiswahili
          </p>
          <textarea
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            rows={3}
            placeholder="k.m. Arifu madalali kuhusu kampuni mpya ya listing premium. Waambie wanaweza kuongeza listings na kupata wateja zaidi..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 resize-none outline-none focus:border-primary-500"
          />
          <p className="text-[10px] text-gray-400 text-right mt-1">{instruction.length} herufi</p>
        </div>

        {/* Gen error */}
        {genError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <i className="ti ti-alert-circle text-xl text-red-500" aria-hidden="true" />
            <p className="text-sm text-red-700">{genError}</p>
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={() => handleGenerate()}
          disabled={!instruction.trim()}
          className="w-full bg-primary-500 text-white py-4 rounded-2xl text-sm font-bold disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
        >
          <i className="ti ti-sparkles" aria-hidden="true" />
          Amina, Andika Ujumbe
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
                  {b.failed_count > 0 && (
                    <span className="text-red-500">Imeshindwa: {b.failed_count}</span>
                  )}
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
