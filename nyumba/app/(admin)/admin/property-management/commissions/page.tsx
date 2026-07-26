'use client'
import { useEffect, useState, useCallback } from 'react'

type CollectionStatus = 'pending' | 'invoiced' | 'collected' | 'overdue'
type RuleType = 'flat_fee' | 'percent_first_month' | 'percent_annual'

interface CommissionRule {
  id: string; rule_type: RuleType; value: number; description: string | null; active: boolean; created_at: string
}
interface Commission {
  id:               string
  calculated_amount: number | null
  collection_status: CollectionStatus
  invoice_sent_at:  string | null
  collected_at:     string | null
  proof_url:        string | null
  notes:            string | null
  created_at:       string
  listing:  { id: string; title: string; district: string; region: string; type: string } | null
  landlord: { id: string; full_name: string | null; phone: string | null } | null
  staff:    { id: string; full_name: string | null } | null
  rule:     { id: string; rule_type: RuleType; value: number } | null
}
interface Summary {
  total_pending: number; total_invoiced: number
  total_collected_month: number; overdue_count: number
  pending_count: number; invoiced_count: number
}

const STATUS_META: Record<CollectionStatus, { label: string; color: string; icon: string }> = {
  pending:   { label: 'Inasubiri',        color: 'bg-amber-100 text-amber-700', icon: 'clock'         },
  invoiced:  { label: 'Invoice Imetumwa', color: 'bg-blue-100 text-blue-700',  icon: 'file-invoice'  },
  collected: { label: 'Imekusanywa',      color: 'bg-green-100 text-green-700',icon: 'circle-check'  },
  overdue:   { label: 'Imechelewa',       color: 'bg-red-100 text-red-700',    icon: 'alert-circle'  },
}
const RULE_LABELS: Record<RuleType, string> = {
  flat_fee:            'Kiwango Kisichobadilika (Tsh)',
  percent_first_month: 'Asilimia ya Kodi ya Mwezi wa Kwanza',
  percent_annual:      'Asilimia ya Kodi ya Mwaka',
}
const STATUS_FILTERS: { value: CollectionStatus | 'all'; label: string }[] = [
  { value: 'all',       label: 'Zote'             },
  { value: 'pending',   label: 'Inasubiri'        },
  { value: 'invoiced',  label: 'Invoice Imetumwa' },
  { value: 'overdue',   label: 'Imechelewa'       },
  { value: 'collected', label: 'Imekusanywa'      },
]

function fmtMoney(n: number | null) {
  if (!n) return '—'
  if (n >= 1_000_000) return `Tsh ${(n / 1_000_000).toFixed(2)}M`
  return `Tsh ${n.toLocaleString('en-TZ')}`
}
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Action panel (inline per row) ─────────────────────────────────────────────
function ActionPanel({ commission, onDone }: { commission: Commission; onDone: () => void }) {
  const [open,     setOpen]     = useState(false)
  const [action,   setAction]   = useState<'invoice' | 'collect' | 'overdue' | 'reset' | null>(null)
  const [proofUrl, setProofUrl] = useState('')
  const [notes,    setNotes]    = useState(commission.notes ?? '')
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState<string | null>(null)

  const status = commission.collection_status
  const nextActions: Array<{ key: 'invoice' | 'collect' | 'overdue' | 'reset'; label: string; color: string }> = []
  if (status === 'pending')  nextActions.push({ key: 'invoice', label: 'Tuma Invoice',      color: 'border-blue-200 text-blue-700 hover:bg-blue-50'   })
  if (status === 'pending' || status === 'invoiced') nextActions.push({ key: 'collect', label: 'Rekodi Malipo', color: 'border-green-200 text-green-700 hover:bg-green-50' })
  if (status !== 'overdue' && status !== 'collected') nextActions.push({ key: 'overdue', label: 'Weka Muda Kupita', color: 'border-red-200 text-red-700 hover:bg-red-50' })
  if (status !== 'pending')  nextActions.push({ key: 'reset',   label: 'Rudisha Awali',    color: 'border-gray-200 text-gray-500 hover:bg-gray-50'    })

  async function submit() {
    if (!action) return
    if (action === 'collect' && !proofUrl.trim()) { setErr('Bandika kiungo cha uthibitisho wa malipo'); return }
    setSaving(true); setErr(null)
    const res  = await fetch(`/api/v1/admin/brokerage-commissions/${commission.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, proof_url: proofUrl.trim(), notes }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setErr(data.error ?? 'Kuna tatizo'); return }
    setOpen(false); setAction(null)
    onDone()
  }

  return (
    <div className="flex-shrink-0 relative">
      <button onClick={() => setOpen(o => !o)}
        className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition">
        {status === 'collected' ? 'Angalia' : 'Hatua'}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-72 bg-white border border-gray-100 rounded-2xl shadow-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs font-semibold text-gray-600">Chagua Hatua</p>
            <button onClick={() => { setOpen(false); setAction(null); setErr(null) }} className="text-gray-400 hover:text-gray-600">
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>

          {!action ? (
            <div className="space-y-1.5">
              {commission.proof_url && (
                <a href={commission.proof_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-primary-600 hover:underline mb-2">
                  <i className="ti ti-external-link" aria-hidden="true" />Angalia uthibitisho wa malipo
                </a>
              )}
              {nextActions.map(a => (
                <button key={a.key} onClick={() => setAction(a.key)}
                  className={`w-full border rounded-xl px-3 py-2 text-xs font-medium text-left transition ${a.color}`}>
                  {a.label}
                </button>
              ))}
              {commission.notes && (
                <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-50">Kumbukumbu: {commission.notes}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {action === 'collect' && (
                <div>
                  <label className="text-[10px] text-gray-500 font-semibold block mb-1">Kiungo cha Uthibitisho (Lazima) *</label>
                  <input type="url" value={proofUrl} onChange={e => setProofUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
              )}
              <div>
                <label className="text-[10px] text-gray-500 font-semibold block mb-1">Kumbukumbu (hiari)</label>
                <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
              </div>
              {err && <p className="text-[10px] text-red-600">{err}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setAction(null); setErr(null) }}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50">Rudi</button>
                <button onClick={submit} disabled={saving}
                  className="flex-1 bg-primary-500 text-white py-2 rounded-xl text-xs font-semibold hover:bg-primary-600 disabled:opacity-40 transition">
                  {saving ? 'Inahifadhi...' : 'Thibitisha'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [summary,     setSummary]     = useState<Summary>({ total_pending: 0, total_invoiced: 0, total_collected_month: 0, overdue_count: 0, pending_count: 0, invoiced_count: 0 })
  const [rules,       setRules]       = useState<CommissionRule[]>([])
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState<CollectionStatus | 'all'>('pending')
  const [search,      setSearch]      = useState('')

  // New commission form
  const [showForm,  setShowForm]  = useState(false)
  const [listings,  setListings]  = useState<Array<{ id: string; title: string; district: string }>>([])
  const [formData,  setFormData]  = useState({ listing_id: '', calculated_amount: '', notes: '' })
  const [formErr,   setFormErr]   = useState<string | null>(null)
  const [creating,  setCreating]  = useState(false)

  // New rule form
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [ruleForm,     setRuleForm]     = useState({ rule_type: 'percent_first_month' as RuleType, value: '', description: '' })
  const [savingRule,   setSavingRule]   = useState(false)
  const [ruleErr,      setRuleErr]      = useState<string | null>(null)

  const activeRule = rules.find(r => r.active)

  const load = useCallback(async (status: CollectionStatus | 'all', q: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status !== 'all') params.set('status', status)
      if (q.trim()) params.set('search', q.trim())
      const [cRes, rRes] = await Promise.all([
        fetch(`/api/v1/admin/brokerage-commissions?${params}`),
        fetch('/api/v1/admin/commission-rules'),
      ])
      const cData = await cRes.json()
      const rData = await rRes.json()
      setCommissions(cData.commissions ?? [])
      if (cData.summary) setSummary(cData.summary)
      setRules(rData.rules ?? [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(tab, search) }, [tab, load]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load listings for create form
  useEffect(() => {
    if (!showForm || listings.length > 0) return
    fetch('/api/v1/listings?limit=100&status=active')
      .then(r => r.json())
      .then(d => setListings((d.listings ?? []).map((l: { id: string; title: string; district: string }) => ({ id: l.id, title: l.title, district: l.district }))))
      .catch(() => {})
  }, [showForm, listings.length])

  async function handleCreate() {
    if (!formData.listing_id || !formData.calculated_amount) { setFormErr('Jaza sehemu zote muhimu'); return }
    setCreating(true); setFormErr(null)
    try {
      // Fetch landlord from listing
      const lr   = await fetch(`/api/v1/listings/${formData.listing_id}`).then(r => r.json()).catch(() => ({}))
      const landlordId = lr.listing?.dalali_id ?? lr.listing?.owner_id ?? ''
      if (!landlordId) { setFormErr('Haikuweza kupata mmiliki wa mali'); setCreating(false); return }

      const res  = await fetch('/api/v1/admin/brokerage-commissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: formData.listing_id, landlord_id: landlordId, calculated_amount: parseFloat(formData.calculated_amount), notes: formData.notes }),
      })
      const data = await res.json()
      if (!res.ok) { setFormErr(data.error ?? 'Kuna tatizo'); return }
      setShowForm(false)
      setFormData({ listing_id: '', calculated_amount: '', notes: '' })
      load(tab, search)
    } catch { setFormErr('Haikuweza kuunda.') }
    finally { setCreating(false) }
  }

  async function handleSaveRule() {
    if (!ruleForm.value || parseFloat(ruleForm.value) <= 0) { setRuleErr('Weka thamani sahihi'); return }
    setSavingRule(true); setRuleErr(null)
    try {
      const res  = await fetch('/api/v1/admin/commission-rules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule_type: ruleForm.rule_type, value: parseFloat(ruleForm.value), description: ruleForm.description.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) { setRuleErr(data.error ?? 'Kuna tatizo'); return }
      setRules(prev => [data.rule, ...prev.map(r => ({ ...r, active: false }))])
      setShowRuleForm(false)
    } catch { setRuleErr('Haikuweza kuhifadhi.') }
    finally { setSavingRule(false) }
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Kamisheni za Brokerage</h1>
          <p className="text-sm text-gray-400 mt-0.5">Fuatilia na kusimamia mapato ya NyumbaFasta kutoka kwa wamiliki</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-primary-500 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
          <i className="ti ti-plus" aria-hidden="true" />
          <span className="hidden sm:inline">Ongeza Kamisheni</span>
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { label: 'Inayosubiri',       value: fmtMoney(summary.total_pending),         sub: `${summary.pending_count} rekodi`,  color: 'bg-amber-50 border-amber-100 text-amber-700' },
          { label: 'Invoice Imetumwa',  value: fmtMoney(summary.total_invoiced),        sub: `${summary.invoiced_count} rekodi`, color: 'bg-blue-50  border-blue-100  text-blue-700'  },
          { label: 'Mwezi Huu',         value: fmtMoney(summary.total_collected_month), sub: 'Imekusanywa',                      color: 'bg-green-50 border-green-100 text-green-700' },
          { label: 'Imechelewa',        value: String(summary.overdue_count),           sub: 'Inahitaji usimamizi',              color: summary.overdue_count > 0 ? 'bg-red-50 border-red-100 text-red-700' : 'bg-gray-50 border-gray-100 text-gray-500' },
        ] as const).map(c => (
          <div key={c.label} className={`rounded-2xl border p-4 ${c.color}`}>
            <p className="text-xl font-bold">{c.value}</p>
            <p className="text-xs font-semibold mt-0.5 opacity-90">{c.label}</p>
            <p className="text-[10px] opacity-60 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Active commission rule */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500">Sheria ya Kamisheni Inayotumika</p>
          <button onClick={() => { setShowRuleForm(r => !r); setRuleErr(null) }}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium">
            {showRuleForm ? 'Ghairi' : 'Badilisha Sheria'}
          </button>
        </div>

        {activeRule ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="ti ti-coin text-primary-600 text-lg" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">
                {activeRule.rule_type === 'flat_fee' ? `Tsh ${activeRule.value.toLocaleString('en-TZ')}` : `${activeRule.value}%`}
              </p>
              <p className="text-xs text-gray-500">{RULE_LABELS[activeRule.rule_type]}</p>
              {activeRule.description && <p className="text-[10px] text-gray-400 mt-0.5">{activeRule.description}</p>}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Hakuna sheria iliyoainishwa.</p>
        )}

        {showRuleForm && (
          <div className="mt-4 pt-4 border-t border-gray-50 space-y-2.5">
            <p className="text-xs font-semibold text-gray-600">Sheria Mpya (itabadilisha ya sasa)</p>
            <div className="grid grid-cols-2 gap-2">
              <select value={ruleForm.rule_type} onChange={e => setRuleForm(p => ({ ...p, rule_type: e.target.value as RuleType }))}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white col-span-2">
                {(Object.keys(RULE_LABELS) as RuleType[]).map(k => <option key={k} value={k}>{RULE_LABELS[k]}</option>)}
              </select>
              <input type="number" placeholder={ruleForm.rule_type === 'flat_fee' ? 'Kiasi (Tsh)' : 'Asilimia (%)'}
                value={ruleForm.value} onChange={e => setRuleForm(p => ({ ...p, value: e.target.value }))}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              <input type="text" placeholder="Maelezo (hiari)"
                value={ruleForm.description} onChange={e => setRuleForm(p => ({ ...p, description: e.target.value }))}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            {ruleErr && <p className="text-xs text-red-600">{ruleErr}</p>}
            <button onClick={handleSaveRule} disabled={savingRule}
              className="bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 transition">
              {savingRule ? 'Inahifadhi...' : 'Hifadhi Sheria Mpya'}
            </button>
          </div>
        )}
      </div>

      {/* Create commission form */}
      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-semibold text-gray-900">Ongeza Rekodi ya Kamisheni</p>
            <button onClick={() => { setShowForm(false); setFormErr(null) }} className="text-gray-400 hover:text-gray-600">
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>
          <div className="space-y-2.5">
            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1">Mali (Listing)</label>
              <select value={formData.listing_id} onChange={e => setFormData(p => ({ ...p, listing_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                <option value="">Chagua mali...</option>
                {listings.map(l => <option key={l.id} value={l.id}>{l.title} — {l.district}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1">Kiasi cha Kamisheni (Tsh)</label>
              <input type="number" value={formData.calculated_amount}
                onChange={e => setFormData(p => ({ ...p, calculated_amount: e.target.value }))}
                placeholder="e.g. 150000"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              {activeRule && (
                <p className="text-[10px] text-gray-400 mt-1">
                  Sheria hai: {activeRule.value}{activeRule.rule_type === 'flat_fee' ? ' Tsh' : '%'} — {RULE_LABELS[activeRule.rule_type]}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold block mb-1">Kumbukumbu (hiari)</label>
              <input type="text" value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                placeholder="Maelezo ya ziada..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            {formErr && <p className="text-xs text-red-600">{formErr}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setShowForm(false); setFormErr(null) }}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Ghairi</button>
              <button onClick={handleCreate} disabled={creating}
                className="flex-1 bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 transition">
                {creating ? 'Inaunda...' : 'Unda Rekodi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Commission list */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-50 flex flex-col sm:flex-row gap-3">
          <form onSubmit={e => { e.preventDefault(); load(tab, search) }} className="flex-1 flex gap-2">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tafuta mali au mmiliki..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            <button type="submit"
              className="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
              Tafuta
            </button>
          </form>
          <div className="flex gap-1.5 overflow-x-auto">
            {STATUS_FILTERS.map(f => (
              <button key={f.value} onClick={() => setTab(f.value)}
                className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition ${
                  tab === f.value ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />)}
          </div>
        ) : commissions.length === 0 ? (
          <div className="text-center py-16">
            <i className="ti ti-coin text-5xl text-gray-200" aria-hidden="true" />
            <p className="text-gray-500 font-medium mt-3">Hakuna rekodi za kamisheni</p>
            <p className="text-sm text-gray-400 mt-1">
              {tab !== 'all' ? 'Badilisha kichujio.' : 'Bonyeza "Ongeza Kamisheni" kuanza.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {commissions.map(c => {
              const listing  = c.listing  as unknown as typeof c.listing
              const landlord = c.landlord as unknown as typeof c.landlord
              const staff    = c.staff    as unknown as typeof c.staff
              const meta     = STATUS_META[c.collection_status]

              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/50">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    c.collection_status === 'collected' ? 'bg-green-400' :
                    c.collection_status === 'overdue'   ? 'bg-red-400' :
                    c.collection_status === 'invoiced'  ? 'bg-blue-400' : 'bg-amber-400'
                  }`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-gray-900 truncate max-w-xs">
                        {listing?.title ?? 'Mali isiyojulikana'}
                      </p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${meta.color}`}>
                        <i className={`ti ti-${meta.icon} mr-0.5`} aria-hidden="true" />{meta.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-400">
                      {listing?.district && <span>{listing.district}</span>}
                      {landlord?.full_name && <span><i className="ti ti-user mr-0.5" aria-hidden="true" />{landlord.full_name}</span>}
                      {staff?.full_name && <span><i className="ti ti-user-check mr-0.5" aria-hidden="true" />{staff.full_name}</span>}
                      <span>{fmtDate(c.created_at)}</span>
                    </div>
                    {c.invoice_sent_at && <p className="text-[10px] text-blue-400 mt-0.5">Invoice: {fmtDate(c.invoice_sent_at)}</p>}
                    {c.collected_at    && <p className="text-[10px] text-green-400 mt-0.5">Imekusanywa: {fmtDate(c.collected_at)}</p>}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm text-gray-900">{fmtMoney(c.calculated_amount)}</p>
                    {c.collection_status !== 'collected' && <p className="text-[10px] text-gray-400">Inasubiri</p>}
                  </div>

                  <ActionPanel commission={c} onDone={() => load(tab, search)} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Rule history */}
      {rules.length > 1 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">Historia ya Sheria za Kamisheni</p>
          <div className="divide-y divide-gray-50">
            {rules.slice(0, 6).map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium text-gray-700">
                    {r.rule_type === 'flat_fee' ? `Tsh ${r.value.toLocaleString()}` : `${r.value}%`}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">{RULE_LABELS[r.rule_type]}</span>
                </div>
                <div className="flex items-center gap-2">
                  {r.active && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Hai</span>}
                  <span className="text-xs text-gray-400">{fmtDate(r.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
