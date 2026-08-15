'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import PricingSettings from '@/components/admin/PricingSettings'
import TakwimuTab from '@/components/admin/TakwimuTab'

// ── Helpers ────────────────────────────────────────────────────────────────
function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7) // 'YYYY-MM'
}

function generateMonthOptions(): { value: string; label: string }[] {
  const opts = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    opts.push({
      value: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString('sw-TZ', { month: 'long', year: 'numeric' }),
    })
  }
  return opts
}

function daysInMonth(yyyyMm: string) {
  const [y, m] = yyyyMm.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

// ── Types ──────────────────────────────────────────────────────────────────
type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'
type TabKey = 'overview' | 'takwimu' | 'mapato' | 'matumizi' | 'miamala' | 'bei' | 'usajiri' | 'mawasiliano' | 'matangazo' | 'org_sub' | 'fundi_sub' | 'ad_campaign' | 'extra_listing'

interface IncomeSummary {
  total:            number
  bySource:         Record<string, number>
  byMethod:         Record<string, number>
  transactionCount: number
  platformFees:     number
  netIncome:        number
  startDate:        string
  endDate:          string
}

interface ExpenseSummary {
  total:          number
  byCategory:     Record<string, number>
  byVendor:       Record<string, number>
  expenseCount:   number
  recurringTotal: number
  oneTimeTotal:   number
}

interface FinancialSummary {
  income:       IncomeSummary
  expenses:     ExpenseSummary
  profit:       number
  profitMargin: number
}

interface ExpenseRecord {
  id:               string
  category:         string
  subcategory?:     string
  description:      string
  vendor?:          string
  amount_tzs:       number
  amount_usd?:      number
  expense_date:     string
  is_recurring:     boolean
  recurring_period?: string
  status:           string
}

interface IncomeRecord {
  id:               string
  source:           string
  description?:     string
  amount_tzs:       number
  payment_method?:  string
  transaction_date: string
  reference_number?: string
}

interface RecurringExpense {
  id:               string
  category:         string
  subcategory?:     string
  description:      string
  vendor?:          string
  amount_tzs:       number
  amount_usd?:      number
  recurring_period: string
  next_due_date:    string
  is_active:        boolean
}

interface SubMetrics {
  mrr: number
  arr: number
  total_revenue: number
  status_counts: Record<string, number>
  plan_distribution: { name: string; count: number; mrr: number }[]
  monthly_revenue: { month: string; revenue: number; count: number }[]
  pending_invoices: number
  upcoming_renewals: { org_id: string; current_period_end: string; org: { name: string } | null; plan: { name: string; price_tzs: number } | null }[]
  churned_last_30d: number
}

interface DalaliSub {
  id: string
  plan: string
  status: string
  expires_at: string | null
  created_at: string
  dalali: { id: string; full_name: string | null; phone: string | null; username: string | null } | null
}

interface Unlock {
  id: string
  amount_paid: number
  payment_method: string | null
  status: string
  created_at: string
  client:  { id: string; full_name: string | null; phone: string | null } | null
  dalali:  { id: string; full_name: string | null; username: string | null } | null
  listing: { id: string; title: string | null; type: string | null; district: string | null } | null
}

interface UnlockSummary { total_revenue: number; total_count: number; today_count: number }

interface Boost {
  id: string
  amount: number
  status: string
  weeks: number
  created_at: string
  boosted_until: string | null
  dalali:  { id: string; full_name: string | null; username: string | null } | null
  listing: { id: string; title: string | null; type: string | null; district: string | null; is_boosted: boolean } | null
}

interface BoostSummary { active_boosts: number; boosted_listings: number; total_revenue: number }

interface SourceMetrics { total: number; net: number; count: number; this_month: number }

// ── Helpers ────────────────────────────────────────────────────────────────
function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function fmtTsh(n: number) {
  if (n >= 1_000_000) return `Tsh ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `Tsh ${(n / 1_000).toFixed(0)}k`
  return `Tsh ${n}`
}

function fmtFull(n: number) {
  return `TZS ${n.toLocaleString('en-TZ', { minimumFractionDigits: 0 })}`
}

function sourceLabel(s: string) {
  const m: Record<string, string> = {
    subscription:   'Subscription',
    contact_unlock: 'Contact Unlock',
    boost_listing:  'Boost Listing',
    extra_listing:  'Extra Listing',
    other:          'Mengine',
  }
  return m[s] || s
}

function catLabel(c: string) {
  const m: Record<string, string> = {
    hosting:   'Hosting',
    api_costs: 'API Costs',
    marketing: 'Masoko',
    legal:     'Kisheria',
    staff:     'Wafanyakazi',
    software:  'Programu',
    banking:   'Benki',
    other:     'Mengine',
  }
  return m[c] || c
}

function catIcon(c: string) {
  const m: Record<string, string> = {
    hosting: 'server', api_costs: 'bolt', marketing: 'speakerphone',
    legal: 'scale', staff: 'user', software: 'device-laptop', banking: 'building-bank', other: 'package',
  }
  return m[c] || 'package'
}

// ── Add Expense Modal ──────────────────────────────────────────────────────
function AddExpenseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    category: 'hosting', subcategory: '', description: '', vendor: '',
    amountTzs: '', amountUsd: '', exchangeRate: '', paymentMethod: 'card',
    expenseDate: new Date().toISOString().split('T')[0],
    isRecurring: false, recurringPeriod: 'monthly',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSave() {
    if (!form.description || !form.amountTzs || !form.expenseDate) {
      setError('Jaza: Aina, Maelezo, Kiasi, na Tarehe')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/v1/accounting/expenses', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category:        form.category,
          subcategory:     form.subcategory || undefined,
          description:     form.description,
          vendor:          form.vendor || undefined,
          amountTzs:       parseFloat(form.amountTzs),
          amountUsd:       form.amountUsd ? parseFloat(form.amountUsd) : undefined,
          exchangeRate:    form.exchangeRate ? parseFloat(form.exchangeRate) : undefined,
          paymentMethod:   form.paymentMethod,
          expenseDate:     form.expenseDate,
          isRecurring:     form.isRecurring,
          recurringPeriod: form.isRecurring ? form.recurringPeriod : undefined,
        }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) { setError(data.error ?? 'Imeshindwa'); return }
      onSaved()
      onClose()
    } catch { setError('Hitilafu ya mtandao') }
    finally { setSaving(false) }
  }

  const categories = [
    'hosting', 'api_costs', 'marketing', 'legal', 'staff', 'software', 'banking', 'other',
  ]

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={onClose}>
      <div className="bg-white w-full rounded-t-3xl px-5 pt-4 pb-8 max-h-[90vh] overflow-y-auto shadow-xl"
           onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4" />
        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-1"><i className="ti ti-plus" aria-hidden="true" />Ongeza Matumizi Mapya</h3>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-3">{error}</div>
        )}

        {/* Category */}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Aina</p>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {categories.map(c => (
            <button key={c}
              onClick={() => setForm(f => ({ ...f, category: c }))}
              className={`p-2 rounded-xl border-2 text-center text-xs transition-all ${
                form.category === c ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-100 text-gray-500'
              }`}
            >
              <div><i className={`ti ti-${catIcon(c)}`} aria-hidden="true" /></div>
              <div className="mt-0.5 truncate">{catLabel(c)}</div>
            </button>
          ))}
        </div>

        {/* Subcategory */}
        <label className="block mb-3">
          <span className="text-xs text-gray-500">Maalum (optional)</span>
          <input value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))}
            placeholder="vercel, anthropic, meta_ads..."
            className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400" />
        </label>

        {/* Description */}
        <label className="block mb-3">
          <span className="text-xs text-gray-500">Maelezo *</span>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Vercel Pro — Juni 2026"
            className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400" />
        </label>

        {/* Vendor */}
        <label className="block mb-3">
          <span className="text-xs text-gray-500">Muuzaji</span>
          <input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
            placeholder="Vercel, Anthropic, Meta..."
            className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400" />
        </label>

        {/* Amounts */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="text-xs text-gray-500">Kiasi (TZS) *</span>
            <input type="number" value={form.amountTzs} onChange={e => setForm(f => ({ ...f, amountTzs: e.target.value }))}
              placeholder="52000"
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400" />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">Kiasi (USD)</span>
            <input type="number" value={form.amountUsd} onChange={e => setForm(f => ({ ...f, amountUsd: e.target.value }))}
              placeholder="20"
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400" />
          </label>
        </div>

        {/* Date + Method */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="block">
            <span className="text-xs text-gray-500">Tarehe *</span>
            <input type="date" value={form.expenseDate} onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400" />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">Njia ya Malipo</span>
            <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400">
              <option value="card">Kadi</option>
              <option value="bank_transfer">Benki</option>
              <option value="mpesa">M-Pesa</option>
              <option value="cash">Taslimu</option>
            </select>
          </label>
        </div>

        {/* Recurring toggle */}
        <button
          onClick={() => setForm(f => ({ ...f, isRecurring: !f.isRecurring }))}
          className={`w-full flex items-center justify-between p-3 rounded-xl border-2 mb-4 transition-all ${
            form.isRecurring ? 'border-primary-300 bg-primary-50' : 'border-gray-100'
          }`}
        >
          <span className="text-sm text-gray-700 flex items-center gap-1"><i className="ti ti-refresh" aria-hidden="true" />Ni matumizi ya mara kwa mara?</span>
          <div className={`w-10 h-5 rounded-full transition-colors ${form.isRecurring ? 'bg-primary-500' : 'bg-gray-200'}`}>
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isRecurring ? 'translate-x-5' : ''}`} />
          </div>
        </button>
        {form.isRecurring && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {['weekly', 'monthly', 'annual'].map(p => (
              <button key={p}
                onClick={() => setForm(f => ({ ...f, recurringPeriod: p }))}
                className={`py-2 rounded-xl border-2 text-xs font-medium transition-all ${
                  form.recurringPeriod === p ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-100 text-gray-500'
                }`}
              >
                {p === 'weekly' ? 'Wiki' : p === 'monthly' ? 'Mwezi' : 'Mwaka'}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 border-2 border-gray-200 rounded-2xl text-sm font-semibold text-gray-600">
            Ghairi
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 bg-primary-500 text-white rounded-2xl text-sm font-semibold disabled:opacity-50">
            {saving ? 'Inahifadhi...' : 'Hifadhi'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function AccountingClient() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [monthOptions,  setMonthOptions]  = useState<{ value: string; label: string }[]>([])
  const [tab,       setTab]       = useState<TabKey>('overview')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [analytics, setAnalytics] = useState<any>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState(false)
  const [summary,   setSummary]   = useState<FinancialSummary | null>(null)
  const [incRecords, setIncRecords] = useState<IncomeRecord[]>([])
  const [expRecords, setExpRecords] = useState<ExpenseRecord[]>([])
  const [recurring,  setRecurring]  = useState<RecurringExpense[]>([])
  const [loading,    setLoading]    = useState(true)
  const [dbMissing,  setDbMissing]  = useState(false)
  const [showAddExp, setShowAddExp] = useState(false)
  const [syncMsg,    setSyncMsg]    = useState('')
  const [toast,      setToast]      = useState('')
  const [downloading, setDownloading] = useState<'pdf' | 'excel' | null>(null)
  const [confirmDeleteExpId, setConfirmDeleteExpId] = useState<string | null>(null)

  // ── Dalali subscriptions tab state ──────────────────────────────────────
  const [subMetrics,   setSubMetrics]   = useState<SubMetrics | null>(null)
  const [dalaliSubs,   setDalaliSubs]   = useState<DalaliSub[]>([])
  const [subSearch,    setSubSearch]    = useState('')
  const [subLoading,   setSubLoading]   = useState(false)

  // ── Contact unlocks tab state ────────────────────────────────────────────
  const [unlocks,       setUnlocks]       = useState<Unlock[]>([])
  const [unlockSummary, setUnlockSummary] = useState<UnlockSummary | null>(null)
  const [unlockSearch,  setUnlockSearch]  = useState('')
  const [unlockLoading, setUnlockLoading] = useState(false)

  // ── Boosts tab state ─────────────────────────────────────────────────────
  const [boosts,       setBoosts]       = useState<Boost[]>([])
  const [boostSummary, setBoostSummary] = useState<BoostSummary | null>(null)
  const [boostSearch,  setBoostSearch]  = useState('')
  const [boostLoading, setBoostLoading] = useState(false)

  // ── Source-based income tabs ─────────────────────────────────────────────
  const [sourceSummary,     setSourceSummary]     = useState<Record<string, SourceMetrics> | null>(null)
  const [orgSubRecords,     setOrgSubRecords]     = useState<IncomeRecord[] | null>(null)
  const [fundiSubRecords,   setFundiSubRecords]   = useState<IncomeRecord[] | null>(null)
  const [adCampaignRecords, setAdCampaignRecords] = useState<IncomeRecord[] | null>(null)
  const [extraListRecords,  setExtraListRecords]  = useState<IncomeRecord[] | null>(null)
  const [orgSubSearch,      setOrgSubSearch]      = useState('')
  const [fundiSubSearch,    setFundiSubSearch]    = useState('')
  const [adCampaignSearch,  setAdCampaignSearch]  = useState('')
  const [extraListSearch,   setExtraListSearch]   = useState('')
  const [srcLoadingTab,     setSrcLoadingTab]     = useState<string | null>(null)

  // keep period/date for legacy API compatibility
  const period = 'monthly' as Period
  const date   = `${selectedMonth}-01`

  useEffect(() => { setMonthOptions(generateMonthOptions()) }, [])

  useEffect(() => {
    if (tab !== 'takwimu' || analytics || analyticsError) return
    setAnalyticsLoading(true)
    fetch('/api/v1/admin/analytics')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { setAnalytics(d) })
      .catch(() => setAnalyticsError(true))
      .finally(() => setAnalyticsLoading(false))
  }, [tab, analytics, analyticsError])

  // Lazy-load each revenue sub-tab on first visit
  useEffect(() => {
    if (tab !== 'usajiri' || subMetrics) return
    setSubLoading(true)
    Promise.all([
      fetch('/api/v1/admin/subscription-metrics').then(r => r.ok ? r.json() : null),
      fetch('/api/v1/admin/dalali/subscriptions?limit=100').then(r => r.ok ? r.json() : null),
    ]).then(([metrics, subs]) => {
      if (metrics) setSubMetrics(metrics as SubMetrics)
      if (subs)    setDalaliSubs((subs as { subscriptions: DalaliSub[] }).subscriptions ?? [])
    }).catch(() => {}).finally(() => setSubLoading(false))
  }, [tab, subMetrics])

  useEffect(() => {
    if (tab !== 'mawasiliano' || unlocks.length > 0) return
    setUnlockLoading(true)
    fetch('/api/v1/admin/unlocks?limit=100')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        setUnlocks((d as { unlocks: Unlock[] }).unlocks ?? [])
        setUnlockSummary((d as { summary: UnlockSummary }).summary)
      }).catch(() => {}).finally(() => setUnlockLoading(false))
  }, [tab, unlocks.length])

  useEffect(() => {
    if (tab !== 'matangazo' || boosts.length > 0) return
    setBoostLoading(true)
    fetch('/api/v1/admin/boosts?limit=100')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        setBoosts((d as { boosts: Boost[] }).boosts ?? [])
        setBoostSummary((d as { summary: BoostSummary }).summary)
      }).catch(() => {}).finally(() => setBoostLoading(false))
  }, [tab, boosts.length])

  // Load source summary once on first visit to any source tab
  useEffect(() => {
    const srcTabs: TabKey[] = ['org_sub', 'fundi_sub', 'ad_campaign', 'extra_listing']
    if (!srcTabs.includes(tab) || sourceSummary) return
    fetch('/api/v1/accounting/source-summary')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSourceSummary((d as { summary: Record<string, SourceMetrics> }).summary) })
      .catch(() => {})
  }, [tab, sourceSummary])

  // Load per-source records lazily
  useEffect(() => {
    if (tab !== 'org_sub' || orgSubRecords !== null) return
    setSrcLoadingTab('org_sub')
    fetch('/api/v1/accounting/income?source=org_subscription&period=all&limit=200')
      .then(r => r.ok ? r.json() : null)
      .then(d => setOrgSubRecords(d ? (d as { records: IncomeRecord[] }).records : []))
      .catch(() => setOrgSubRecords([]))
      .finally(() => setSrcLoadingTab(null))
  }, [tab, orgSubRecords])

  useEffect(() => {
    if (tab !== 'fundi_sub' || fundiSubRecords !== null) return
    setSrcLoadingTab('fundi_sub')
    fetch('/api/v1/accounting/income?source=fundi_subscription&period=all&limit=200')
      .then(r => r.ok ? r.json() : null)
      .then(d => setFundiSubRecords(d ? (d as { records: IncomeRecord[] }).records : []))
      .catch(() => setFundiSubRecords([]))
      .finally(() => setSrcLoadingTab(null))
  }, [tab, fundiSubRecords])

  useEffect(() => {
    if (tab !== 'ad_campaign' || adCampaignRecords !== null) return
    setSrcLoadingTab('ad_campaign')
    fetch('/api/v1/accounting/income?source=ad_campaign&period=all&limit=200')
      .then(r => r.ok ? r.json() : null)
      .then(d => setAdCampaignRecords(d ? (d as { records: IncomeRecord[] }).records : []))
      .catch(() => setAdCampaignRecords([]))
      .finally(() => setSrcLoadingTab(null))
  }, [tab, adCampaignRecords])

  useEffect(() => {
    if (tab !== 'extra_listing' || extraListRecords !== null) return
    setSrcLoadingTab('extra_listing')
    fetch('/api/v1/accounting/income?source=extra_listing&period=all&limit=200')
      .then(r => r.ok ? r.json() : null)
      .then(d => setExtraListRecords(d ? (d as { records: IncomeRecord[] }).records : []))
      .catch(() => setExtraListRecords([]))
      .finally(() => setSrcLoadingTab(null))
  }, [tab, extraListRecords])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setDbMissing(false)
    try {
      const params = new URLSearchParams({ period, date })
      const [sumRes, incRes, expRes, recRes] = await Promise.all([
        fetch(`/api/v1/accounting/summary?${params}`),
        fetch(`/api/v1/accounting/income?${params}&limit=100`),
        fetch(`/api/v1/accounting/expenses?${params}&limit=100`),
        fetch('/api/v1/accounting/recurring'),
      ])

      if (sumRes.ok) {
        setSummary(await sumRes.json() as FinancialSummary)
      } else {
        const errData = await sumRes.json().catch(() => ({})) as { error?: string }
        if (sumRes.status === 500 && errData.error?.includes('does not exist')) {
          setDbMissing(true)
        }
      }
      if (incRes.ok) {
        const d = await incRes.json() as { records: IncomeRecord[] }
        setIncRecords(d.records)
      }
      if (expRes.ok) {
        const d = await expRes.json() as { records: ExpenseRecord[] }
        setExpRecords(d.records)
      }
      if (recRes.ok) {
        const d = await recRes.json() as { records: RecurringExpense[] }
        setRecurring(d.records)
      }
    } catch { showToast('Imeshindwa kupakia data') }
    finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth])

  useEffect(() => { loadData() }, [loadData])

  async function handleSync() {
    setSyncMsg('Inasync...')
    try {
      const res  = await fetch('/api/v1/accounting/income/sync', { method: 'POST' })
      const data = await res.json() as { synced?: number; skipped?: number; error?: string }
      if (!res.ok) { setSyncMsg(''); showToast(data.error ?? 'Imeshindwa'); return }
      setSyncMsg(`Synced: ${data.synced}, Zilizopo: ${data.skipped}`)
      await loadData()
      setTimeout(() => setSyncMsg(''), 4000)
    } catch { setSyncMsg(''); showToast('Hitilafu ya mtandao') }
  }

  async function handleDownload(format: 'pdf' | 'excel') {
    setDownloading(format)
    try {
      const params = new URLSearchParams({ format, period, date })
      const res    = await fetch(`/api/v1/accounting/reports?${params}`)
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        showToast(d.error ?? 'Imeshindwa kupakua')
        return
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = format === 'pdf' ? `nyumbafasta_ripoti_${selectedMonth}.pdf` : `nyumbafasta_hesabu_${selectedMonth}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch { showToast('Imeshindwa kupakua ripoti') }
    finally { setDownloading(null) }
  }

  async function toggleRecurring(id: string, isActive: boolean) {
    await fetch(`/api/v1/accounting/recurring/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ is_active: !isActive }),
    })
    setRecurring(r => r.map(e => e.id === id ? { ...e, is_active: !isActive } : e))
  }

  async function deleteExpenseRecord(id: string) {
    await fetch(`/api/v1/accounting/expenses/${id}`, { method: 'DELETE' })
    setExpRecords(r => r.filter(e => e.id !== id))
    showToast('Matumizi yamefutwa')
  }

  const income   = summary?.income
  const expenses = summary?.expenses
  const profit   = summary?.profit ?? 0

  // Bar chart: top 5 income sources
  const maxIncSrc = Math.max(...Object.values(income?.bySource ?? {}), 1)
  // Bar chart: top expense categories
  const maxExpCat = Math.max(...Object.values(expenses?.byCategory ?? {}), 1)

  const recurringTotal = recurring.filter(r => r.is_active).reduce((s, r) => s + Number(r.amount_tzs), 0)

  if (dbMissing) {
    return (
      <div className="h-full bg-gray-50 overflow-y-auto pb-20">
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <Link href="/admin" className="p-2 rounded-full hover:bg-gray-100">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-base font-bold text-gray-900 flex items-center gap-2"><i className="ti ti-coins" aria-hidden="true" />Hesabu za NyumbaFasta</h1>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="font-bold text-amber-800 mb-1 flex items-center gap-1"><i className="ti ti-alert-triangle" aria-hidden="true" />Database haijaundwa bado</p>
            <p className="text-sm text-amber-700 mb-3">
              Jedwali la hesabu halijafanyiwa migration katika Supabase. Fanya hatua hizi:
            </p>
            <ol className="text-sm text-amber-800 space-y-2 list-decimal list-inside">
              <li>Nenda <strong>Supabase Dashboard → SQL Editor</strong></li>
              <li>Copy SQL ifuatayo na paste, kisha Run</li>
              <li>Rudi ukurasa huu, bonyeza <strong>Sync Mapato</strong></li>
            </ol>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 overflow-x-auto">
            <p className="text-xs text-gray-400 mb-2 font-mono">-- Paste hii katika Supabase SQL Editor:</p>
            <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap leading-relaxed">{`-- Run this in Supabase SQL Editor
-- nyumba.co/admin → Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS income_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  source_ref_id UUID NOT NULL,
  payment_id UUID,
  dalali_id UUID REFERENCES users(id) ON DELETE SET NULL,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  amount_tzs DECIMAL(15,2) NOT NULL,
  platform_fee_tzs DECIMAL(15,2) DEFAULT 0,
  net_amount_tzs DECIMAL(15,2) NOT NULL,
  description TEXT,
  reference_number TEXT,
  payment_method TEXT,
  transaction_date DATE NOT NULL,
  month INTEGER, year INTEGER, week INTEGER,
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, source_ref_id)
);

CREATE TABLE IF NOT EXISTS expense_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  subcategory TEXT,
  amount_tzs DECIMAL(15,2) NOT NULL,
  amount_usd DECIMAL(10,2),
  exchange_rate DECIMAL(10,2),
  description TEXT NOT NULL,
  vendor TEXT, receipt_url TEXT,
  reference_number TEXT, payment_method TEXT,
  expense_date DATE NOT NULL,
  month INTEGER, year INTEGER, week INTEGER,
  is_recurring BOOLEAN DEFAULT false,
  recurring_period TEXT,
  status TEXT DEFAULT 'paid',
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  period TEXT NOT NULL, period_date DATE NOT NULL,
  total_income_tzs DECIMAL(15,2) DEFAULT 0,
  subscription_income DECIMAL(15,2) DEFAULT 0,
  contact_unlock_income DECIMAL(15,2) DEFAULT 0,
  boost_listing_income DECIMAL(15,2) DEFAULT 0,
  extra_listing_income DECIMAL(15,2) DEFAULT 0,
  other_income DECIMAL(15,2) DEFAULT 0,
  total_expenses_tzs DECIMAL(15,2) DEFAULT 0,
  hosting_expenses DECIMAL(15,2) DEFAULT 0,
  api_expenses DECIMAL(15,2) DEFAULT 0,
  marketing_expenses DECIMAL(15,2) DEFAULT 0,
  legal_expenses DECIMAL(15,2) DEFAULT 0,
  staff_expenses DECIMAL(15,2) DEFAULT 0,
  other_expenses DECIMAL(15,2) DEFAULT 0,
  gross_profit_tzs DECIMAL(15,2) DEFAULT 0,
  net_profit_tzs DECIMAL(15,2) DEFAULT 0,
  profit_margin DECIMAL(5,2) DEFAULT 0,
  azampay_fees_tzs DECIMAL(15,2) DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  new_subscriptions INTEGER DEFAULT 0,
  renewed_subscriptions INTEGER DEFAULT 0,
  contact_unlocks_count INTEGER DEFAULT 0,
  active_dalali_count INTEGER DEFAULT 0,
  income_growth_percent DECIMAL(5,2),
  expense_growth_percent DECIMAL(5,2),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period, period_date)
);

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL, subcategory TEXT,
  description TEXT NOT NULL, vendor TEXT,
  amount_tzs DECIMAL(15,2) NOT NULL DEFAULT 0,
  amount_usd DECIMAL(10,2), payment_method TEXT,
  recurring_period TEXT DEFAULT 'monthly',
  next_due_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ir_source ON income_records(source);
CREATE INDEX IF NOT EXISTS idx_ir_date ON income_records(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_ir_month_year ON income_records(year, month);
CREATE INDEX IF NOT EXISTS idx_er_category ON expense_records(category);
CREATE INDEX IF NOT EXISTS idx_er_date ON expense_records(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_er_month_year ON expense_records(year, month);

ALTER TABLE income_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE expense_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE financial_summaries DISABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_expenses DISABLE ROW LEVEL SECURITY;

INSERT INTO recurring_expenses
  (category, subcategory, description, vendor,
   amount_tzs, amount_usd, recurring_period, next_due_date)
VALUES
  ('hosting','vercel','Vercel Pro Hosting','Vercel',52000,20,'monthly',
    DATE_TRUNC('month',NOW()+INTERVAL '1 month')::DATE),
  ('hosting','supabase','Supabase Database','Supabase',26000,10,'monthly',
    DATE_TRUNC('month',NOW()+INTERVAL '1 month')::DATE),
  ('api_costs','anthropic','Anthropic Claude API','Anthropic',52000,20,'monthly',
    DATE_TRUNC('month',NOW()+INTERVAL '1 month')::DATE),
  ('api_costs','whatsapp_api','WhatsApp Business API','Meta',0,0,'monthly',
    DATE_TRUNC('month',NOW()+INTERVAL '1 month')::DATE),
  ('software','resend','Resend Email Service','Resend',0,0,'monthly',
    DATE_TRUNC('month',NOW()+INTERVAL '1 month')::DATE)
ON CONFLICT DO NOTHING;`}</pre>
          </div>
          <button
            onClick={loadData}
            className="w-full py-3 bg-primary-500 text-white rounded-2xl font-semibold text-sm"
          >
            <i className="ti ti-refresh" aria-hidden="true" /> Jaribu Tena (Baada ya Kurun SQL)
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* ── Toast ── */}
      {toast && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-2xl shadow-xl text-center">
          {toast}
        </div>
      )}

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <i className="ti ti-coins text-primary-500" aria-hidden="true" />
                <span className="font-bold text-gray-900 text-sm">Hesabu</span>
              </div>
              <button onClick={() => setMobileNavOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>
            {/* Month selector in drawer */}
            <div className="p-4 border-b border-gray-100 flex-shrink-0">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Mwezi</p>
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-primary-400 font-medium text-gray-700 bg-white">
                {monthOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}{opt.value === getCurrentMonth() ? ' ★' : ''}</option>)}
              </select>
            </div>
            {/* KPI Summary in drawer */}
            <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400" />Mapato</span>
                <span className="text-sm font-bold text-green-600">{fmtTsh(income?.total ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" />Matumizi</span>
                <span className="text-sm font-bold text-red-500">{fmtTsh(expenses?.total ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
                <span className="text-xs text-gray-500 flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${profit >= 0 ? 'bg-blue-400' : 'bg-orange-400'}`} />{profit >= 0 ? 'Faida' : 'Hasara'}</span>
                <span className={`text-sm font-bold ${profit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{profit >= 0 ? '+' : '-'}{fmtTsh(Math.abs(profit))}</span>
              </div>
            </div>
            {/* Drawer tabs nav */}
            <nav className="flex-1 overflow-y-auto py-2">
              <p className="px-4 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Msingi</p>
              {([
                { key: 'overview',  label: 'Muhtasari', icon: 'chart-bar' },
                { key: 'takwimu',   label: 'Takwimu',   icon: 'chart-dots' },
                { key: 'mapato',    label: 'Mapato',    icon: 'trending-up' },
                { key: 'matumizi',  label: 'Matumizi',  icon: 'trending-down' },
                { key: 'miamala',   label: 'Miamala',   icon: 'clipboard-list' },
              ] as { key: TabKey; label: string; icon: string }[]).map(t => (
                <button key={t.key} onClick={() => { setTab(t.key); setMobileNavOpen(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${tab === t.key ? 'bg-primary-50 text-primary-600 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}>
                  <i className={`ti ti-${t.icon} text-base flex-shrink-0`} aria-hidden="true" />{t.label}
                  {tab === t.key && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500" />}
                </button>
              ))}
              <p className="px-4 pt-4 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Mapato</p>
              {([
                { key: 'usajiri',       label: 'Usajiri',      icon: 'id-badge' },
                { key: 'mawasiliano',   label: 'Mawasiliano',  icon: 'lock-open' },
                { key: 'matangazo',     label: 'Matangazo',    icon: 'rocket' },
                { key: 'org_sub',       label: 'Org Sub',      icon: 'building' },
                { key: 'fundi_sub',     label: 'Fundi Sub',    icon: 'tool' },
                { key: 'ad_campaign',   label: 'Ad Campaign',  icon: 'speakerphone' },
                { key: 'extra_listing', label: 'Orodha Ziada', icon: 'list-plus' },
              ] as { key: TabKey; label: string; icon: string }[]).map(t => (
                <button key={t.key} onClick={() => { setTab(t.key); setMobileNavOpen(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${tab === t.key ? 'bg-primary-50 text-primary-600 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}>
                  <i className={`ti ti-${t.icon} text-base flex-shrink-0`} aria-hidden="true" />{t.label}
                  {tab === t.key && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500" />}
                </button>
              ))}
              <p className="px-4 pt-4 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Mipangilio</p>
              <button onClick={() => { setTab('bei'); setMobileNavOpen(false) }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${tab === 'bei' ? 'bg-primary-50 text-primary-600 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}>
                <i className="ti ti-tag text-base flex-shrink-0" aria-hidden="true" />Bei
                {tab === 'bei' && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500" />}
              </button>
            </nav>
            <div className="p-4 border-t border-gray-100 flex-shrink-0 space-y-2">
              <button onClick={() => handleDownload('pdf')} disabled={!!downloading}
                className="w-full flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-medium disabled:opacity-50">
                <i className="ti ti-download" aria-hidden="true" />Pakua PDF
              </button>
              <button onClick={() => handleDownload('excel')} disabled={!!downloading}
                className="w-full flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-medium disabled:opacity-50">
                <i className="ti ti-table" aria-hidden="true" />Pakua Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0 z-20">
        <Link href="/admin" className="p-2 rounded-xl hover:bg-gray-100 flex-shrink-0" aria-label="Rudi Admin">
          <i className="ti ti-arrow-left text-gray-600 text-lg" aria-hidden="true" />
        </Link>
        {/* Mobile: hamburger to open sidebar drawer */}
        <button onClick={() => setMobileNavOpen(true)}
          className="lg:hidden p-2 rounded-xl bg-gray-100 flex-shrink-0"
          aria-label="Fungua menyu">
          <i className="ti ti-layout-sidebar text-gray-600" aria-hidden="true" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-900 flex items-center gap-2 truncate">
            <i className="ti ti-coins text-primary-500 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">Hesabu za NyumbaFasta</span>
          </h1>
          <p className="text-xs text-gray-400">Mapato, Matumizi, Faida</p>
        </div>
        <button onClick={() => setShowAddExp(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-500 text-white rounded-xl text-xs font-semibold">
          <i className="ti ti-plus" aria-hidden="true" /><span>Gharama</span>
        </button>
      </div>

      {/* ── Body: Sidebar + Content ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left Sidebar (desktop only) ── */}
        <div className="hidden lg:flex flex-col w-64 xl:w-72 bg-white border-r border-gray-100 flex-shrink-0 overflow-hidden">
          <div className="flex flex-col h-full overflow-hidden">

          {/* Month selector */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-1.5 mb-2">
              <i className="ti ti-calendar text-gray-400 text-sm" aria-hidden="true" />
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Mwezi</span>
            </div>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-primary-400 font-medium text-gray-700 bg-white"
            >
              {monthOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}{opt.value === getCurrentMonth() ? ' ★' : ''}
                </option>
              ))}
            </select>
            {(() => {
              const isCurrentMonth = selectedMonth === getCurrentMonth()
              const currentLabel   = monthOptions.find(m => m.value === selectedMonth)?.label ?? selectedMonth
              const today          = new Date().getDate()
              const totalDays      = daysInMonth(selectedMonth)
              return (
                <div className={`mt-2 px-3 py-1.5 rounded-lg flex items-center justify-between text-xs ${
                  isCurrentMonth ? 'bg-green-600 text-white' : 'bg-gray-700 text-white'
                }`}>
                  <span className="font-semibold truncate">{currentLabel}</span>
                  {isCurrentMonth
                    ? <span className="opacity-80 ml-2 flex-shrink-0">Siku {today}/{totalDays}</span>
                    : <span className="opacity-80 ml-2 flex-shrink-0">Imekamilika</span>
                  }
                </div>
              )
            })()}
          </div>

          {/* KPI Summary */}
          <div className="p-4 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Muhtasari wa Mwezi</p>
            {loading ? (
              <div className="space-y-2.5 animate-pulse">
                {[1,2,3].map(i => <div key={i} className="h-5 bg-gray-100 rounded" />)}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />Mapato
                  </span>
                  <span className="text-sm font-bold text-green-600">{fmtTsh(income?.total ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />Matumizi
                  </span>
                  <span className="text-sm font-bold text-red-500">{fmtTsh(expenses?.total ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-100">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${profit >= 0 ? 'bg-blue-400' : 'bg-orange-400'}`} />
                    {profit >= 0 ? 'Faida' : 'Hasara'}
                  </span>
                  <span className={`text-sm font-bold ${profit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {profit >= 0 ? '+' : '-'}{fmtTsh(Math.abs(profit))}
                  </span>
                </div>
                {(summary?.profitMargin ?? 0) !== 0 && (
                  <p className="text-[10px] text-gray-400 text-right">{summary?.profitMargin}% margin</p>
                )}
                {(income?.platformFees ?? 0) > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 mt-2">
                    <p className="text-[10px] text-amber-700 flex items-center gap-1">
                      <i className="ti ti-credit-card text-amber-500 flex-shrink-0" aria-hidden="true" />
                      AzamPay 1%: <strong>{fmtTsh(income?.platformFees ?? 0)}</strong>
                    </p>
                    <p className="text-[10px] text-amber-600 mt-0.5">Halisi: {fmtTsh(income?.netIncome ?? 0)}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="p-4 border-b border-gray-100 space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Vitendo</p>
            <button onClick={() => handleDownload('pdf')} disabled={!!downloading}
              className="w-full flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-medium disabled:opacity-50 hover:bg-red-100 transition-colors">
              {downloading === 'pdf'
                ? <span className="w-3 h-3 border-2 border-red-300 border-t-red-600 rounded-full animate-spin flex-shrink-0" />
                : <i className="ti ti-download flex-shrink-0" aria-hidden="true" />
              }
              <span>Pakua PDF</span>
            </button>
            <button onClick={() => handleDownload('excel')} disabled={!!downloading}
              className="w-full flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-medium disabled:opacity-50 hover:bg-emerald-100 transition-colors">
              {downloading === 'excel'
                ? <span className="w-3 h-3 border-2 border-emerald-300 border-t-emerald-700 rounded-full animate-spin flex-shrink-0" />
                : <i className="ti ti-table flex-shrink-0" aria-hidden="true" />
              }
              <span>Pakua Excel</span>
            </button>
            <button onClick={handleSync}
              className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-medium hover:bg-blue-100 transition-colors">
              <i className="ti ti-refresh flex-shrink-0" aria-hidden="true" />
              <span>Sync Mapato</span>
            </button>
            {syncMsg && <p className="text-[11px] text-gray-500 text-center">{syncMsg}</p>}
          </div>

          {/* Vertical Tab Navigation */}
          <nav className="flex-1 overflow-y-auto py-2">
            <p className="px-4 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Msingi</p>
            {([
              { key: 'overview',  label: 'Muhtasari', icon: 'chart-bar' },
              { key: 'takwimu',   label: 'Takwimu',   icon: 'chart-dots' },
              { key: 'mapato',    label: 'Mapato',    icon: 'trending-up' },
              { key: 'matumizi',  label: 'Matumizi',  icon: 'trending-down' },
              { key: 'miamala',   label: 'Miamala',   icon: 'clipboard-list' },
            ] as { key: TabKey; label: string; icon: string }[]).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-r-2 ${
                  tab === t.key
                    ? 'bg-primary-50 text-primary-600 border-primary-500 font-medium'
                    : 'text-gray-500 hover:bg-gray-50 border-transparent hover:text-gray-700'
                }`}>
                <i className={`ti ti-${t.icon} text-base flex-shrink-0`} aria-hidden="true" />
                <span>{t.label}</span>
              </button>
            ))}
            <p className="px-4 pt-4 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Mapato</p>
            {([
              { key: 'usajiri',       label: 'Usajiri',      icon: 'id-badge' },
              { key: 'mawasiliano',   label: 'Mawasiliano',  icon: 'lock-open' },
              { key: 'matangazo',     label: 'Matangazo',    icon: 'rocket' },
              { key: 'org_sub',       label: 'Org Sub',      icon: 'building' },
              { key: 'fundi_sub',     label: 'Fundi Sub',    icon: 'tool' },
              { key: 'ad_campaign',   label: 'Ad Campaign',  icon: 'speakerphone' },
              { key: 'extra_listing', label: 'Orodha Ziada', icon: 'list-plus' },
            ] as { key: TabKey; label: string; icon: string }[]).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-r-2 ${
                  tab === t.key
                    ? 'bg-primary-50 text-primary-600 border-primary-500 font-medium'
                    : 'text-gray-500 hover:bg-gray-50 border-transparent hover:text-gray-700'
                }`}>
                <i className={`ti ti-${t.icon} text-base flex-shrink-0`} aria-hidden="true" />
                <span>{t.label}</span>
              </button>
            ))}
            <p className="px-4 pt-4 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Mipangilio</p>
            <button onClick={() => setTab('bei')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-r-2 ${
                tab === 'bei'
                  ? 'bg-primary-50 text-primary-600 border-primary-500 font-medium'
                  : 'text-gray-500 hover:bg-gray-50 border-transparent hover:text-gray-700'
              }`}>
              <i className="ti ti-tag text-base flex-shrink-0" aria-hidden="true" />
              <span>Bei</span>
            </button>
          </nav>
          </div>{/* end inner flex-col */}
        </div>

        {/* ── Right Panel ── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

          <div className="lg:hidden bg-white border-b border-gray-100 flex overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
            {([
              { key: 'overview',      label: 'Muhtasari',   icon: 'chart-bar' },
              { key: 'takwimu',       label: 'Takwimu',     icon: 'chart-dots' },
              { key: 'mapato',        label: 'Mapato',      icon: 'trending-up' },
              { key: 'matumizi',      label: 'Matumizi',    icon: 'trending-down' },
              { key: 'miamala',       label: 'Miamala',     icon: 'clipboard-list' },
              { key: 'usajiri',       label: 'Usajiri',     icon: 'id-badge' },
              { key: 'mawasiliano',   label: 'Mawasiliano', icon: 'lock-open' },
              { key: 'matangazo',     label: 'Matangazo',   icon: 'rocket' },
              { key: 'org_sub',       label: 'Org Sub',     icon: 'building' },
              { key: 'fundi_sub',     label: 'Fundi Sub',   icon: 'tool' },
              { key: 'ad_campaign',   label: 'Ad Campaign', icon: 'speakerphone' },
              { key: 'extra_listing', label: 'Orodha Ziada',icon: 'list-plus' },
              { key: 'bei',           label: 'Bei',         icon: 'tag' },
            ] as { key: TabKey; label: string; icon: string }[]).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                  tab === t.key ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-400'
                }`}
              >
                <i className={`ti ti-${t.icon}`} aria-hidden="true" /><span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Mobile: month selector + controls */}
          <div className="lg:hidden bg-white border-b border-gray-100 px-4 py-2 space-y-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 flex-shrink-0 flex items-center gap-1"><i className="ti ti-calendar" aria-hidden="true" />Mwezi:</span>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-primary-400 font-medium text-gray-700 bg-white"
              >
                {monthOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}{opt.value === getCurrentMonth() ? ' (Sasa)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => handleDownload('pdf')} disabled={!!downloading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-xs font-medium disabled:opacity-50">
                {downloading === 'pdf'
                  ? <span className="w-3 h-3 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                  : <i className="ti ti-download" aria-hidden="true" />
                } PDF
              </button>
              <button onClick={() => handleDownload('excel')} disabled={!!downloading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-xl text-xs font-medium disabled:opacity-50">
                {downloading === 'excel'
                  ? <span className="w-3 h-3 border-2 border-green-300 border-t-green-700 rounded-full animate-spin" />
                  : <i className="ti ti-download" aria-hidden="true" />
                } Excel
              </button>
              <button onClick={handleSync}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-medium">
                <i className="ti ti-refresh" aria-hidden="true" /> Sync
              </button>
              {syncMsg && <span className="text-xs text-gray-500">{syncMsg}</span>}
            </div>
            {(() => {
              const isCurrentMonth = selectedMonth === getCurrentMonth()
              const currentLabel   = monthOptions.find(m => m.value === selectedMonth)?.label ?? selectedMonth
              const today          = new Date().getDate()
              const totalDays      = daysInMonth(selectedMonth)
              return (
                <div className={`px-3 py-1.5 rounded-lg flex items-center justify-between text-xs ${
                  isCurrentMonth ? 'bg-green-600 text-white' : 'bg-gray-700 text-white'
                }`}>
                  <span className="font-semibold">{currentLabel}</span>
                  {isCurrentMonth
                    ? <span className="opacity-80">Siku ya {today} / {totalDays} — inaendelea</span>
                    : <span className="opacity-80">Imekamilika</span>
                  }
                </div>
              )
            })()}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto pb-20">
            <div className="px-4 py-4 space-y-4">

        {/* ── Loading ── */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[1,2,3].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-3 animate-pulse">
                  <div className="h-2 bg-gray-100 rounded w-12 mx-auto mb-2" />
                  <div className="h-5 bg-gray-200 rounded w-16 mx-auto mb-1" />
                  <div className="h-2 bg-gray-100 rounded w-10 mx-auto" />
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 animate-pulse">
              {[1,2,3,4].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 bg-gray-200 rounded w-3/4" />
                    <div className="h-2 bg-gray-100 rounded w-1/2" />
                  </div>
                  <div className="h-4 bg-gray-200 rounded w-16" />
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && (
          <>
            {/* ══ TAB: OVERVIEW ══════════════════════════════════════════ */}
            {tab === 'overview' && (
              <>
                {/* KPI cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
                    <p className="text-xs text-gray-400 mb-1">Mapato</p>
                    <p className="text-base font-bold text-green-600">{fmtTsh(income?.total ?? 0)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{income?.transactionCount ?? 0} malipo</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
                    <p className="text-xs text-gray-400 mb-1">Matumizi</p>
                    <p className="text-base font-bold text-red-500">{fmtTsh(expenses?.total ?? 0)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{expenses?.expenseCount ?? 0} malipo</p>
                  </div>
                  <div className={`rounded-2xl border p-3 shadow-sm text-center ${profit >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                    <p className="text-xs text-gray-400 mb-1">{profit >= 0 ? 'Faida' : 'Hasara'}</p>
                    <p className={`text-base font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {profit >= 0 ? '+' : '-'}{fmtTsh(Math.abs(profit))}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{summary?.profitMargin ?? 0}%</p>
                  </div>
                </div>

                {/* Platform fees note */}
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 flex items-center gap-2">
                  <i className="ti ti-credit-card text-sm text-amber-600" aria-hidden="true" />
                  <p className="text-xs text-amber-700">
                    Ada ya AzamPay (1%): <strong>{fmtFull(income?.platformFees ?? 0)}</strong>
                    &nbsp;·&nbsp; Mapato halisi: <strong>{fmtFull(income?.netIncome ?? 0)}</strong>
                  </p>
                </div>

                {/* Income by source bar chart */}
                {Object.keys(income?.bySource ?? {}).length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1"><i className="ti ti-trending-up" aria-hidden="true" />Mapato kwa Chanzo</h3>
                    <div className="space-y-2.5">
                      {Object.entries(income?.bySource ?? {})
                        .sort(([, a], [, b]) => b - a)
                        .map(([src, amt]) => {
                          const pct = Math.round((amt / maxIncSrc) * 100)
                          const sharePct = income?.total ? ((amt / income.total) * 100).toFixed(1) : '0'
                          return (
                            <div key={src}>
                              <div className="flex justify-between text-xs text-gray-500 mb-1">
                                <span>{sourceLabel(src)}</span>
                                <span>{fmtFull(amt)} ({sharePct}%)</span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-green-400 rounded-full transition-all"
                                  style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}

                {/* Expenses by category */}
                {Object.keys(expenses?.byCategory ?? {}).length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1"><i className="ti ti-trending-down" aria-hidden="true" />Matumizi kwa Aina</h3>
                    <div className="space-y-2.5">
                      {Object.entries(expenses?.byCategory ?? {})
                        .sort(([, a], [, b]) => b - a)
                        .map(([cat, amt]) => {
                          const pct = Math.round((amt / maxExpCat) * 100)
                          const sharePct = expenses?.total ? ((amt / expenses.total) * 100).toFixed(1) : '0'
                          return (
                            <div key={cat}>
                              <div className="flex justify-between text-xs text-gray-500 mb-1">
                                <span><i className={`ti ti-${catIcon(cat)}`} aria-hidden="true" /> {catLabel(cat)}</span>
                                <span>{fmtFull(amt)} ({sharePct}%)</span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-red-400 rounded-full transition-all"
                                  style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}

                {/* Payment methods */}
                {Object.keys(income?.byMethod ?? {}).length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1"><i className="ti ti-credit-card" aria-hidden="true" />Njia za Malipo</h3>
                    <div className="space-y-2">
                      {Object.entries(income?.byMethod ?? {})
                        .sort(([, a], [, b]) => b - a)
                        .map(([method, amt]) => (
                          <div key={method} className="flex justify-between text-sm">
                            <span className="text-gray-600">{method.toUpperCase()}</span>
                            <span className="font-semibold text-gray-800">{fmtFull(amt)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {income?.total === 0 && expenses?.total === 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
                    <p className="text-2xl mb-2 flex justify-center"><i className="ti ti-coins text-gray-400" aria-hidden="true" /></p>
                    <p className="text-sm font-medium text-gray-600">Hakuna data kipindi hiki</p>
                    <p className="text-xs text-gray-400 mt-1">Sync mapato au ongeza matumizi</p>
                    <button onClick={handleSync}
                      className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-xl text-xs font-semibold">
                      <i className="ti ti-refresh" aria-hidden="true" /> Sync Mapato Sasa
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ══ TAB: MAPATO ════════════════════════════════════════════ */}
            {tab === 'mapato' && (
              <>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-800">Mapato ya Hivi Karibuni</h3>
                    <span className="text-xs text-gray-400">{incRecords.length} rekodi</span>
                  </div>
                  {incRecords.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm text-gray-400">Hakuna mapato — fanya sync kwanza</p>
                      <button onClick={handleSync} className="mt-3 text-xs text-primary-500 font-semibold">
                        <i className="ti ti-refresh" aria-hidden="true" /> Sync sasa
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {incRecords.map(r => (
                        <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-sm flex-shrink-0">
                            {r.source === 'subscription' ? <i className="ti ti-package" aria-hidden="true" /> : r.source === 'contact_unlock' ? <i className="ti ti-lock-open" aria-hidden="true" /> : <i className="ti ti-rocket" aria-hidden="true" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">
                              {r.description || sourceLabel(r.source)}
                            </p>
                            <p className="text-xs text-gray-400">
                              {r.transaction_date} · {r.payment_method?.toUpperCase() ?? '—'}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-green-600 flex-shrink-0">
                            +{fmtFull(Number(r.amount_tzs))}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ══ TAB: MATUMIZI ══════════════════════════════════════════ */}
            {tab === 'matumizi' && (
              <>
                <button onClick={() => setShowAddExp(true)}
                  className="w-full py-3 bg-primary-500 text-white rounded-2xl text-sm font-semibold">
                  <i className="ti ti-plus" aria-hidden="true" /> Ongeza Matumizi Mapya
                </button>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-800">Matumizi ya Hivi Karibuni</h3>
                    <span className="text-xs text-gray-400">{expRecords.length} rekodi</span>
                  </div>
                  {expRecords.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-400">
                      Hakuna matumizi kipindi hiki
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {expRecords.map(r => (
                        <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-sm flex-shrink-0">
                            <i className={`ti ti-${catIcon(r.category)}`} aria-hidden="true" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{r.description}</p>
                            <p className="text-xs text-gray-400">
                              {r.expense_date} · {catLabel(r.category)}
                              {r.vendor ? ` · ${r.vendor}` : ''}
                              {r.is_recurring ? ' ↻' : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <p className="text-sm font-semibold text-red-500">
                              -{fmtFull(Number(r.amount_tzs))}
                            </p>
                            {confirmDeleteExpId === r.id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => { deleteExpenseRecord(r.id); setConfirmDeleteExpId(null) }}
                                  className="text-[10px] text-white font-semibold px-2 py-0.5 bg-red-500 rounded-lg">
                                  Futa
                                </button>
                                <button onClick={() => setConfirmDeleteExpId(null)}
                                  className="text-[10px] text-gray-400 hover:text-gray-600 px-1"><i className="ti ti-x" aria-hidden="true" />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDeleteExpId(r.id)}
                                className="text-gray-300 hover:text-red-400 transition-colors">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ══ TAB: MIAMALA ═══════════════════════════════════════════ */}
            {tab === 'miamala' && (
              <>
                {/* Summary row */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-0.5">Mapato</p>
                    <p className="text-sm font-bold text-green-600">{fmtTsh(income?.total ?? 0)}</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-0.5">Matumizi</p>
                    <p className="text-sm font-bold text-red-500">{fmtTsh(expenses?.total ?? 0)}</p>
                  </div>
                  <div className={`rounded-xl p-3 text-center ${profit >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                    <p className="text-xs text-gray-500 mb-0.5">{profit >= 0 ? 'Faida' : 'Hasara'}</p>
                    <p className={`text-sm font-bold ${profit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                      {profit >= 0 ? '+' : '-'}{fmtTsh(Math.abs(profit))}
                    </p>
                  </div>
                </div>

                {/* Combined timeline */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-800">Miamala Yote</h3>
                    <div className="flex gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-400 rounded-full" />Mapato {incRecords.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-red-400 rounded-full" />Matumizi {expRecords.length}
                      </span>
                    </div>
                  </div>
                  {incRecords.length === 0 && expRecords.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-gray-400">
                      Hakuna miamala mwezi huu
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {[
                        ...incRecords.map(r => ({ ...r, _type: 'income' as const, _date: r.transaction_date })),
                        ...expRecords.map(r => ({ ...r, _type: 'expense' as const, _date: r.expense_date })),
                      ]
                        .sort((a, b) => new Date(b._date).getTime() - new Date(a._date).getTime())
                        .map((item, i) => (
                          <div key={i} className="px-4 py-3 flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 font-bold ${
                              item._type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-400'
                            }`}>
                              {item._type === 'income' ? '↑' : '↓'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">
                                {item._type === 'income'
                                  ? ((item as IncomeRecord).description || sourceLabel((item as IncomeRecord).source))
                                  : (item as ExpenseRecord).description}
                              </p>
                              <p className="text-xs text-gray-400">
                                {item._date}
                                {item._type === 'income' && (item as IncomeRecord).payment_method
                                  ? ` · ${(item as IncomeRecord).payment_method?.toUpperCase()}`
                                  : ''}
                                {item._type === 'expense'
                                  ? ` · ${catLabel((item as ExpenseRecord).category)}`
                                  : ''}
                              </p>
                            </div>
                            <p className={`text-sm font-semibold flex-shrink-0 ${
                              item._type === 'income' ? 'text-green-600' : 'text-red-500'
                            }`}>
                              {item._type === 'income' ? '+' : '-'}
                              {fmtFull(Number((item as IncomeRecord).amount_tzs ?? (item as ExpenseRecord).amount_tzs))}
                            </p>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>

                {/* Recurring expenses summary */}
                {recurring.length > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-amber-800 flex items-center gap-1"><i className="ti ti-refresh" aria-hidden="true" />Gharama za Mara kwa Mara</p>
                      <p className="text-xs text-amber-600">{fmtFull(recurringTotal)} / mwezi</p>
                    </div>
                    <div className="space-y-1.5">
                      {recurring.filter(r => r.is_active).map(r => (
                        <div key={r.id} className="flex items-center justify-between text-xs">
                          <span className="text-amber-700"><i className={`ti ti-${catIcon(r.category)}`} aria-hidden="true" /> {r.description}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-amber-800 font-medium">{fmtFull(Number(r.amount_tzs))}</span>
                            <button
                              onClick={() => toggleRecurring(r.id, r.is_active)}
                              className="text-amber-500 hover:text-red-500 text-[10px]"
                            >
                              <i className="ti ti-x" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ══ TAB: USAJIRI WA MADALALI ══════════════════════════════════ */}
        {tab === 'usajiri' && (
          subLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* KPI row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
                  <p className="text-xs text-gray-400 mb-1">MRR (Mapato/Mwezi)</p>
                  <p className="text-lg font-bold text-primary-600">{fmtTsh(subMetrics?.mrr ?? 0)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">ARR: {fmtTsh(subMetrics?.arr ?? 0)}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
                  <p className="text-xs text-gray-400 mb-1">Mapato Jumla</p>
                  <p className="text-lg font-bold text-green-600">{fmtTsh(subMetrics?.total_revenue ?? 0)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{subMetrics?.pending_invoices ?? 0} invois zinazongoja</p>
                </div>
              </div>

              {/* Status distribution */}
              {subMetrics && Object.keys(subMetrics.status_counts).length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-800 mb-3">Hali ya Usajiri</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(subMetrics.status_counts).sort(([,a],[,b]) => b-a).map(([st, cnt]) => {
                      const cls = st === 'active' ? 'bg-green-50 text-green-700 border-green-100'
                                : st === 'trial'  ? 'bg-blue-50 text-blue-700 border-blue-100'
                                : st === 'expired' || st === 'cancelled' ? 'bg-red-50 text-red-600 border-red-100'
                                : 'bg-gray-50 text-gray-600 border-gray-100'
                      return (
                        <div key={st} className={`border rounded-xl px-3 py-2 text-center flex-1 min-w-[80px] ${cls}`}>
                          <p className="text-xl font-bold">{cnt}</p>
                          <p className="text-[11px] font-medium capitalize">{st}</p>
                        </div>
                      )
                    })}
                    <div className="border border-orange-100 bg-orange-50 rounded-xl px-3 py-2 text-center flex-1 min-w-[80px]">
                      <p className="text-xl font-bold text-orange-600">{subMetrics.churned_last_30d}</p>
                      <p className="text-[11px] font-medium text-orange-600">Walioacha (30 siku)</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Plan distribution */}
              {subMetrics && subMetrics.plan_distribution.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-800 mb-3">Usambazaji wa Mipango</h3>
                  <div className="space-y-2.5">
                    {subMetrics.plan_distribution.map(p => {
                      const pct = subMetrics.mrr > 0 ? Math.round((p.mrr / subMetrics.mrr) * 100) : 0
                      return (
                        <div key={p.name}>
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span className="font-medium">{p.name}</span>
                            <span>{p.count} wanachama · {fmtFull(p.mrr)}/mwezi ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Monthly revenue trend */}
              {subMetrics && subMetrics.monthly_revenue.some(m => m.revenue > 0) && (() => {
                const maxRev = Math.max(...subMetrics.monthly_revenue.map(m => m.revenue), 1)
                return (
                  <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-800 mb-3">Mapato ya Miezi 6</h3>
                    <div className="flex items-end gap-1.5 h-24">
                      {subMetrics.monthly_revenue.map(m => {
                        const pct = Math.round((m.revenue / maxRev) * 100)
                        const lbl = new Date(m.month + '-01').toLocaleDateString('sw-TZ', { month: 'short' })
                        return (
                          <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                            <div className="w-full bg-gray-100 rounded-t-lg overflow-hidden flex items-end" style={{ height: '80px' }}>
                              <div className="w-full bg-primary-400 rounded-t-lg transition-all" style={{ height: `${pct}%` }} />
                            </div>
                            <p className="text-[10px] text-gray-400">{lbl}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Upcoming renewals */}
              {subMetrics && subMetrics.upcoming_renewals.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <h3 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-1">
                    <i className="ti ti-alert-triangle" aria-hidden="true" />Upya Ujao (siku 30)
                  </h3>
                  <div className="space-y-1.5">
                    {subMetrics.upcoming_renewals.map(r => (
                      <div key={r.org_id} className="flex items-center justify-between text-xs">
                        <span className="text-amber-800 font-medium">{(r.org as { name?: string } | null)?.name ?? r.org_id}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-amber-600">{r.plan ? fmtFull((r.plan as { price_tzs?: number }).price_tzs ?? 0) : ''}</span>
                          <span className="text-amber-500">{new Date(r.current_period_end).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short' })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dalali subscriptions list */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-gray-800 flex-shrink-0">Orodha ya Wanachama</h3>
                  <input
                    className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-primary-400 max-w-[160px]"
                    placeholder="Tafuta dalali..."
                    value={subSearch}
                    onChange={e => setSubSearch(e.target.value)}
                  />
                </div>
                {(() => {
                  const q = subSearch.toLowerCase()
                  const filtered = dalaliSubs.filter(s => {
                    const d = s.dalali
                    return !q || (d?.full_name?.toLowerCase().includes(q) || d?.phone?.includes(q) || d?.username?.toLowerCase().includes(q))
                  })
                  return filtered.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-400">Hakuna data</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {filtered.map(s => {
                        const d = s.dalali
                        const expDate = s.expires_at ? new Date(s.expires_at) : null
                        const isExpired = expDate ? expDate < new Date() : false
                        const statusCls = s.status === 'active' ? 'bg-green-100 text-green-700'
                          : s.status === 'trial' ? 'bg-blue-100 text-blue-700'
                          : 'bg-red-100 text-red-600'
                        return (
                          <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center text-sm flex-shrink-0 font-bold text-primary-600">
                              {initials(d?.full_name ?? null)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">{d?.full_name ?? '—'}</p>
                              <p className="text-xs text-gray-400">{d?.phone ?? d?.username ?? '—'}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusCls}`}>
                                {s.plan?.toUpperCase()} · {s.status}
                              </span>
                              <span className={`text-[10px] ${isExpired ? 'text-red-400' : 'text-gray-400'}`}>
                                {expDate ? expDate.toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            </>
          )
        )}

        {/* ══ TAB: MAWASILIANO (Contact Unlocks) ════════════════════════════ */}
        {tab === 'mawasiliano' && (
          unlockLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
                  <p className="text-xs text-gray-400 mb-1">Mapato Jumla</p>
                  <p className="text-sm font-bold text-green-600">{fmtTsh(unlockSummary?.total_revenue ?? 0)}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
                  <p className="text-xs text-gray-400 mb-1">Jumla</p>
                  <p className="text-sm font-bold text-gray-800">{(unlockSummary?.total_count ?? 0).toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
                  <p className="text-xs text-gray-400 mb-1">Leo</p>
                  <p className="text-sm font-bold text-primary-600">{unlockSummary?.today_count ?? 0}</p>
                </div>
              </div>

              {/* Unlocks list */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-gray-800 flex-shrink-0">Miamala ya Mawasiliano</h3>
                  <input
                    className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-primary-400 max-w-[160px]"
                    placeholder="Tafuta..."
                    value={unlockSearch}
                    onChange={e => setUnlockSearch(e.target.value)}
                  />
                </div>
                {(() => {
                  const q = unlockSearch.toLowerCase()
                  const filtered = unlocks.filter(u => {
                    if (!q) return true
                    const c = u.client; const d = u.dalali; const l = u.listing
                    return (c?.full_name?.toLowerCase().includes(q) || c?.phone?.includes(q) ||
                      d?.full_name?.toLowerCase().includes(q) || d?.username?.toLowerCase().includes(q) ||
                      l?.title?.toLowerCase().includes(q) || l?.district?.toLowerCase().includes(q))
                  })
                  return filtered.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-400">Hakuna miamala</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {filtered.map(u => (
                        <div key={u.id} className="px-4 py-3 flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <i className="ti ti-lock-open text-blue-500 text-sm" aria-hidden="true" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">
                              {u.client?.full_name ?? '—'} → {u.dalali?.full_name ?? '—'}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {u.listing?.title ?? '—'} · {u.listing?.district ?? ''} · {new Date(u.created_at).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short' })}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-green-600 flex-shrink-0">
                            +{fmtFull(u.amount_paid)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </>
          )
        )}

        {/* ══ TAB: MATANGAZO YALIYOIMARISHWA (Boosts) ═══════════════════════ */}
        {tab === 'matangazo' && (
          boostLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
                  <p className="text-xs text-gray-400 mb-1">Mapato Jumla</p>
                  <p className="text-sm font-bold text-green-600">{fmtTsh(boostSummary?.total_revenue ?? 0)}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
                  <p className="text-xs text-gray-400 mb-1">Zinazofanya Kazi</p>
                  <p className="text-sm font-bold text-amber-600">{boostSummary?.active_boosts ?? 0}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
                  <p className="text-xs text-gray-400 mb-1">Matangazo Boost</p>
                  <p className="text-sm font-bold text-primary-600">{boostSummary?.boosted_listings ?? 0}</p>
                </div>
              </div>

              {/* Boosts list */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-gray-800 flex-shrink-0">Matangazo Yaliyolipwa</h3>
                  <input
                    className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-primary-400 max-w-[160px]"
                    placeholder="Tafuta..."
                    value={boostSearch}
                    onChange={e => setBoostSearch(e.target.value)}
                  />
                </div>
                {(() => {
                  const q = boostSearch.toLowerCase()
                  const filtered = boosts.filter(b => {
                    if (!q) return true
                    const d = b.dalali; const l = b.listing
                    return (d?.full_name?.toLowerCase().includes(q) || d?.username?.toLowerCase().includes(q) ||
                      l?.title?.toLowerCase().includes(q) || l?.district?.toLowerCase().includes(q))
                  })
                  return filtered.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-400">Hakuna matangazo</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {filtered.map(b => {
                        const isActive = b.status === 'completed' && !!b.boosted_until && new Date(b.boosted_until) > new Date()
                        const expDate  = b.boosted_until ? new Date(b.boosted_until) : null
                        return (
                          <div key={b.id} className="px-4 py-3 flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-amber-50' : 'bg-gray-50'}`}>
                              <i className={`ti ti-rocket text-sm ${isActive ? 'text-amber-500' : 'text-gray-400'}`} aria-hidden="true" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">
                                {b.listing?.title ?? '—'} · {b.listing?.district ?? ''}
                              </p>
                              <p className="text-xs text-gray-400 truncate">
                                {b.dalali?.full_name ?? '—'} · wiki {b.weeks}
                                {expDate ? ` · mwisho: ${expDate.toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short' })}` : ''}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <p className="text-sm font-semibold text-green-600">+{fmtFull(b.amount)}</p>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                                {b.status}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            </>
          )
        )}

        {/* ══ SOURCE INCOME TABS (reusable pattern) ═══════════════════════════ */}
        {(['org_sub', 'fundi_sub', 'ad_campaign', 'extra_listing'] as TabKey[]).includes(tab) && (() => {
          const cfg: Record<string, { source: string; label: string; icon: string; color: string; emptyMsg: string }> = {
            org_sub:       { source: 'org_subscription',  label: 'Org Subscription',    icon: 'building',     color: 'indigo',  emptyMsg: 'Hakuna org subscriptions' },
            fundi_sub:     { source: 'fundi_subscription', label: 'Fundi Subscription',  icon: 'tool',         color: 'teal',    emptyMsg: 'Hakuna fundi subscriptions' },
            ad_campaign:   { source: 'ad_campaign',        label: 'Ad Campaigns',        icon: 'speakerphone', color: 'rose',    emptyMsg: 'Hakuna ad campaigns' },
            extra_listing: { source: 'extra_listing',      label: 'Orodha za Ziada',     icon: 'list-plus',    color: 'violet',  emptyMsg: 'Hakuna extra listing payments' },
          }
          const c = cfg[tab]
          const records = tab === 'org_sub' ? orgSubRecords
            : tab === 'fundi_sub'   ? fundiSubRecords
            : tab === 'ad_campaign' ? adCampaignRecords
            : extraListRecords
          const search = tab === 'org_sub' ? orgSubSearch
            : tab === 'fundi_sub'   ? fundiSubSearch
            : tab === 'ad_campaign' ? adCampaignSearch
            : extraListSearch
          const setSearch = tab === 'org_sub' ? setOrgSubSearch
            : tab === 'fundi_sub'   ? setFundiSubSearch
            : tab === 'ad_campaign' ? setAdCampaignSearch
            : setExtraListSearch
          const isLoading = srcLoadingTab === tab || records === null
          const sm = sourceSummary?.[c.source]
          const now = new Date()
          const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
          const allRecs = records ?? []
          const totalRev   = sm?.total      ?? allRecs.reduce((s, r) => s + Number(r.amount_tzs), 0)
          const thisMonth  = sm?.this_month ?? allRecs.filter(r => r.transaction_date >= monthStart).reduce((s, r) => s + Number(r.amount_tzs), 0)
          const totalCount = sm?.count      ?? allRecs.length
          const q = search.toLowerCase()
          const filtered = allRecs.filter(r =>
            !q || (r.description?.toLowerCase().includes(q) || r.reference_number?.toLowerCase().includes(q))
          )
          const colorMap: Record<string, { bg: string; text: string; badge: string }> = {
            indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700' },
            teal:   { bg: 'bg-teal-50',   text: 'text-teal-600',   badge: 'bg-teal-100 text-teal-700' },
            rose:   { bg: 'bg-rose-50',   text: 'text-rose-600',   badge: 'bg-rose-100 text-rose-700' },
            violet: { bg: 'bg-violet-50', text: 'text-violet-600', badge: 'bg-violet-100 text-violet-700' },
          }
          const cl = colorMap[c.color]

          if (isLoading) return (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
            </div>
          )

          return (
            <>
              {/* KPI row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
                  <p className="text-xs text-gray-400 mb-1">Mapato Jumla</p>
                  <p className={`text-sm font-bold ${cl.text}`}>{fmtTsh(totalRev)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{fmtFull(totalRev)}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
                  <p className="text-xs text-gray-400 mb-1">Mwezi Huu</p>
                  <p className="text-sm font-bold text-green-600">{fmtTsh(thisMonth)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{new Date().toLocaleDateString('sw-TZ', { month: 'short', year: '2-digit' })}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
                  <p className="text-xs text-gray-400 mb-1">Miamala</p>
                  <p className="text-sm font-bold text-gray-800">{totalCount.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">jumla</p>
                </div>
              </div>

              {/* Transaction list */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-gray-800 flex-shrink-0">{c.label}</h3>
                  <input
                    className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-primary-400 max-w-[160px]"
                    placeholder="Tafuta..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                {allRecs.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <p className="text-sm text-gray-400">{c.emptyMsg}</p>
                    <button onClick={handleSync} className="mt-3 text-xs text-primary-500 font-semibold">
                      <i className="ti ti-refresh" aria-hidden="true" /> Sync mapato
                    </button>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">Hakuna matokeo</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {filtered.map(r => (
                      <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full ${cl.bg} flex items-center justify-center flex-shrink-0`}>
                          <i className={`ti ti-${c.icon} text-sm ${cl.text}`} aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">
                            {r.description || c.label}
                          </p>
                          <p className="text-xs text-gray-400">
                            {r.transaction_date}
                            {r.payment_method ? ` · ${r.payment_method.toUpperCase()}` : ''}
                            {r.reference_number ? ` · ${r.reference_number}` : ''}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-green-600 flex-shrink-0">
                          +{fmtFull(Number(r.amount_tzs))}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )
        })()}

        {/* ══ TAB: TAKWIMU (Analytics) ══════════════════════════════════ */}
        {tab === 'takwimu' && (
          analyticsError ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm text-red-600">Imeshindwa kupakia takwimu.</p>
              <button
                onClick={() => setAnalyticsError(false)}
                className="text-xs bg-primary-500 text-white px-4 py-2 rounded-lg font-medium"
              >
                Jaribu Tena
              </button>
            </div>
          ) : (
            <TakwimuTab analytics={analytics} loading={analyticsLoading} />
          )
        )}

        {/* ══ TAB: BEI (Pricing Settings) ═══════════════════════════════ */}
        {tab === 'bei' && <PricingSettings />}

            </div>
          </div>
        </div>
      </div>

      {/* ── Add Expense Modal ── */}
      {showAddExp && (
        <AddExpenseModal
          onClose={() => setShowAddExp(false)}
          onSaved={loadData}
        />
      )}
    </div>
  )
}
