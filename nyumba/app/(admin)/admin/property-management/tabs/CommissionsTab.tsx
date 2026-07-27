'use client'
import { useEffect, useState, useCallback } from 'react'

type CollectionStatus = 'pending' | 'invoiced' | 'collected' | 'overdue'
type RuleType = 'flat_fee' | 'percent_first_month' | 'percent_annual'

interface CommissionRule {
  id: string; rule_type: RuleType; value: number; description: string | null; active: boolean; created_at: string
}
interface Commission {
  id:                string
  calculated_amount: number | null
  collection_status: CollectionStatus
  invoice_sent_at:   string | null
  collected_at:      string | null
  proof_url:         string | null
  notes:             string | null
  created_at:        string
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

const STATUS_META: Record<CollectionStatus, { label: string; bg: string; color: string; icon: string }> = {
  pending:   { label: 'Inasubiri',        bg: '#faeeda', color: '#854f0b', icon: 'clock'         },
  invoiced:  { label: 'Invoice Imetumwa', bg: '#e6f1fb', color: '#185fa5', icon: 'file-invoice'  },
  collected: { label: 'Imekusanywa',      bg: '#eaf3de', color: '#3b6d11', icon: 'circle-check'  },
  overdue:   { label: 'Imechelewa',       bg: '#fcebeb', color: '#a32d2d', icon: 'alert-circle'  },
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

function ActionPanel({ commission, onDone }: { commission: Commission; onDone: () => void }) {
  const [open,     setOpen]     = useState(false)
  const [action,   setAction]   = useState<'invoice' | 'collect' | 'overdue' | 'reset' | null>(null)
  const [proofUrl, setProofUrl] = useState('')
  const [notes,    setNotes]    = useState(commission.notes ?? '')
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState<string | null>(null)

  const status = commission.collection_status
  const nextActions: Array<{ key: 'invoice' | 'collect' | 'overdue' | 'reset'; label: string; bg: string; color: string }> = []
  if (status === 'pending') nextActions.push({ key: 'invoice', label: 'Tuma Invoice', bg: '#e6f1fb', color: '#185fa5' })
  if (status === 'pending' || status === 'invoiced') nextActions.push({ key: 'collect', label: 'Rekodi Malipo', bg: '#eaf3de', color: '#3b6d11' })
  if (status !== 'overdue' && status !== 'collected') nextActions.push({ key: 'overdue', label: 'Weka Muda Kupita', bg: '#fcebeb', color: '#a32d2d' })
  if (status !== 'pending') nextActions.push({ key: 'reset', label: 'Rudisha Awali', bg: '#f4f4f0', color: '#666660' })

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
    setOpen(false); setAction(null); onDone()
  }

  return (
    <div className="flex-shrink-0 relative">
      <button onClick={() => setOpen(o => !o)}
        className="px-3 py-1.5 rounded-xl text-xs font-semibold transition"
        style={{ border: '1px solid #e5e5e0', color: '#666660' }}>
        {status === 'collected' ? 'Angalia' : 'Hatua'}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-72 bg-white rounded-xl shadow-lg p-4" style={{ border: '1px solid #e5e5e0' }}>
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs font-semibold" style={{ color: '#666660' }}>Chagua Hatua</p>
            <button onClick={() => { setOpen(false); setAction(null); setErr(null) }} style={{ color: '#999992' }}>
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>

          {!action ? (
            <div className="space-y-1.5">
              {commission.proof_url && (
                <a href={commission.proof_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs hover:underline mb-2" style={{ color: '#1D9E75' }}>
                  <i className="ti ti-external-link" aria-hidden="true" />Angalia uthibitisho wa malipo
                </a>
              )}
              {nextActions.map(a => (
                <button key={a.key} onClick={() => setAction(a.key)}
                  className="w-full rounded-xl px-3 py-2 text-xs font-medium text-left transition hover:opacity-80"
                  style={{ background: a.bg, color: a.color }}>
                  {a.label}
                </button>
              ))}
              {commission.notes && (
                <p className="text-[10px] pt-1 mt-1" style={{ borderTop: '1px solid #f4f4f0', color: '#999992' }}>
                  Kumbukumbu: {commission.notes}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {action === 'collect' && (
                <div>
                  <label className="text-[10px] font-semibold block mb-1" style={{ color: '#666660' }}>Kiungo cha Uthibitisho (Lazima) *</label>
                  <input type="url" value={proofUrl} onChange={e => setProofUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300"
                    style={{ border: '1px solid #e5e5e0' }} />
                </div>
              )}
              <div>
                <label className="text-[10px] font-semibold block mb-1" style={{ color: '#666660' }}>Kumbukumbu (hiari)</label>
                <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                  className="w-full rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                  style={{ border: '1px solid #e5e5e0' }} />
              </div>
              {err && <p className="text-[10px] text-red-600">{err}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setAction(null); setErr(null) }}
                  className="px-3 py-2 rounded-xl text-xs" style={{ border: '1px solid #e5e5e0', color: '#666660' }}>Rudi</button>
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

export default function CommissionsTab() {
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [summary,     setSummary]     = useState<Summary>({ total_pending: 0, total_invoiced: 0, total_collected_month: 0, overdue_count: 0, pending_count: 0, invoiced_count: 0 })
  const [rules,       setRules]       = useState<CommissionRule[]>([])
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState<CollectionStatus | 'all'>('pending')
  const [search,      setSearch]      = useState('')
  const [showForm,    setShowForm]    = useState(false)
  const [listings,    setListings]    = useState<Array<{ id: string; title: string; district: string }>>([])
  const [formData,    setFormData]    = useState({ listing_id: '', calculated_amount: '', notes: '' })
  const [formErr,     setFormErr]     = useState<string | null>(null)
  const [creating,    setCreating]    = useState(false)
  const [showRuleForm,setShowRuleForm]= useState(false)
  const [ruleForm,    setRuleForm]    = useState({ rule_type: 'percent_first_month' as RuleType, value: '', description: '' })
  const [savingRule,  setSavingRule]  = useState(false)
  const [ruleErr,     setRuleErr]     = useState<string | null>(null)

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
      const cData = await cRes.json(); const rData = await rRes.json()
      setCommissions(cData.commissions ?? [])
      if (cData.summary) setSummary(cData.summary)
      setRules(rData.rules ?? [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(tab, search) }, [tab, load]) // eslint-disable-line react-hooks/exhaustive-deps

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
      const lr = await fetch(`/api/v1/listings/${formData.listing_id}`).then(r => r.json()).catch(() => ({}))
      const landlordId = lr.listing?.dalali_id ?? lr.listing?.owner_id ?? ''
      if (!landlordId) { setFormErr('Haikuweza kupata mmiliki wa mali'); setCreating(false); return }
      const res  = await fetch('/api/v1/admin/brokerage-commissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: formData.listing_id, landlord_id: landlordId, calculated_amount: parseFloat(formData.calculated_amount), notes: formData.notes }),
      })
      const data = await res.json()
      if (!res.ok) { setFormErr(data.error ?? 'Kuna tatizo'); return }
      setShowForm(false); setFormData({ listing_id: '', calculated_amount: '', notes: '' })
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
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-primary-500 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
          <i className="ti ti-plus" aria-hidden="true" />
          <span className="hidden sm:inline">Ongeza Kamisheni</span>
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { label: 'Inayosubiri',      value: fmtMoney(summary.total_pending),         sub: `${summary.pending_count} rekodi`, bg: '#faeeda', color: '#854f0b' },
          { label: 'Invoice Imetumwa', value: fmtMoney(summary.total_invoiced),        sub: `${summary.invoiced_count} rekodi`,bg: '#e6f1fb', color: '#185fa5' },
          { label: 'Mwezi Huu',        value: fmtMoney(summary.total_collected_month), sub: 'Imekusanywa',                     bg: '#eaf3de', color: '#3b6d11' },
          { label: 'Imechelewa',       value: String(summary.overdue_count),           sub: 'Inahitaji usimamizi',             bg: summary.overdue_count > 0 ? '#fcebeb' : '#f4f4f0', color: summary.overdue_count > 0 ? '#a32d2d' : '#999992' },
        ] as const).map(c => (
          <div key={c.label} className="rounded-xl p-4" style={{ background: c.bg, border: '1px solid transparent' }}>
            <p className="text-xl font-bold" style={{ color: c.color }}>{c.value}</p>
            <p className="text-xs font-semibold mt-0.5 opacity-90" style={{ color: c.color }}>{c.label}</p>
            <p className="text-[10px] opacity-60 mt-0.5" style={{ color: c.color }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Active commission rule */}
      <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e5e0' }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold" style={{ color: '#999992' }}>Sheria ya Kamisheni Inayotumika</p>
          <button onClick={() => { setShowRuleForm(r => !r); setRuleErr(null) }}
            className="text-xs font-medium hover:opacity-80" style={{ color: '#1D9E75' }}>
            {showRuleForm ? 'Ghairi' : 'Badilisha Sheria'}
          </button>
        </div>
        {activeRule ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="ti ti-coin text-primary-600 text-lg" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold" style={{ color: '#1a1a18' }}>
                {activeRule.rule_type === 'flat_fee' ? `Tsh ${activeRule.value.toLocaleString('en-TZ')}` : `${activeRule.value}%`}
              </p>
              <p className="text-xs" style={{ color: '#999992' }}>{RULE_LABELS[activeRule.rule_type]}</p>
              {activeRule.description && <p className="text-[10px] mt-0.5" style={{ color: '#999992' }}>{activeRule.description}</p>}
            </div>
          </div>
        ) : (
          <p className="text-sm" style={{ color: '#999992' }}>Hakuna sheria iliyoainishwa.</p>
        )}
        {showRuleForm && (
          <div className="mt-4 pt-4 space-y-2.5" style={{ borderTop: '1px solid #f4f4f0' }}>
            <p className="text-xs font-semibold" style={{ color: '#666660' }}>Sheria Mpya (itabadilisha ya sasa)</p>
            <div className="grid grid-cols-2 gap-2">
              <select value={ruleForm.rule_type} onChange={e => setRuleForm(p => ({ ...p, rule_type: e.target.value as RuleType }))}
                className="rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white col-span-2"
                style={{ border: '1px solid #e5e5e0' }}>
                {(Object.keys(RULE_LABELS) as RuleType[]).map(k => <option key={k} value={k}>{RULE_LABELS[k]}</option>)}
              </select>
              <input type="number" placeholder={ruleForm.rule_type === 'flat_fee' ? 'Kiasi (Tsh)' : 'Asilimia (%)'}
                value={ruleForm.value} onChange={e => setRuleForm(p => ({ ...p, value: e.target.value }))}
                className="rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                style={{ border: '1px solid #e5e5e0' }} />
              <input type="text" placeholder="Maelezo (hiari)"
                value={ruleForm.description} onChange={e => setRuleForm(p => ({ ...p, description: e.target.value }))}
                className="rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                style={{ border: '1px solid #e5e5e0' }} />
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
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e5e0' }}>
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-semibold" style={{ color: '#1a1a18' }}>Ongeza Rekodi ya Kamisheni</p>
            <button onClick={() => { setShowForm(false); setFormErr(null) }} style={{ color: '#999992' }}>
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>
          <div className="space-y-2.5">
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: '#666660' }}>Mali (Listing)</label>
              <select value={formData.listing_id} onChange={e => setFormData(p => ({ ...p, listing_id: e.target.value }))}
                className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                style={{ border: '1px solid #e5e5e0' }}>
                <option value="">Chagua mali...</option>
                {listings.map(l => <option key={l.id} value={l.id}>{l.title} — {l.district}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: '#666660' }}>Kiasi cha Kamisheni (Tsh)</label>
              <input type="number" value={formData.calculated_amount}
                onChange={e => setFormData(p => ({ ...p, calculated_amount: e.target.value }))}
                placeholder="e.g. 150000"
                className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                style={{ border: '1px solid #e5e5e0' }} />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1" style={{ color: '#666660' }}>Kumbukumbu (hiari)</label>
              <input type="text" value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                placeholder="Maelezo ya ziada..."
                className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                style={{ border: '1px solid #e5e5e0' }} />
            </div>
            {formErr && <p className="text-xs text-red-600">{formErr}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setShowForm(false); setFormErr(null) }}
                className="px-4 py-2.5 rounded-xl text-sm" style={{ border: '1px solid #e5e5e0', color: '#666660' }}>Ghairi</button>
              <button onClick={handleCreate} disabled={creating}
                className="flex-1 bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 transition">
                {creating ? 'Inaunda...' : 'Unda Rekodi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Commission list */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #e5e5e0' }}>
        <div className="p-4 flex flex-col sm:flex-row gap-3" style={{ borderBottom: '1px solid #e5e5e0' }}>
          <form onSubmit={e => { e.preventDefault(); load(tab, search) }} className="flex-1 flex gap-2">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tafuta mali au mmiliki..."
              className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              style={{ border: '1px solid #e5e5e0', color: '#1a1a18' }} />
            <button type="submit"
              className="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
              Tafuta
            </button>
          </form>
          <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {STATUS_FILTERS.map(f => (
              <button key={f.value} onClick={() => setTab(f.value)}
                className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition ${
                  tab === f.value ? 'bg-primary-500 text-white' : ''
                }`}
                style={tab !== f.value ? { background: '#f4f4f0', color: '#666660' } : {}}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: '#f4f4f0' }} />)}
          </div>
        ) : commissions.length === 0 ? (
          <div className="text-center py-16">
            <i className="ti ti-coin text-5xl" style={{ color: '#e5e5e0' }} aria-hidden="true" />
            <p className="font-medium mt-3" style={{ color: '#666660' }}>Hakuna rekodi za kamisheni</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#f4f4f0' }}>
            {commissions.map(c => {
              const listing  = c.listing  as unknown as typeof c.listing
              const landlord = c.landlord as unknown as typeof c.landlord
              const staff    = c.staff    as unknown as typeof c.staff
              const meta     = STATUS_META[c.collection_status]
              const dotBg: Record<CollectionStatus, string> = {
                collected: '#3b6d11', overdue: '#a32d2d', invoiced: '#185fa5', pending: '#854f0b',
              }

              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/50">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotBg[c.collection_status] }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className="font-semibold text-sm truncate max-w-xs" style={{ color: '#1a1a18' }}>
                        {listing?.title ?? 'Mali isiyojulikana'}
                      </p>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0" style={{ background: meta.bg, color: meta.color }}>
                        <i className={`ti ti-${meta.icon} mr-0.5`} aria-hidden="true" />{meta.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs" style={{ color: '#999992' }}>
                      {listing?.district && <span>{listing.district}</span>}
                      {landlord?.full_name && <span><i className="ti ti-user mr-0.5" aria-hidden="true" />{landlord.full_name}</span>}
                      {staff?.full_name && <span><i className="ti ti-user-check mr-0.5" aria-hidden="true" />{staff.full_name}</span>}
                      <span>{fmtDate(c.created_at)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm" style={{ color: '#1a1a18' }}>{fmtMoney(c.calculated_amount)}</p>
                    {c.collection_status !== 'collected' && <p className="text-[10px]" style={{ color: '#999992' }}>Inasubiri</p>}
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
        <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e5e0' }}>
          <p className="text-xs font-semibold mb-3" style={{ color: '#999992' }}>Historia ya Sheria za Kamisheni</p>
          <div className="divide-y" style={{ borderColor: '#f4f4f0' }}>
            {rules.slice(0, 6).map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium" style={{ color: '#1a1a18' }}>
                    {r.rule_type === 'flat_fee' ? `Tsh ${r.value.toLocaleString()}` : `${r.value}%`}
                  </span>
                  <span className="text-xs ml-2" style={{ color: '#999992' }}>{RULE_LABELS[r.rule_type]}</span>
                </div>
                <div className="flex items-center gap-2">
                  {r.active && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#eaf3de', color: '#3b6d11' }}>Hai</span>}
                  <span className="text-xs" style={{ color: '#999992' }}>{fmtDate(r.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
