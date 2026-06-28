'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

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

// ── Helpers ────────────────────────────────────────────────────────────────
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
  const [tab,       setTab]       = useState<'overview' | 'mapato' | 'matumizi' | 'miamala'>('overview')
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

  // keep period/date for legacy API compatibility
  const period = 'monthly' as Period
  const date   = `${selectedMonth}-01`

  useEffect(() => { setMonthOptions(generateMonthOptions()) }, [])

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
      <div className="min-h-screen bg-gray-50 pb-20">
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
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ── Toast ── */}
      {toast && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-2xl shadow-xl text-center">
          {toast}
        </div>
      )}

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/admin" className="p-2 rounded-full hover:bg-gray-100">
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-900 flex items-center gap-2"><i className="ti ti-coins" aria-hidden="true" />Hesabu za NyumbaFasta</h1>
          <p className="text-xs text-gray-400">Mapato, Matumizi, Faida</p>
        </div>
        <button onClick={() => setShowAddExp(true)}
          className="flex items-center gap-1 px-3 py-2 bg-primary-500 text-white rounded-xl text-xs font-semibold">
          <span>+</span><span>Gharama</span>
        </button>
      </div>

      {/* ── Month selector ── */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2">
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

      {/* ── Month indicator banner ── */}
      {(() => {
        const isCurrentMonth = selectedMonth === getCurrentMonth()
        const currentLabel   = monthOptions.find(m => m.value === selectedMonth)?.label ?? selectedMonth
        const today          = new Date().getDate()
        const totalDays      = daysInMonth(selectedMonth)
        return (
          <div className={`px-4 py-2 flex items-center justify-between text-xs ${
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

      {/* ── Download + Sync bar ── */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2">
        <button onClick={() => handleDownload('pdf')} disabled={!!downloading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-xs font-medium disabled:opacity-50">
          {downloading === 'pdf' ? '⏳' : '⬇️'} PDF · {monthOptions.find(m => m.value === selectedMonth)?.label?.split(' ')[0] ?? selectedMonth}
        </button>
        <button onClick={() => handleDownload('excel')} disabled={!!downloading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-xl text-xs font-medium disabled:opacity-50">
          {downloading === 'excel' ? '⏳' : '⬇️'} Excel · {monthOptions.find(m => m.value === selectedMonth)?.label?.split(' ')[0] ?? selectedMonth}
        </button>
        <button onClick={handleSync}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-medium">
          <i className="ti ti-refresh" aria-hidden="true" /> Sync Mapato
        </button>
        {syncMsg && <span className="text-xs text-gray-500 ml-1">{syncMsg}</span>}
      </div>

      {/* ── Tab nav ── */}
      <div className="bg-white border-b border-gray-100 flex overflow-x-auto scrollbar-none">
        {([
          { key: 'overview',  label: 'Muhtasari', icon: 'chart-bar' },
          { key: 'mapato',    label: 'Mapato',    icon: 'trending-up' },
          { key: 'matumizi',  label: 'Matumizi',  icon: 'trending-down' },
          { key: 'miamala',   label: 'Miamala',   icon: 'clipboard-list' },
        ] as { key: typeof tab; label: string; icon: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-400'
            }`}
          >
            <i className={`ti ti-${t.icon}`} aria-hidden="true" /><span>{t.label}</span>
          </button>
        ))}
      </div>

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
