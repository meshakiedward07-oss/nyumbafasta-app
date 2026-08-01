'use client'
import { useState, useEffect, useCallback } from 'react'

type Severity = 'low' | 'medium' | 'high' | 'critical'
type SignalType =
  | 'duplicate_phone'
  | 'duplicate_device'
  | 'duplicate_ip'
  | 'rapid_accounts'
  | 'rapid_unlocks'
  | 'suspicious_payment'

interface FraudSignal {
  id:              string
  signal_type:     SignalType
  severity:        Severity
  description:     string
  evidence:        Record<string, unknown>
  related_user_ids: string[]
  related_ip:      string | null
  is_resolved:     boolean
  resolved_at:     string | null
  resolution_note: string | null
  created_at:      string
  user:            { id: string; full_name: string; phone: string | null; account_status: string; fraud_score: number } | null
}

const SEV_COLOR: Record<Severity, string> = {
  low:      'bg-blue-100 text-blue-800',
  medium:   'bg-amber-100 text-amber-800',
  high:     'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}
const SEV_LABEL: Record<Severity, string> = {
  low: 'Chini', medium: 'Wastani', high: 'Juu', critical: 'Hatari',
}
const TYPE_LABEL: Record<SignalType, string> = {
  duplicate_phone:     'Simu Mara Mbili',
  duplicate_device:    'Kifaa Mara Mbili',
  duplicate_ip:        'IP Mara Mbili',
  rapid_accounts:      'Akaunti Haraka',
  rapid_unlocks:       'Unlock Haraka',
  suspicious_payment:  'Malipo ya Wasiwasi',
}

export default function AdminFraudPage() {
  const [signals,    setSignals]    = useState<FraudSignal[]>([])
  const [total,      setTotal]      = useState(0)
  const [page,       setPage]       = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [filterResolved, setFilterResolved] = useState<'false' | 'true' | ''>('false')
  const [filterSev,  setFilterSev]  = useState('')
  const [filterType, setFilterType] = useState('')
  const [resolving,  setResolving]  = useState<string | null>(null)
  const [note,       setNote]       = useState('')
  const [noteTarget, setNoteTarget] = useState<string | null>(null)
  const [actionUser, setActionUser] = useState<{ id: string; name: string } | null>(null)
  const [actioning,  setActioning]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (filterResolved) params.set('resolved', filterResolved)
    if (filterSev)      params.set('severity', filterSev)
    if (filterType)     params.set('type', filterType)

    const res  = await fetch(`/api/v1/admin/fraud?${params}`)
    const json = await res.json()
    setSignals(json.signals ?? [])
    setTotal(json.total   ?? 0)
    setLoading(false)
  }, [page, filterResolved, filterSev, filterType])

  useEffect(() => { load() }, [load])

  async function resolveSignal(id: string) {
    if (!note.trim()) { alert('Andika maelezo ya uamuzi wako.'); return }
    setResolving(id)
    await fetch('/api/v1/admin/fraud', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signal_id: id, action: 'resolve', resolution_note: note }),
    })
    setResolving(null)
    setNoteTarget(null)
    setNote('')
    load()
  }

  async function updateAccountStatus(userId: string, status: string) {
    setActioning(true)
    await fetch('/api/v1/admin/fraud', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: userId, account_status: status }),
    })
    setActioning(false)
    setActionUser(null)
    load()
  }

  const pageSize = 25
  const pages    = Math.ceil(total / pageSize)

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Udhibiti wa Ulaghai</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} ishara zimepatikana</p>
        </div>
        <button
          onClick={load}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
        >
          Onyesha Upya
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={filterResolved}
          onChange={e => { setFilterResolved(e.target.value as '' | 'true' | 'false'); setPage(0) }}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="false">Hazijasuluhuiwa</option>
          <option value="true">Zimesuluhuiwa</option>
          <option value="">Zote</option>
        </select>
        <select
          value={filterSev}
          onChange={e => { setFilterSev(e.target.value); setPage(0) }}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="">Uzito Wote</option>
          <option value="critical">Hatari</option>
          <option value="high">Juu</option>
          <option value="medium">Wastani</option>
          <option value="low">Chini</option>
        </select>
        <select
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setPage(0) }}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="">Aina Zote</option>
          <option value="duplicate_phone">Simu Mara Mbili</option>
          <option value="duplicate_device">Kifaa Mara Mbili</option>
          <option value="duplicate_ip">IP Mara Mbili</option>
          <option value="rapid_unlocks">Unlock Haraka</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Inapakia...</div>
      ) : signals.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Hakuna ishara za ulaghai.</div>
      ) : (
        <div className="space-y-3">
          {signals.map(s => (
            <div key={s.id} className={`bg-white rounded-xl border p-4 ${s.is_resolved ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-start gap-2 mb-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SEV_COLOR[s.severity]}`}>
                  {SEV_LABEL[s.severity]}
                </span>
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                  {TYPE_LABEL[s.signal_type]}
                </span>
                {s.is_resolved && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Imesuluhuiwa</span>
                )}
                <span className="text-xs text-gray-400 ml-auto">
                  {new Date(s.created_at).toLocaleString('sw-TZ')}
                </span>
              </div>

              <p className="text-sm text-gray-700 mb-2">{s.description}</p>

              {/* User info */}
              {s.user && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-2">
                  <span className="font-medium text-gray-800">{s.user.full_name}</span>
                  {s.user.phone && <span>{s.user.phone}</span>}
                  <span className={`px-1.5 py-0.5 rounded ${
                    s.user.account_status === 'banned'    ? 'bg-red-100 text-red-700' :
                    s.user.account_status === 'suspended' ? 'bg-orange-100 text-orange-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {s.user.account_status}
                  </span>
                  {s.user.fraud_score > 0 && (
                    <span className="text-amber-600 font-semibold">Alama: {s.user.fraud_score}/100</span>
                  )}
                </div>
              )}

              {/* Evidence */}
              {s.evidence && Object.keys(s.evidence).length > 0 && (
                <div className="bg-gray-50 rounded-lg p-2 mb-2">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Ushahidi</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                    {Object.entries(s.evidence).map(([k, v]) => (
                      <span key={k} className="text-xs text-gray-600">
                        <span className="text-gray-400">{k}:</span> {String(v)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {s.related_ip && (
                <p className="text-xs text-gray-500 mb-2">IP: <span className="font-mono">{s.related_ip}</span></p>
              )}

              {s.related_user_ids?.length > 0 && (
                <p className="text-xs text-gray-500 mb-2">
                  Akaunti zinazohusiana: {s.related_user_ids.length}
                </p>
              )}

              {s.is_resolved && s.resolution_note && (
                <p className="text-xs text-gray-500 italic mt-1">Uamuzi: {s.resolution_note}</p>
              )}

              {/* Actions */}
              {!s.is_resolved && (
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  {noteTarget === s.id ? (
                    <>
                      <input
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="Maelezo ya uamuzi..."
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 flex-1 min-w-[180px]"
                      />
                      <button
                        onClick={() => resolveSignal(s.id)}
                        disabled={resolving === s.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {resolving === s.id ? 'Inashughulikia...' : 'Thibitisha Uamuzi'}
                      </button>
                      <button
                        onClick={() => { setNoteTarget(null); setNote('') }}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                      >
                        Ghairi
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setNoteTarget(s.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700"
                      >
                        Suluhisha
                      </button>
                      {s.user && s.user.account_status === 'active' && (
                        <button
                          onClick={() => setActionUser({ id: s.user!.id, name: s.user!.full_name })}
                          className="text-xs px-3 py-1.5 rounded-lg border border-orange-300 text-orange-700 hover:bg-orange-50"
                        >
                          Simamisha Akaunti
                        </button>
                      )}
                      {s.user && s.user.account_status !== 'banned' && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Piga marufuku ${s.user!.full_name}? Hatua hii ni ngumu kubadilisha.`)) {
                              updateAccountStatus(s.user!.id, 'banned')
                            }
                          }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50"
                        >
                          Piga Marufuku
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40"
          >
            ← Iliyotangulia
          </button>
          <span className="text-sm text-gray-500">{page + 1} / {pages}</span>
          <button
            onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
            disabled={page >= pages - 1}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40"
          >
            Inayofuata →
          </button>
        </div>
      )}

      {/* Suspend modal */}
      {actionUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-bold text-gray-900 mb-2">Simamisha Akaunti</h3>
            <p className="text-sm text-gray-600 mb-4">
              Je, unataka kusimamisha akaunti ya <strong>{actionUser.name}</strong>?
              Hatua hii inaweza kubadilishwa baadaye.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => updateAccountStatus(actionUser.id, 'suspended')}
                disabled={actioning}
                className="flex-1 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50"
              >
                {actioning ? 'Inashughulikia...' : 'Simamisha'}
              </button>
              <button
                onClick={() => setActionUser(null)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-sm hover:bg-gray-50"
              >
                Ghairi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
