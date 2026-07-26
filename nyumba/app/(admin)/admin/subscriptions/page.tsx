'use client'
import { useEffect, useState, useCallback } from 'react'
import type { SubscriptionPlan, SubscriptionStatus, PlanFeatures, SubscriptionInvoice, InvoiceStatus } from '@/lib/types/property'

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrgSubscription {
  id:                     string
  org_id:                 string
  plan_id:                string | null
  status:                 SubscriptionStatus
  trial_ends_at:          string | null
  current_period_end:     string | null
  pending_plan_id:        string | null
  pending_plan_starts_at: string | null
  cancelled_at:           string | null
  created_at:             string
  org:  { id: string; name: string; org_type: string } | null
  plan: { id: string; name: string; price_tzs: number } | null
}

interface Summary {
  total: number; trial: number; active: number; past_due: number
  grace_period: number; cancelled: number; expired: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) { return `Tsh ${n.toLocaleString()}` }

function statusBadge(s: SubscriptionStatus) {
  const map: Record<SubscriptionStatus, string> = {
    trial:        'bg-blue-100 text-blue-700',
    active:       'bg-green-100 text-green-700',
    past_due:     'bg-amber-100 text-amber-700',
    grace_period: 'bg-orange-100 text-orange-700',
    cancelled:    'bg-gray-100 text-gray-500',
    expired:      'bg-red-100 text-red-500',
  }
  const label: Record<SubscriptionStatus, string> = {
    trial: 'Majaribio', active: 'Hai', past_due: 'Malipo Yamechelewa',
    grace_period: 'Neema', cancelled: 'Imesimamishwa', expired: 'Imekwisha',
  }
  return <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${map[s]}`}>{label[s]}</span>
}

function dateFmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Feature row helper ─────────────────────────────────────────────────────────

const FEATURE_LABELS: [keyof PlanFeatures, string][] = [
  ['max_properties',             'Mali (nyumba)'],
  ['max_units',                  'Vitengo'],
  ['max_members',                'Wanachama'],
  ['has_reports',                'Ripoti na Takwimu'],
  ['has_maintenance',            'Matengenezo'],
  ['has_communication_hub',      'Mazungumzo'],
  ['has_vendor_directory',       'Saraka ya Wazabuni'],
  ['has_staff_assisted_listing', 'Usaidizi wa Kutangaza'],
  ['has_priority_support',       'Msaada wa Kipaumbele'],
  ['trial_days',                 'Siku za Majaribio'],
]

function featureVal(key: keyof PlanFeatures, val: number | boolean) {
  if (typeof val === 'boolean') return val ? <i className="ti ti-check text-green-500" /> : <i className="ti ti-x text-gray-300" />
  if (val === -1) return <span className="text-primary-600 font-semibold">∞</span>
  return <span className="font-mono text-sm">{val}</span>
}

// ── Plan Form Modal ────────────────────────────────────────────────────────────

function PlanModal({ plan, onSave, onClose }: {
  plan: SubscriptionPlan | null     // null = create new
  onSave: (p: SubscriptionPlan) => void
  onClose: () => void
}) {
  const isNew = !plan

  const [name,    setName]    = useState(plan?.name          ?? '')
  const [desc,    setDesc]    = useState(plan?.description   ?? '')
  const [price,   setPrice]   = useState(plan?.price_tzs     ?? 0)
  const [cycle,   setCycle]   = useState(plan?.billing_cycle ?? 'monthly')
  const [pub,     setPub]     = useState(plan?.is_public     ?? true)
  const [feat,    setFeat]    = useState<PlanFeatures>(plan?.features ?? {
    max_properties: 2, max_units: 5, max_members: 2,
    has_reports: false, has_maintenance: true, has_communication_hub: true,
    has_vendor_directory: false, has_staff_assisted_listing: false, has_priority_support: false,
    trial_days: 14,
  })
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  function setF<K extends keyof PlanFeatures>(k: K, v: PlanFeatures[K]) {
    setFeat(f => ({ ...f, [k]: v }))
  }

  async function submit() {
    if (!name.trim()) { setError('Jina linahitajika'); return }
    setSaving(true); setError(null)
    const url    = isNew ? '/api/v1/admin/subscription-plans' : `/api/v1/admin/subscription-plans/${plan!.id}`
    const method = isNew ? 'POST' : 'PATCH'
    const res    = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description: desc.trim() || null, price_tzs: price, billing_cycle: cycle, is_public: pub, features: feat }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Kuna tatizo'); setSaving(false); return }
    onSave(data.plan)
  }

  const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-xl my-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">{isNew ? 'Mpango Mpya' : `Badilisha: ${plan!.name}`}</h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Jina *</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inp} placeholder="Msingi / Kamili / Pro" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Maelezo</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} className={inp} placeholder="Kwa nani mpango huu unafaa" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Bei (Tsh)</label>
              <input type="number" min={0} value={price} onChange={e => setPrice(Number(e.target.value))} className={inp} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Mzunguko</label>
              <select value={cycle} onChange={e => setCycle(e.target.value as 'monthly' | 'quarterly' | 'annual')} className={`${inp} bg-white`}>
                <option value="monthly">Kila Mwezi</option>
                <option value="quarterly">Kila Robo Mwaka</option>
                <option value="annual">Kila Mwaka</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={pub} onChange={e => setPub(e.target.checked)} className="w-4 h-4 accent-primary-500" />
              <span className="text-sm text-gray-700">Unaoonekana kwa umma (kwenye portal)</span>
            </label>
          </div>

          {/* Feature matrix */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Vipengele</p>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {FEATURE_LABELS.map(([key, label]) => {
                    const val = feat[key]
                    const isNum  = ['max_properties', 'max_units', 'max_members', 'trial_days'].includes(key)
                    const isBool = !isNum
                    return (
                      <tr key={key} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-600">{label}</td>
                        <td className="px-3 py-2 text-right">
                          {isBool ? (
                            <button
                              type="button"
                              onClick={() => setF(key as keyof PlanFeatures, !val as PlanFeatures[keyof PlanFeatures])}
                              className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${val ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
                            >
                              {val ? 'Ndiyo' : 'Hapana'}
                            </button>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                min={-1}
                                value={val as number}
                                onChange={e => setF(key as keyof PlanFeatures, Number(e.target.value) as PlanFeatures[keyof PlanFeatures])}
                                className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary-300"
                              />
                              {key !== 'trial_days' && <span className="text-xs text-gray-400">(-1=∞)</span>}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={submit} disabled={saving} className="flex-1 bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-40">
              {saving ? 'Inaokolewa...' : isNew ? 'Unda Mpango' : 'Hifadhi Mabadiliko'}
            </button>
            <button onClick={onClose} className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Ghairi</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Org Subscription Row Actions ───────────────────────────────────────────────

function OrgSubActions({ sub, plans, onUpdated }: {
  sub: OrgSubscription
  plans: SubscriptionPlan[]
  onUpdated: (s: OrgSubscription) => void
}) {
  const [open,     setOpen]    = useState(false)
  const [mode,     setMode]    = useState<'plan' | 'status' | 'trial'>('plan')
  const [planId,   setPlanId]  = useState(sub.plan_id ?? '')
  const [status,   setStatus]  = useState<SubscriptionStatus>(sub.status)
  const [trialEnd, setTrialEnd] = useState(sub.trial_ends_at?.slice(0, 10) ?? '')
  const [saving,   setSaving]  = useState(false)
  const [error,    setError]   = useState<string | null>(null)

  async function apply() {
    setSaving(true); setError(null)
    const body: Record<string, unknown> = {}
    if (mode === 'plan')   body.plan_id = planId   || null
    if (mode === 'status') body.status  = status
    if (mode === 'trial')  body.trial_ends_at = trialEnd ? new Date(trialEnd).toISOString() : null

    const res  = await fetch(`/api/v1/admin/org-subscriptions/${sub.org_id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Kuna tatizo'); setSaving(false); return }
    onUpdated(data.subscription)
    setOpen(false)
    setSaving(false)
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(p => !p)} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition flex items-center gap-1">
        Badilisha <i className="ti ti-chevron-down text-[10px]" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl z-30 p-4 w-72">
          <div className="flex gap-1 mb-3 bg-gray-100 p-1 rounded-xl">
            {(['plan', 'status', 'trial'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${mode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                {m === 'plan' ? 'Mpango' : m === 'status' ? 'Hali' : 'Majaribio'}
              </button>
            ))}
          </div>

          {mode === 'plan' && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Badilisha mpango wa {sub.org?.name}</p>
              <select value={planId} onChange={e => setPlanId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 mb-2">
                <option value="">— Bila Mpango —</option>
                {plans.filter(p => p.is_active).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({fmt(p.price_tzs)}/{p.billing_cycle === 'monthly' ? 'mwezi' : p.billing_cycle === 'quarterly' ? 'robo' : 'mwaka'})</option>
                ))}
              </select>
            </div>
          )}

          {mode === 'status' && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Badilisha hali ya usajili</p>
              <select value={status} onChange={e => setStatus(e.target.value as SubscriptionStatus)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 mb-2">
                {(['trial','active','past_due','grace_period','cancelled','expired'] as SubscriptionStatus[]).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          {mode === 'trial' && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Ongeza muda wa majaribio</p>
              <input type="date" value={trialEnd} onChange={e => setTrialEnd(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 mb-2" />
            </div>
          )}

          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

          <div className="flex gap-2">
            <button onClick={apply} disabled={saving} className="flex-1 bg-primary-500 text-white py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-40">
              {saving ? '...' : 'Tekeleza'}
            </button>
            <button onClick={() => setOpen(false)} className="px-3 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">✕</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Invoice Status badge ──────────────────────────────────────────────────────

const INV_STATUS: Record<InvoiceStatus, { label: string; cls: string }> = {
  pending:        { label: 'Inasubiri',     cls: 'bg-amber-100 text-amber-700'  },
  proof_uploaded: { label: 'Ushahidi',      cls: 'bg-blue-100 text-blue-700'    },
  confirmed:      { label: 'Imethibitishwa', cls: 'bg-green-100 text-green-700' },
  void:           { label: 'Imebatilishwa', cls: 'bg-gray-100 text-gray-400'    },
}

interface AdminInvoice extends SubscriptionInvoice {
  confirmer?: { id: string; full_name: string | null } | null
}

interface InvSummary { total: number; pending: number; proof_uploaded: number; confirmed: number; void: number }

function InvoicesTab({ plans }: { plans: SubscriptionPlan[] }) {
  const [invoices,  setInvoices]  = useState<AdminInvoice[]>([])
  const [summary,   setSummary]   = useState<InvSummary | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [statusFlt, setStatusFlt] = useState('')
  const [acting,    setActing]    = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  // Create form
  const [cOrg,  setCOrg]  = useState('')
  const [cPlan, setCPlan] = useState('')
  const [cCycle, setCCycle] = useState('monthly')
  const [cNote, setCNote] = useState('')
  const [creating, setCreating] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ limit: '100' })
      if (search)    p.set('q', search)
      if (statusFlt) p.set('status', statusFlt)
      const res  = await fetch(`/api/v1/admin/invoices?${p}`)
      const data = await res.json()
      setInvoices(data.invoices ?? [])
      setSummary(data.summary ?? null)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [search, statusFlt])

  useEffect(() => { load() }, [load])

  async function act(id: string, action: 'confirm' | 'void') {
    const reason = action === 'void' ? prompt('Sababu ya kubatilisha?') ?? '' : ''
    setActing(id)
    const res  = await fetch(`/api/v1/admin/invoices/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, void_reason: reason }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); setActing(null); return }
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...data.invoice } : i))
    setActing(null)
  }

  async function createInvoice() {
    setCreating(true); setCreateErr(null)
    const res  = await fetch('/api/v1/admin/invoices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: cOrg.trim(), plan_id: cPlan, billing_cycle: cCycle, notes: cNote.trim() || undefined }),
    })
    const data = await res.json()
    if (!res.ok) { setCreateErr(data.error ?? 'Kuna tatizo'); setCreating(false); return }
    setInvoices(prev => [data.invoice, ...prev])
    setShowCreate(false); setCOrg(''); setCPlan(''); setCNote(''); setCreating(false)
  }

  const STATUS_FILTERS = [
    { v: '',             label: `Yote (${summary?.total ?? 0})`            },
    { v: 'pending',      label: `Inasubiri (${summary?.pending ?? 0})`     },
    { v: 'proof_uploaded', label: `Ushahidi (${summary?.proof_uploaded ?? 0})` },
    { v: 'confirmed',    label: `Imethibitishwa (${summary?.confirmed ?? 0})`  },
    { v: 'void',         label: `Imebatilishwa (${summary?.void ?? 0})`    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 flex-1 flex-wrap">
          <form onSubmit={e => { e.preventDefault(); load() }} className="flex gap-2 flex-1 min-w-[200px]">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tafuta shirika..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            <button type="submit" className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800">
              <i className="ti ti-search" />
            </button>
          </form>
        </div>
        <button onClick={() => setShowCreate(p => !p)}
          className="ml-2 flex items-center gap-1 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600">
          <i className="ti ti-plus" /> Unda
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3">Unda Ankara Mpya</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Org ID</label>
              <input value={cOrg} onChange={e => setCOrg(e.target.value)} placeholder="uuid wa shirika"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Mpango</label>
              <select value={cPlan} onChange={e => setCPlan(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300">
                <option value="">Chagua mpango</option>
                {plans.filter(p => p.is_active && p.price_tzs > 0).map(p => (
                  <option key={p.id} value={p.id}>{p.name} — Tsh {p.price_tzs.toLocaleString()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Mzunguko</label>
              <select value={cCycle} onChange={e => setCCycle(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300">
                <option value="monthly">Kila Mwezi</option>
                <option value="quarterly">Kila Robo Mwaka</option>
                <option value="annual">Kila Mwaka</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Maelezo</label>
              <input value={cNote} onChange={e => setCNote(e.target.value)} placeholder="Hiari"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
          </div>
          {createErr && <p className="text-sm text-red-600 mb-2">{createErr}</p>}
          <div className="flex gap-2">
            <button onClick={createInvoice} disabled={creating || !cOrg.trim() || !cPlan}
              className="flex-1 bg-primary-500 text-white py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-40">
              {creating ? 'Inaunda...' : 'Unda Ankara'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Ghairi</button>
          </div>
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto pb-1 mb-4">
        {STATUS_FILTERS.map(s => (
          <button key={s.v} onClick={() => setStatusFlt(s.v)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-medium transition ${statusFlt === s.v ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-2xl" />)}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {invoices.length === 0 ? (
            <div className="p-12 text-center">
              <i className="ti ti-receipt text-5xl text-gray-200" aria-hidden="true" />
              <p className="text-gray-500 font-medium mt-3">Hakuna ankara</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Shirika', 'Mpango', 'Kiasi', 'Hali', 'Tarehe', 'Ushahidi', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invoices.map(inv => {
                    const s   = INV_STATUS[inv.status as InvoiceStatus]
                    const org = inv.org as { name: string } | null
                    const plan = inv.plan as { name: string } | null
                    const isActing = acting === inv.id
                    const canAct = inv.status === 'pending' || inv.status === 'proof_uploaded'
                    return (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{org?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{plan?.name ?? '—'}</td>
                        <td className="px-4 py-3 font-mono text-gray-700">Tsh {inv.amount_tzs.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${s.cls}`}>{s.label}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {new Date(inv.created_at).toLocaleDateString('sw-TZ')}
                        </td>
                        <td className="px-4 py-3">
                          {inv.proof_url ? (
                            <a href={inv.proof_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                              <i className="ti ti-external-link" /> Angalia
                            </a>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canAct && (
                            <div className="flex gap-1.5 justify-end">
                              <button onClick={() => act(inv.id, 'confirm')} disabled={!!acting}
                                className="text-xs px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-40">
                                {isActing ? '...' : 'Thibitisha'}
                              </button>
                              <button onClick={() => act(inv.id, 'void')} disabled={!!acting}
                                className="text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 disabled:opacity-40">
                                Batilisha
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'plans' | 'subscriptions' | 'invoices'

export default function AdminSubscriptionsPage() {
  const [tab,     setTab]     = useState<Tab>('subscriptions')

  // Plans state
  const [plans,      setPlans]      = useState<SubscriptionPlan[]>([])
  const [planModal,  setPlanModal]  = useState<SubscriptionPlan | null | 'new'>()
  const [plansLoad,  setPlansLoad]  = useState(true)

  // Org subscriptions state
  const [subs,       setSubs]       = useState<OrgSubscription[]>([])
  const [summary,    setSummary]    = useState<Summary | null>(null)
  const [subsLoad,   setSubsLoad]   = useState(true)
  const [search,     setSearch]     = useState('')
  const [statusFilt, setStatusFilt] = useState('')

  const loadPlans = useCallback(async () => {
    setPlansLoad(true)
    try {
      const res  = await fetch('/api/v1/admin/subscription-plans')
      const data = await res.json()
      setPlans(data.plans ?? [])
    } catch { /* silent */ }
    finally { setPlansLoad(false) }
  }, [])

  const loadSubs = useCallback(async () => {
    setSubsLoad(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (search)     params.set('q', search)
      if (statusFilt) params.set('status', statusFilt)
      const res  = await fetch(`/api/v1/admin/org-subscriptions?${params}`)
      const data = await res.json()
      setSubs(data.subscriptions ?? [])
      setSummary(data.summary ?? null)
    } catch { /* silent */ }
    finally { setSubsLoad(false) }
  }, [search, statusFilt])

  useEffect(() => { loadPlans() }, [loadPlans])
  useEffect(() => { loadSubs()  }, [loadSubs])

  async function togglePlanActive(p: SubscriptionPlan) {
    const res  = await fetch(`/api/v1/admin/subscription-plans/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !p.is_active }),
    })
    const data = await res.json()
    if (res.ok) setPlans(prev => prev.map(x => x.id === p.id ? data.plan : x))
  }

  async function deletePlan(p: SubscriptionPlan) {
    if (!confirm(`Una uhakika unataka kufuta mpango "${p.name}"?`)) return
    const res  = await fetch(`/api/v1/admin/subscription-plans/${p.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    setPlans(prev => prev.map(x => x.id === p.id ? { ...x, is_active: false } : x))
  }

  const STATUS_TABS = [
    { v: '',             label: `Yote (${summary?.total ?? 0})` },
    { v: 'trial',        label: `Majaribio (${summary?.trial ?? 0})` },
    { v: 'active',       label: `Hai (${summary?.active ?? 0})` },
    { v: 'past_due',     label: `Imechelewa (${summary?.past_due ?? 0})` },
    { v: 'grace_period', label: `Neema (${summary?.grace_period ?? 0})` },
    { v: 'cancelled',    label: `Ilisimamishwa (${summary?.cancelled ?? 0})` },
  ]

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Usimamizi wa Usajili</h1>
          <p className="text-sm text-gray-500 mt-0.5">Simamia mipango na usajili wa mashirika</p>
        </div>
        {tab === 'plans' && (
          <button
            onClick={() => setPlanModal('new')}
            className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition"
          >
            <i className="ti ti-plus" aria-hidden="true" />
            Mpango Mpya
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-6 w-fit">
        {([
          { id: 'subscriptions', label: 'Usajili' },
          { id: 'invoices',      label: 'Ankara'  },
          { id: 'plans',         label: 'Mipango' },
        ] as { id: Tab; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Plans Tab ── */}
      {tab === 'plans' && (
        <div>
          {plansLoad ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-2xl" />)}</div>
          ) : (
            <div className="space-y-4">
              {plans.map(p => (
                <div key={p.id} className={`bg-white rounded-2xl border p-5 shadow-sm ${p.is_active ? 'border-gray-100' : 'border-dashed border-gray-200 opacity-60'}`}>
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900">{p.name}</span>
                        {p.is_default && <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-medium">Chaguo-msingi</span>}
                        {!p.is_active && <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Imesimamishwa</span>}
                        {!p.is_public && <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">Binafsi</span>}
                      </div>
                      {p.description && <p className="text-sm text-gray-500 mt-0.5">{p.description}</p>}
                      <p className="text-lg font-bold text-primary-600 mt-1">
                        {p.price_tzs === 0 ? 'Bila Malipo' : fmt(p.price_tzs)}
                        {p.price_tzs > 0 && <span className="text-sm font-normal text-gray-400 ml-1">/{p.billing_cycle === 'monthly' ? 'mwezi' : p.billing_cycle === 'quarterly' ? 'robo' : 'mwaka'}</span>}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => setPlanModal(p)} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                        <i className="ti ti-edit" />
                      </button>
                      <button onClick={() => togglePlanActive(p)} className={`text-xs px-3 py-1.5 rounded-lg transition ${p.is_active ? 'border border-amber-200 text-amber-600 hover:bg-amber-50' : 'border border-green-200 text-green-600 hover:bg-green-50'}`}>
                        {p.is_active ? 'Simamisha' : 'Washa'}
                      </button>
                      {!p.is_default && (
                        <button onClick={() => deletePlan(p)} className="text-xs px-3 py-1.5 border border-red-100 rounded-lg text-red-500 hover:bg-red-50">
                          <i className="ti ti-trash" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Feature chips */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {FEATURE_LABELS.map(([key, label]) => {
                      const val = p.features[key]
                      const isNum  = ['max_properties', 'max_units', 'max_members', 'trial_days'].includes(key)
                      if (!isNum && !val) return null
                      return (
                        <span key={key} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full flex items-center gap-1">
                          {isNum ? (val === -1 ? '∞' : val) : <i className="ti ti-check text-green-500 text-[10px]" />} {label}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}

              {plans.length === 0 && (
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                  <i className="ti ti-package text-5xl text-gray-200" aria-hidden="true" />
                  <p className="text-gray-500 font-medium mt-3">Hakuna mipango bado</p>
                  <p className="text-sm text-gray-400 mt-1">Unda mpango wa kwanza. Kumbuka kuendesha migration ya subscriptions_phase1.sql kwanza.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Subscriptions Tab ── */}
      {tab === 'subscriptions' && (
        <div>
          {/* Summary chips */}
          {summary && (
            <div className="flex gap-2 flex-wrap mb-4">
              {[
                { label: 'Majaribio', val: summary.trial,        color: 'bg-blue-50 text-blue-700'   },
                { label: 'Hai',       val: summary.active,       color: 'bg-green-50 text-green-700' },
                { label: 'Imechelewa',val: summary.past_due,     color: 'bg-amber-50 text-amber-700' },
                { label: 'Neema',     val: summary.grace_period, color: 'bg-orange-50 text-orange-700'},
                { label: 'Ilisimamishwa', val: summary.cancelled, color: 'bg-gray-100 text-gray-500' },
              ].map(c => (
                <span key={c.label} className={`text-sm px-3 py-1.5 rounded-xl font-medium ${c.color}`}>
                  {c.label}: {c.val}
                </span>
              ))}
            </div>
          )}

          {/* Search + filter */}
          <div className="flex gap-2 mb-3 flex-wrap">
            <form onSubmit={e => { e.preventDefault(); loadSubs() }} className="flex gap-2 flex-1 min-w-[200px]">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tafuta jina la shirika..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
              <button type="submit" className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800">
                <i className="ti ti-search" aria-hidden="true" />
              </button>
            </form>
          </div>

          {/* Status filter tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1 mb-4">
            {STATUS_TABS.map(s => (
              <button
                key={s.v}
                onClick={() => setStatusFilt(s.v)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-medium transition ${statusFilt === s.v ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {subsLoad ? (
            <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-2xl" />)}</div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {subs.length === 0 ? (
                <div className="p-12 text-center">
                  <i className="ti ti-building text-5xl text-gray-200" aria-hidden="true" />
                  <p className="text-gray-500 font-medium mt-3">Hakuna usajili unaofanana</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Shirika</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mpango</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Hali</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mwisho</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {subs.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{s.org?.name ?? s.org_id}</p>
                            <p className="text-xs text-gray-400 capitalize">{s.org?.org_type?.replace('_', ' ')}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {s.plan?.name ?? <span className="text-gray-400 italic">Bila Mpango</span>}
                            {s.pending_plan_id && (
                              <p className="text-xs text-amber-500 mt-0.5">
                                <i className="ti ti-clock" /> Inabadilishwa {dateFmt(s.pending_plan_starts_at)}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">{statusBadge(s.status)}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {s.status === 'trial'
                              ? `Majaribio: ${dateFmt(s.trial_ends_at)}`
                              : dateFmt(s.current_period_end)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <OrgSubActions
                              sub={s}
                              plans={plans}
                              onUpdated={updated => setSubs(prev => prev.map(x => x.id === updated.id ? updated : x))}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Invoices Tab ── */}
      {tab === 'invoices' && <InvoicesTab plans={plans} />}

      {/* Plan create/edit modal */}
      {planModal && (
        <PlanModal
          plan={planModal === 'new' ? null : planModal}
          onSave={saved => {
            setPlans(prev => {
              const idx = prev.findIndex(p => p.id === saved.id)
              return idx >= 0 ? prev.map(p => p.id === saved.id ? saved : p) : [...prev, saved]
            })
            setPlanModal(undefined)
          }}
          onClose={() => setPlanModal(undefined)}
        />
      )}
    </div>
  )
}
