'use client'
import { useEffect, useState, useCallback } from 'react'
import type { PlanFeatures } from '@/lib/types/property'

interface SubscriptionPlan {
  id:            string
  name:          string
  description:   string | null
  price_tzs:     number
  billing_cycle: 'monthly' | 'quarterly' | 'annual'
  is_active:     boolean
  is_public:     boolean
  is_default:    boolean
  features:      PlanFeatures
  created_at:    string
}

const DEFAULT_FEATURES: PlanFeatures = {
  max_properties:             2,
  max_units:                  5,
  max_members:                2,
  has_reports:                false,
  has_maintenance:            true,
  has_communication_hub:      true,
  has_vendor_directory:       false,
  has_staff_assisted_listing: false,
  has_priority_support:       false,
  trial_days:                 14,
}

const CYCLE_LABEL: Record<string, string> = {
  monthly:   'Kila Mwezi',
  quarterly: 'Kila Robo Mwaka',
  annual:    'Kila Mwaka',
}

const FEATURE_ROWS: [keyof PlanFeatures, string, 'bool' | 'num'][] = [
  ['max_properties',             'Mali (nyumba)',            'num'],
  ['max_units',                  'Vitengo',                  'num'],
  ['max_members',                'Wanachama',                'num'],
  ['trial_days',                 'Siku za Majaribio',        'num'],
  ['has_maintenance',            'Matengenezo',              'bool'],
  ['has_communication_hub',      'Mazungumzo',               'bool'],
  ['has_reports',                'Ripoti na Takwimu',        'bool'],
  ['has_vendor_directory',       'Saraka ya Wazabuni',       'bool'],
  ['has_staff_assisted_listing', 'Usaidizi wa Kutangaza',    'bool'],
  ['has_priority_support',       'Msaada wa Kipaumbele',     'bool'],
]

function fmt(n: number) { return `TZS ${n.toLocaleString()}` }

// ── Plan form modal ──────────────────────────────────────────────────────────

function PlanModal({ plan, onSave, onClose }: {
  plan:    SubscriptionPlan | null
  onSave:  (p: SubscriptionPlan) => void
  onClose: () => void
}) {
  const isNew = !plan
  const [name,   setName]   = useState(plan?.name          ?? '')
  const [desc,   setDesc]   = useState(plan?.description   ?? '')
  const [price,  setPrice]  = useState(plan?.price_tzs     ?? 0)
  const [cycle,  setCycle]  = useState<'monthly' | 'quarterly' | 'annual'>(plan?.billing_cycle ?? 'monthly')
  const [pub,    setPub]    = useState(plan?.is_public     ?? true)
  const [feat,   setFeat]   = useState<PlanFeatures>(plan?.features ?? DEFAULT_FEATURES)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  function setFeatBool(key: keyof PlanFeatures, val: boolean) {
    setFeat(f => ({ ...f, [key]: val }))
  }
  function setFeatNum(key: keyof PlanFeatures, val: number) {
    setFeat(f => ({ ...f, [key]: val }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Jina la mpango linahitajika.'); return }
    setSaving(true); setError(null)
    try {
      const body = { name: name.trim(), description: desc.trim() || null, price_tzs: price, billing_cycle: cycle, is_public: pub, features: feat }
      const url  = isNew ? '/api/v1/admin/subscription-plans' : `/api/v1/admin/subscription-plans/${plan!.id}`
      const res  = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Kuna tatizo'); return }
      onSave(data.plan)
    } catch { setError('Imeshindwa kuhifadhi. Jaribu tena.') }
    finally  { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{isNew ? 'Mpango Mpya' : `Hariri — ${plan!.name}`}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <i className="ti ti-x text-lg" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

          {/* Basic info */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Jina la Mpango *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required
                placeholder="mfano: Basic, Premium..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Maelezo (hiari)</label>
              <textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Maelezo mafupi ya mpango huu..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Bei (TZS)</label>
                <input type="number" min={0} value={price} onChange={e => setPrice(Number(e.target.value))} required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Mzunguko wa Bili</label>
                <select value={cycle} onChange={e => setCycle(e.target.value as typeof cycle)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
                  <option value="monthly">Kila Mwezi</option>
                  <option value="quarterly">Kila Robo Mwaka</option>
                  <option value="annual">Kila Mwaka</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={pub} onChange={e => setPub(e.target.checked)}
                className="w-4 h-4 rounded text-primary-500 border-gray-300 focus:ring-primary-300" />
              <span className="text-sm text-gray-700">Onyesha kwa umma (visible in signup)</span>
            </label>
          </div>

          {/* Feature limits */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Vipengele</h3>
            <div className="space-y-2">
              {FEATURE_ROWS.map(([key, label, type]) => (
                <div key={key} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <span className="text-sm text-gray-700">{label}</span>
                  {type === 'bool' ? (
                    <button type="button"
                      onClick={() => setFeatBool(key, !feat[key])}
                      className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 flex items-center px-0.5 ${
                        feat[key] ? 'bg-primary-500' : 'bg-gray-200'
                      }`}>
                      <span className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${feat[key] ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setFeatNum(key, Math.max(0, (feat[key] as number) - 1))}
                        className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center text-sm font-bold transition">−</button>
                      <input type="number" min={0} value={feat[key] as number}
                        onChange={e => setFeatNum(key, Number(e.target.value))}
                        className="w-14 text-center border border-gray-200 rounded-lg px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                      <button type="button" onClick={() => setFeatNum(key, (feat[key] as number) + 1)}
                        className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center text-sm font-bold transition">+</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </form>

        <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
          <button type="submit" onClick={handleSave} disabled={saving}
            className="flex-1 bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-50 transition">
            {saving ? 'Inahifadhi...' : isNew ? 'Unda Mpango' : 'Hifadhi Mabadiliko'}
          </button>
          <button onClick={onClose} className="px-5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
            Ghairi
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({ plan, onEdit, onDeactivate, onActivate, onSetDefault }: {
  plan:         SubscriptionPlan
  onEdit:       (p: SubscriptionPlan) => void
  onDeactivate: (p: SubscriptionPlan) => void
  onActivate:   (p: SubscriptionPlan) => void
  onSetDefault: (p: SubscriptionPlan) => void
}) {
  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
      !plan.is_active ? 'opacity-60 border-gray-100' : plan.is_default ? 'border-primary-300' : 'border-gray-100'
    }`}>
      {/* Header */}
      <div className="p-5 border-b border-gray-50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="font-bold text-gray-900 text-base">{plan.name}</h2>
              {plan.is_default && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 font-semibold">Default</span>
              )}
              {!plan.is_active && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Imesimamishwa</span>
              )}
              {!plan.is_public && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">Private</span>
              )}
            </div>
            {plan.description && (
              <p className="text-xs text-gray-500 leading-relaxed">{plan.description}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xl font-extrabold text-gray-900">{fmt(plan.price_tzs)}</p>
            <p className="text-xs text-gray-400">{CYCLE_LABEL[plan.billing_cycle] ?? plan.billing_cycle}</p>
          </div>
        </div>
      </div>

      {/* Feature grid */}
      <div className="px-5 py-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {FEATURE_ROWS.map(([key, label, type]) => {
          const val = plan.features?.[key]
          return (
            <div key={key} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
              <span className="text-xs text-gray-500">{label}</span>
              <span className="text-xs font-medium text-gray-800 flex items-center">
                {type === 'bool'
                  ? (val
                    ? <i className="ti ti-check text-green-500" aria-hidden="true" />
                    : <i className="ti ti-x text-gray-300" aria-hidden="true" />)
                  : (val === -1
                    ? <span className="text-primary-600 font-bold">∞</span>
                    : val)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className="px-5 py-3 border-t border-gray-50 flex flex-wrap gap-2">
        <button onClick={() => onEdit(plan)}
          className="text-xs px-3 py-1.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition flex items-center gap-1">
          <i className="ti ti-edit" aria-hidden="true" /> Hariri
        </button>
        {!plan.is_default && plan.is_active && (
          <button onClick={() => onSetDefault(plan)}
            className="text-xs px-3 py-1.5 border border-primary-200 rounded-xl text-primary-600 hover:bg-primary-50 transition flex items-center gap-1">
            <i className="ti ti-star" aria-hidden="true" /> Weka Default
          </button>
        )}
        {plan.is_active ? (
          <button onClick={() => onDeactivate(plan)}
            className="text-xs px-3 py-1.5 border border-red-100 rounded-xl text-red-500 hover:bg-red-50 transition flex items-center gap-1 ml-auto">
            <i className="ti ti-ban" aria-hidden="true" /> Simamisha
          </button>
        ) : (
          <button onClick={() => onActivate(plan)}
            className="text-xs px-3 py-1.5 border border-green-200 rounded-xl text-green-600 hover:bg-green-50 transition flex items-center gap-1 ml-auto">
            <i className="ti ti-player-play" aria-hidden="true" /> Washa Tena
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function SubscriptionPlansPage() {
  const [plans,   setPlans]   = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState<string | null>(null)
  const [modal,   setModal]   = useState<'new' | SubscriptionPlan | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const res  = await fetch('/api/v1/admin/subscription-plans')
      const data = await res.json()
      setPlans(data.plans ?? [])
    } catch { setErr('Imeshindwa kupakia mipango. Jaribu tena.') }
    finally   { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDeactivate(plan: SubscriptionPlan) {
    if (!confirm(`Simamisha mpango "${plan.name}"? Mashirika yanayoutumia yanaweza kuathirika.`)) return
    try {
      const res  = await fetch(`/api/v1/admin/subscription-plans/${plan.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Kuna tatizo'); return }
      await load()
    } catch { alert('Imeshindwa kusimamisha.') }
  }

  async function handleActivate(plan: SubscriptionPlan) {
    try {
      await fetch(`/api/v1/admin/subscription-plans/${plan.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      })
      await load()
    } catch { alert('Imeshindwa kuwasha.') }
  }

  async function handleSetDefault(plan: SubscriptionPlan) {
    try {
      await fetch(`/api/v1/admin/subscription-plans/${plan.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true }),
      })
      await load()
    } catch { alert('Imeshindwa kubadilisha.') }
  }

  function handleSaved(p: SubscriptionPlan) {
    setModal(null)
    load()
  }

  const activePlans   = plans.filter(p => p.is_active)
  const inactivePlans = plans.filter(p => !p.is_active)

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      {/* Modal */}
      {modal && (
        <PlanModal
          plan={modal === 'new' ? null : modal}
          onSave={handleSaved}
          onClose={() => setModal(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mipango ya Usajili</h1>
          <p className="text-sm text-gray-500 mt-0.5">Simamia mipango ya usajili wa mashirika</p>
        </div>
        <button onClick={() => setModal('new')}
          className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition shadow-sm">
          <i className="ti ti-plus" aria-hidden="true" /> Mpango Mpya
        </button>
      </div>

      {err && <p className="text-sm text-red-600 mb-4 bg-red-50 px-4 py-3 rounded-xl">{err}</p>}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-72 bg-gray-100 animate-pulse rounded-2xl" />)}
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <i className="ti ti-credit-card text-5xl text-gray-200" aria-hidden="true" />
          <p className="text-gray-500 font-medium mt-3">Hakuna mipango bado</p>
          <p className="text-sm text-gray-400 mt-1">Unda mpango wa kwanza ili mashirika yaweze kujisajili.</p>
          <button onClick={() => setModal('new')}
            className="mt-5 bg-primary-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
            <i className="ti ti-plus mr-1" aria-hidden="true" /> Unda Mpango wa Kwanza
          </button>
        </div>
      ) : (
        <>
          {activePlans.length > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Mipango Hai ({activePlans.length})</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {activePlans.map(plan => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onEdit={setModal}
                    onDeactivate={handleDeactivate}
                    onActivate={handleActivate}
                    onSetDefault={handleSetDefault}
                  />
                ))}
              </div>
            </>
          )}

          {inactivePlans.length > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Iliyosimamishwa ({inactivePlans.length})</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {inactivePlans.map(plan => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onEdit={setModal}
                    onDeactivate={handleDeactivate}
                    onActivate={handleActivate}
                    onSetDefault={handleSetDefault}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
