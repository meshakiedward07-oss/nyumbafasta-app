'use client'
import { useState } from 'react'

interface ViolationUser {
  id?: string
  full_name: string
  role: string
  account_status?: string
}

interface Violation {
  id: string
  violation_type: string
  description: string
  status: string
  action_taken: string | null
  admin_notes: string | null
  created_at: string
  resolved_at: string | null
  evidence_urls: string[]
  // Supabase returns arrays for joined rows
  reporter: ViolationUser[] | ViolationUser | null
  reported: (ViolationUser & { id?: string })[] | (ViolationUser & { id?: string }) | null
}

function firstUser<T>(val: T[] | T | null): T | null {
  if (!val) return null
  return Array.isArray(val) ? (val[0] ?? null) : val
}

interface Stats {
  totalAgreements: number
  pendingViolations: number
  suspendedUsers: number
  bannedUsers: number
}

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-700',
  reviewing:  'bg-blue-100 text-blue-700',
  resolved:   'bg-green-100 text-green-700',
  dismissed:  'bg-gray-100 text-gray-500',
}

const VIOLATION_LABELS: Record<string, string> = {
  fake_listing:       'Orodha ya Ulaghai',
  fraud:              'Ulaghai',
  harassment:         'Unyanyasaji',
  spam:               'Spam',
  price_manipulation: 'Udanganyifu wa Bei',
  fake_identity:      'Utambulisho wa Uongo',
  other:              'Nyingine',
}

type Tab = 'violations' | 'agreements' | 'actions'

export default function LegalClient({ violations, stats }: { violations: Violation[]; stats: Stats }) {
  const [tab, setTab]       = useState<Tab>('violations')
  const [selected, setSelected] = useState<Violation | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [actionForm, setActionForm] = useState({
    status:      '',
    action_taken:'',
    admin_notes: '',
  })
  const [feedback, setFeedback] = useState('')

  const filtered = statusFilter === 'all'
    ? violations
    : violations.filter(v => v.status === statusFilter)

  async function updateViolation() {
    if (!selected || !actionForm.status) return
    setLoading(true)
    setFeedback('')
    try {
      const res = await fetch(`/api/v1/legal/admin/violation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          violation_id:  selected.id,
          status:        actionForm.status,
          action_taken:  actionForm.action_taken,
          admin_notes:   actionForm.admin_notes,
          reported_user_id: firstUser(selected.reported)?.id,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setFeedback('Imefanikiwa')
      setTimeout(() => window.location.reload(), 1500)
    } catch (err: unknown) {
      setFeedback(err instanceof Error ? err.message : 'Imeshindwa')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Usimamizi wa Kisheria</h1>
        <p className="text-sm text-gray-500">Makubaliano, malalamiko, na hatua za utekelezaji</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Makubaliano Yote', value: stats.totalAgreements, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Malalamiko Yanayosubiri', value: stats.pendingViolations, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Akaunti Zilizosimamishwa', value: stats.suspendedUsers, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Akaunti Zilizofutwa', value: stats.bannedUsers, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-600 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(['violations', 'agreements', 'actions'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
              tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
            }`}
          >
            {t === 'violations' ? 'Malalamiko' : t === 'agreements' ? 'Makubaliano' : 'Hatua'}
          </button>
        ))}
      </div>

      {/* Violations tab */}
      {tab === 'violations' && (
        <div className="space-y-3">
          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            {['all', 'pending', 'reviewing', 'resolved', 'dismissed'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === s ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {s === 'all' ? 'Zote' : s === 'pending' ? 'Zinasubiri' : s === 'reviewing' ? 'Zinachunguzwa' : s === 'resolved' ? 'Zilizoshughulikiwa' : 'Zilizofutwa'}
                {s === 'pending' && stats.pendingViolations > 0 && (
                  <span className="ml-1.5 bg-red-500 text-white text-[9px] rounded-full px-1.5 py-0.5">
                    {stats.pendingViolations}
                  </span>
                )}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2 flex justify-center"><i className="ti ti-circle-check text-primary-500" aria-hidden="true" /></p>
              <p className="text-sm">Hakuna malalamiko ya {statusFilter === 'all' ? '' : statusFilter}</p>
            </div>
          ) : (
            filtered.map(v => (
              <div
                key={v.id}
                className="bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:border-primary-200 transition-colors"
                onClick={() => {
                  setSelected(v)
                  setActionForm({ status: v.status, action_taken: v.action_taken ?? '', admin_notes: v.admin_notes ?? '' })
                  setTab('actions')
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[v.status]}`}>
                        {v.status === 'pending' ? 'Inasubiri' : v.status === 'reviewing' ? 'Inachunguzwa' : v.status === 'resolved' ? 'Imeshughulikiwa' : 'Imefutwa'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {VIOLATION_LABELS[v.violation_type] ?? v.violation_type}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 line-clamp-2">{v.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                      <span>Aliyeripotiwa: <strong>{firstUser(v.reported)?.full_name ?? 'N/A'}</strong> ({firstUser(v.reported)?.role})</span>
                      <span>·</span>
                      <span>{new Date(v.created_at).toLocaleDateString('sw-TZ')}</span>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Agreements tab */}
      {tab === 'agreements' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
          <p className="text-4xl mb-3 flex justify-center"><i className="ti ti-clipboard-list text-gray-400" aria-hidden="true" /></p>
          <p className="font-semibold text-gray-800 mb-1">Makubaliano yaliyosainiwa: {stats.totalAgreements}</p>
          <p className="text-sm text-gray-500">
            Taarifa za kina za makubaliano zinapatikana kwenye database ya Supabase kwenye jedwali la <code className="bg-gray-100 px-1 rounded">user_agreements</code>.
          </p>
        </div>
      )}

      {/* Actions tab */}
      {tab === 'actions' && (
        <div className="space-y-4">
          {!selected ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2 flex justify-center"><i className="ti ti-hand-finger text-gray-400" aria-hidden="true" /></p>
              <p className="text-sm">Chagua malalamiko kutoka kwenye orodha ya Malalamiko</p>
              <button
                onClick={() => setTab('violations')}
                className="mt-3 text-primary-500 text-sm underline"
              >
                Nenda kwenye Malalamiko →
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected violation summary */}
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-red-700 mb-1">
                  {VIOLATION_LABELS[selected.violation_type] ?? selected.violation_type}
                </p>
                <p className="text-xs text-red-600 mb-2">{selected.description}</p>
                <div className="flex gap-4 text-[10px] text-red-500">
                  <span>Aliyeripotiwa: <strong>{firstUser(selected.reported)?.full_name}</strong></span>
                  <span>Aliyeripoti: <strong>{firstUser(selected.reporter)?.full_name ?? 'Haijulikani'}</strong></span>
                </div>
              </div>

              {/* Action form */}
              <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-800">Chukua Hatua</p>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">Hali ya Malalamiko</label>
                  <select
                    value={actionForm.status}
                    onChange={e => setActionForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="pending">Inasubiri</option>
                    <option value="reviewing">Inachunguzwa</option>
                    <option value="resolved">Imeshughulikiwa</option>
                    <option value="dismissed">Imefutwa (Bila Sababu)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">Hatua Iliyochukuliwa</label>
                  <select
                    value={actionForm.action_taken}
                    onChange={e => setActionForm(f => ({ ...f, action_taken: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">-- Chagua Hatua --</option>
                    <option value="warning">Onyo la kwanza</option>
                    <option value="suspend">Simamisha Akaunti (suspend)</option>
                    <option value="ban">Futa Akaunti Kabisa (ban)</option>
                    <option value="no_action">Hakuna Hatua (malalamiko yaliyofutwa)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">Maelezo ya Admin (ya ndani)</label>
                  <textarea
                    value={actionForm.admin_notes}
                    onChange={e => setActionForm(f => ({ ...f, admin_notes: e.target.value }))}
                    rows={3}
                    placeholder="Maelezo ya hatua iliyochukuliwa..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                  />
                </div>

                {feedback && (
                  <p className={`text-xs text-center font-medium ${feedback === 'Imefanikiwa' ? 'text-green-600' : 'text-red-500'}`}>
                    {feedback}
                  </p>
                )}

                <button
                  onClick={updateViolation}
                  disabled={loading || !actionForm.status}
                  className="w-full bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold
                             disabled:opacity-50 hover:bg-primary-600 transition-colors"
                >
                  {loading ? 'Inatekeleza...' : 'Tekeleza Hatua'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
