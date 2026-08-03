'use client'
import { useState, useEffect, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Severity = 'info' | 'warning' | 'critical'
type EventStatus = 'open' | 'acknowledged' | 'resolved'

type SopRef = { slug: string; title: string } | null

type AlertEvent = {
  id:              string
  threshold_id:    string
  metric:          string
  display_name:    string
  current_value:   number
  threshold_value: number
  severity:        Severity
  sop_id:          string | null
  sop:             SopRef
  status:          EventStatus
  acknowledged_at: string | null
  resolved_at:     string | null
  notes:           string | null
  created_at:      string
}

type AlertThreshold = {
  id:              string
  metric:          string
  display_name:    string
  description:     string | null
  operator:        string
  threshold_value: number
  severity:        Severity
  sop_id:          string | null
  sop:             SopRef
  is_active:       boolean
  updated_at:      string
}

type Tab = 'alerts' | 'thresholds' | 'history'

// ── Severity styling ──────────────────────────────────────────────────────────

const SEV: Record<Severity, { border: string; bg: string; badge: string; icon: string; label: string }> = {
  critical: {
    border: 'border-red-300',
    bg:     'bg-red-50',
    badge:  'bg-red-100 text-red-700',
    icon:   '🔴',
    label:  'Muhimu',
  },
  warning: {
    border: 'border-amber-300',
    bg:     'bg-amber-50',
    badge:  'bg-amber-100 text-amber-700',
    icon:   '🟡',
    label:  'Tahadhari',
  },
  info: {
    border: 'border-blue-200',
    bg:     'bg-blue-50',
    badge:  'bg-blue-100 text-blue-700',
    icon:   '🔵',
    label:  'Taarifa',
  },
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const s = SEV[severity]
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.badge}`}>
      {s.icon} {s.label}
    </span>
  )
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return 'sekunde chache zilizopita'
  if (m < 60) return `dakika ${m} zilizopita`
  const h = Math.floor(m / 60)
  if (h < 24) return `saa ${h} zilizopita`
  return `siku ${Math.floor(h / 24)} zilizopita`
}

// ── Open / Acknowledged Events ────────────────────────────────────────────────

function AlertsTab({
  events,
  onAction,
  checking,
  onCheck,
  lastChecked,
}: {
  events:      AlertEvent[]
  onAction:    (id: string, action: 'acknowledge' | 'resolve', notes?: string) => Promise<void>
  checking:    boolean
  onCheck:     () => void
  lastChecked: string | null
}) {
  const [acting,       setActing]       = useState<string | null>(null)
  const [resolvingId,  setResolvingId]  = useState<string | null>(null)
  const [resolveNotes, setResolveNotes] = useState('')

  const critical     = events.filter(e => e.severity === 'critical')
  const warning      = events.filter(e => e.severity === 'warning')
  const info         = events.filter(e => e.severity === 'info')
  const acknowledged = events.filter(e => e.status === 'acknowledged')
  const open         = events.filter(e => e.status === 'open')

  async function act(id: string, action: 'acknowledge' | 'resolve') {
    setActing(id)
    await onAction(id, action)
    setActing(null)
  }

  async function confirmResolve(id: string) {
    setActing(id)
    await onAction(id, 'resolve', resolveNotes.trim() || undefined)
    setActing(null)
    setResolvingId(null)
    setResolveNotes('')
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-3">✅</div>
        <p className="font-semibold text-gray-800 text-lg">Hakuna tahadhari</p>
        <p className="text-sm text-gray-500 mt-1">Viashiria vyote viko ndani ya mipaka inayokubalika.</p>
        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            onClick={onCheck}
            disabled={checking}
            className="px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {checking ? 'Inakagua...' : 'Kagua Sasa'}
          </button>
          {lastChecked && (
            <p className="text-xs text-gray-400">Kaguo la mwisho: {timeAgo(lastChecked)}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex gap-3">
          {critical.length > 0 && (
            <span className="px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-700">
              🔴 {critical.length} Muhimu
            </span>
          )}
          {warning.length > 0 && (
            <span className="px-3 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-700">
              🟡 {warning.length} Tahadhari
            </span>
          )}
          {info.length > 0 && (
            <span className="px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-700">
              🔵 {info.length} Taarifa
            </span>
          )}
          {acknowledged.length > 0 && (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
              ⏸ {acknowledged.length} Yanakaguliwa
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lastChecked && (
            <span className="text-xs text-gray-400">Kaguo: {timeAgo(lastChecked)}</span>
          )}
          <button
            onClick={onCheck}
            disabled={checking}
            className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {checking ? '⟳ Inakagua...' : '⟳ Kagua Sasa'}
          </button>
        </div>
      </div>

      {/* Events grouped by severity */}
      {([critical, warning, info].filter(g => g.length > 0) as AlertEvent[][]).map((group) => (
        <div key={group[0].severity} className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <SeverityBadge severity={group[0].severity} />
            <span className="text-xs text-gray-400">{open.filter(e => e.severity === group[0].severity).length} wazi</span>
          </div>

          <div className="space-y-3">
            {group.map(evt => {
              const s = SEV[evt.severity]
              return (
                <div
                  key={evt.id}
                  className={`border rounded-xl p-4 ${s.border} ${evt.status === 'acknowledged' ? 'opacity-70' : s.bg}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm text-gray-900">{evt.display_name}</span>
                        {evt.status === 'acknowledged' && (
                          <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">Yanakaguliwa</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 font-mono">
                        Thamani ya sasa: <strong>{evt.current_value.toFixed(1)}</strong>
                        {' — '}mipaka: {evt.threshold_value}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{timeAgo(evt.created_at)}</p>
                      {evt.sop && (
                        <a
                          href={`/admin/knowledge?sop=${evt.sop.slug}`}
                          className="inline-flex items-center gap-1 text-xs text-purple-600 hover:underline mt-1"
                        >
                          📋 SOP: {evt.sop.title}
                        </a>
                      )}
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      {evt.status === 'open' && (
                        <button
                          onClick={() => act(evt.id, 'acknowledge')}
                          disabled={acting === evt.id}
                          className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                        >
                          ⏸ Kagua
                        </button>
                      )}
                      {resolvingId !== evt.id ? (
                        <button
                          onClick={() => { setResolvingId(evt.id); setResolveNotes('') }}
                          disabled={acting === evt.id}
                          className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          ✓ Tatua
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Inline resolve form */}
                  {resolvingId === evt.id && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Maelezo ya Utatuzi (optional)
                      </label>
                      <textarea
                        value={resolveNotes}
                        onChange={e => setResolveNotes(e.target.value)}
                        rows={2}
                        placeholder="Sababu ya tatizo na hatua zilizochukuliwa..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => confirmResolve(evt.id)}
                          disabled={acting === evt.id}
                          className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          {acting === evt.id ? 'Inatatua...' : '✓ Thibitisha Utatuzi'}
                        </button>
                        <button
                          onClick={() => { setResolvingId(null); setResolveNotes('') }}
                          className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                        >
                          Ghairi
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Threshold Configuration ───────────────────────────────────────────────────

const OPERATOR_LABELS: Record<string, string> = {
  gt: '>', lt: '<', gte: '≥', lte: '≤', eq: '=',
}

const KNOWN_METRICS = [
  { value: 'kyc_pending_count',        label: 'KYC zinazosubiri (idadi)' },
  { value: 'kyc_pending_hours',        label: 'KYC iliyosimama (masaa)' },
  { value: 'listings_pending_count',   label: 'Listings zinazosubiri (idadi)' },
  { value: 'listings_pending_hours',   label: 'Listing iliyosimama (masaa)' },
  { value: 'payment_failures_1h',      label: 'Malipo yaliyoshindwa (saa 1)' },
  { value: 'new_dalali_no_listing_48h',label: 'Madalali wapya bila listings (48h+)' },
]

function ThresholdsTab({
  thresholds,
  onRefresh,
}: {
  thresholds: AlertThreshold[]
  onRefresh:  () => void
}) {
  const [creating,  setCreating]  = useState(false)
  const [editing,   setEditing]   = useState<AlertThreshold | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const [metric,   setMetric]   = useState('')
  const [label,    setLabel]    = useState('')
  const [desc,     setDesc]     = useState('')
  const [operator, setOperator] = useState('gt')
  const [value,    setValue]    = useState('')
  const [severity, setSeverity] = useState<Severity>('warning')

  function startCreate() {
    setCreating(true)
    setEditing(null)
    setMetric(''); setLabel(''); setDesc(''); setOperator('gt'); setValue(''); setSeverity('warning')
    setError('')
  }

  function startEdit(t: AlertThreshold) {
    setEditing(t)
    setCreating(false)
    setMetric(t.metric)
    setLabel(t.display_name)
    setDesc(t.description ?? '')
    setOperator(t.operator)
    setValue(String(t.threshold_value))
    setSeverity(t.severity)
    setError('')
  }

  async function save() {
    if (!metric || !label || !value) { setError('Jaza sehemu zote zinazohitajika'); return }
    setSaving(true); setError('')
    const method  = editing ? 'PATCH' : 'POST'
    const url     = '/api/v1/admin/alerts/thresholds'
    const payload = editing
      ? { id: editing.id, display_name: label, description: desc, operator, threshold_value: Number(value), severity }
      : { metric, display_name: label, description: desc, operator, threshold_value: Number(value), severity }

    const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Hitilafu'); setSaving(false); return }
    setSaving(false); setCreating(false); setEditing(null); onRefresh()
  }

  async function toggleActive(t: AlertThreshold) {
    await fetch('/api/v1/admin/alerts/thresholds', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, is_active: !t.is_active }),
    })
    onRefresh()
  }

  async function deleteThreshold(id: string) {
    if (!confirm('Futa kizingiti hiki? Alert zake zote za zamani zitafutwa pia.')) return
    await fetch(`/api/v1/admin/alerts/thresholds?id=${id}`, { method: 'DELETE' })
    onRefresh()
  }

  const showForm = creating || !!editing

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-800">Vizingiti vya Tahadhari</h2>
          <p className="text-sm text-gray-500">{thresholds.length} vizingiti — {thresholds.filter(t => t.is_active).length} vinafanya kazi</p>
        </div>
        <button onClick={startCreate} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700">
          + Kizingiti Kipya
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-gray-800">{editing ? 'Hariri Kizingiti' : 'Kizingiti Kipya'}</h3>

          {!editing && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kiashiria *</label>
              <select value={metric} onChange={e => setMetric(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">— Chagua kiashiria —</option>
                {KNOWN_METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Jina la Kuonyesha *</label>
              <input value={label} onChange={e => setLabel(e.target.value)}
                placeholder="e.g. KYC Zisizokaguliwa"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Uzito</label>
              <select value={severity} onChange={e => setSeverity(e.target.value as Severity)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="info">🔵 Taarifa</option>
                <option value="warning">🟡 Tahadhari</option>
                <option value="critical">🔴 Muhimu</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Opereta</label>
              <select value={operator} onChange={e => setOperator(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                {Object.entries(OPERATOR_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v} ({k})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Thamani *</label>
              <input type="number" value={value} onChange={e => setValue(e.target.value)}
                placeholder="e.g. 5"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Maelezo (optional)</label>
            <input value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Eleza kwa nini kizingiti hiki ni muhimu..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          {error && <p className="text-red-600 text-xs">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={save} disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Inahifadhi...' : editing ? 'Hifadhi' : 'Unda'}
            </button>
            <button onClick={() => { setCreating(false); setEditing(null) }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
              Ghairi
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {thresholds.map(t => (
          <div key={t.id}
            className={`bg-white border rounded-xl p-4 flex items-center gap-4 ${!t.is_active ? 'opacity-50' : 'border-gray-200'}`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="font-medium text-sm text-gray-800">{t.display_name}</span>
                <SeverityBadge severity={t.severity} />
                {!t.is_active && <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-100 rounded">Imezimwa</span>}
              </div>
              <p className="text-xs text-gray-500 font-mono">
                {t.metric} {OPERATOR_LABELS[t.operator] ?? t.operator} {t.threshold_value}
              </p>
              {t.description && <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>}
              {t.sop && (
                <p className="text-xs text-purple-600 mt-0.5">📋 {t.sop.title}</p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => startEdit(t)}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200">
                Hariri
              </button>
              <button onClick={() => toggleActive(t)}
                className={`px-3 py-1.5 rounded-lg text-xs ${t.is_active ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                {t.is_active ? 'Zima' : 'Washa'}
              </button>
              <button onClick={() => deleteThreshold(t.id)}
                className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs hover:bg-red-100">
                Futa
              </button>
            </div>
          </div>
        ))}
        {thresholds.length === 0 && (
          <p className="text-center py-8 text-gray-500 text-sm">Hakuna vizingiti. Unda kizingiti cha kwanza.</p>
        )}
      </div>
    </div>
  )
}

// ── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab() {
  const [events,  setEvents]  = useState<AlertEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [status,  setStatus]  = useState<EventStatus>('resolved')

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/v1/admin/alerts/events?status=${status}&limit=50`)
    const data = await res.json()
    setEvents(data.events ?? [])
    setLoading(false)
  }, [status])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="font-semibold text-gray-800">Historia ya Tahadhari</h2>
        <div className="flex gap-2">
          {(['resolved', 'acknowledged'] as EventStatus[]).map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1 rounded-lg text-xs font-medium ${status === s ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s === 'resolved' ? '✓ Zilizotatuliwa' : '⏸ Zilizokaguliwa'}
            </button>
          ))}
        </div>
        <button onClick={load} className="ml-auto text-sm text-green-600 hover:underline">Onyesha upya</button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-gray-500 text-sm">Inapakia...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <th className="pb-2 pr-3">Tahadhari</th>
                <th className="pb-2 pr-3">Thamani</th>
                <th className="pb-2 pr-3">Uzito</th>
                <th className="pb-2 pr-3">Hali</th>
                <th className="pb-2">Tarehe</th>
              </tr>
            </thead>
            <tbody>
              {events.map(evt => (
                <tr key={evt.id} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                  <td className="py-2 pr-3">
                    <p className="text-xs font-medium text-gray-800">{evt.display_name}</p>
                    {evt.sop && <p className="text-xs text-purple-500">📋 {evt.sop.title}</p>}
                    {evt.notes && (
                      <p className="text-xs text-gray-500 mt-1 italic max-w-xs">
                        ↳ {evt.notes}
                      </p>
                    )}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs text-gray-600">
                    {evt.current_value.toFixed(1)} / {evt.threshold_value}
                  </td>
                  <td className="py-2 pr-3"><SeverityBadge severity={evt.severity} /></td>
                  <td className="py-2 pr-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      evt.status === 'resolved'     ? 'bg-green-100 text-green-700' :
                      evt.status === 'acknowledged' ? 'bg-gray-100 text-gray-600'  :
                      'bg-red-100 text-red-700'
                    }`}>
                      {evt.status === 'resolved' ? '✓ Imetatuliwa' : evt.status === 'acknowledged' ? '⏸ Inakaguliwa' : 'Wazi'}
                    </span>
                  </td>
                  <td className="py-2 text-xs text-gray-400 whitespace-nowrap">
                    {timeAgo(evt.created_at)}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-500 text-sm">Hakuna rekodi.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const [tab,         setTab]         = useState<Tab>('alerts')
  const [events,      setEvents]      = useState<AlertEvent[]>([])
  const [thresholds,  setThresholds]  = useState<AlertThreshold[]>([])
  const [loading,     setLoading]     = useState(true)
  const [checking,    setChecking]    = useState(false)
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const [checkMsg,    setCheckMsg]    = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch('/api/v1/admin/alerts')
    const data = await res.json()
    setEvents(data.events     ?? [])
    setThresholds(data.thresholds ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function runCheck() {
    setChecking(true); setCheckMsg('')
    const res  = await fetch('/api/v1/admin/alerts', { method: 'POST' })
    const data = await res.json()
    setLastChecked(data.ran_at ?? new Date().toISOString())
    setCheckMsg(
      data.fired > 0
        ? `Tahadhari ${data.fired} mpya zimewashwa.`
        : data.existing > 0
          ? `Tahadhari ${data.existing} bado ziko wazi.`
          : 'Hakuna tahadhari. Kila kitu kiko sawa.'
    )
    await load()
    setChecking(false)
    setTimeout(() => setCheckMsg(''), 6000)
  }

  async function handleAction(id: string, action: 'acknowledge' | 'resolve', notes?: string) {
    await fetch('/api/v1/admin/alerts/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, ...(notes ? { notes } : {}) }),
    })
    setEvents(prev => prev
      .map(e => e.id !== id ? e : ({
        ...e,
        status:      (action === 'resolve' ? 'resolved' : 'acknowledged') as EventStatus,
        resolved_at: action === 'resolve' ? new Date().toISOString() : null,
      }))
      .filter(e => e.status !== 'resolved')
    )
  }

  const openCount = events.filter(e => e.status === 'open').length
  const critCount = events.filter(e => e.severity === 'critical' && e.status === 'open').length

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'alerts',     label: '🚨 Tahadhari',   badge: openCount },
    { id: 'thresholds', label: '⚙️ Vizingiti',   badge: undefined },
    { id: 'history',    label: '📋 Historia',    badge: undefined },
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">🚨 Tahadhari za Mfumo</h1>
            <p className="text-sm text-gray-500 mt-1">
              Viashiria vya wakati halisi — kila tahadhari imeunganishwa na SOP inayohusika.
            </p>
          </div>
          {critCount > 0 && (
            <span className="flex-shrink-0 px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl animate-pulse">
              🔴 {critCount} Muhimu
            </span>
          )}
        </div>

        {/* Check result message */}
        {checkMsg && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium border ${
            checkMsg.includes('mpya') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'
          }`}>
            {checkMsg}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold text-white ${
                  tab === 'alerts' && critCount > 0 ? 'bg-red-500' : 'bg-amber-500'
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-8 h-8 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {tab === 'alerts' && (
                <AlertsTab
                  events={events}
                  onAction={handleAction}
                  checking={checking}
                  onCheck={runCheck}
                  lastChecked={lastChecked}
                />
              )}
              {tab === 'thresholds' && (
                <ThresholdsTab thresholds={thresholds} onRefresh={load} />
              )}
              {tab === 'history' && <HistoryTab />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
