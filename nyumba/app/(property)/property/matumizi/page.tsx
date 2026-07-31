'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORIES: Record<string, string> = {
  maintenance: 'Matengenezo',
  utilities:   'Huduma za Umma',
  salaries:    'Mishahara',
  marketing:   'Masoko',
  legal:       'Kisheria',
  insurance:   'Bima',
  taxes:       'Kodi ya Serikali',
  office:      'Ofisi',
  other:       'Mengine',
}

const METHODS: Record<string, string> = {
  cash:          'Pesa Taslimu',
  mpesa:         'M-Pesa',
  airtel:        'Airtel',
  bank_transfer: 'Benki',
  cheque:        'Hundi',
  other:         'Mengine',
}

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString('en-TZ')
}

type Expense = {
  id: string
  amount_tzs: number
  category: string
  description: string
  vendor: string | null
  receipt_url: string | null
  expense_date: string
  payment_method: string
  notes: string | null
  created_at: string
}

const EMPTY_FORM = {
  amount_tzs: '',
  category: 'other',
  description: '',
  vendor: '',
  expense_date: new Date().toISOString().split('T')[0],
  payment_method: 'cash',
  notes: '',
  receipt_url: '',
}

export default function MatumiziPage() {
  const router  = useRouter()
  const now     = new Date()
  const [month, setMonth]     = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [orgId, setOrgId]     = useState<string | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editId,  setEditId]  = useState<string | null>(null)
  const [form,    setForm]     = useState(EMPTY_FORM)
  const [saving,  setSaving]  = useState(false)

  const load = useCallback(async (id: string, m: string) => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/v1/organizations/${id}/expenses?month=${m}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Hitilafu'); return }
      setExpenses(json.expenses ?? [])
    } catch { setError('Haikuweza kupakia matumizi.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    async function init() {
      try {
        const res  = await fetch('/api/v1/organizations')
        const data = await res.json()
        const orgs = data.organizations ?? []
        const prim = orgs.find((o: { role: string }) => o.role === 'owner') ?? orgs[0]
        if (!prim) { router.push('/property/setup'); return }
        const id = prim.organization.id
        setOrgId(id)
        await load(id, month)
      } catch { setError('Hitilafu ya mtandao.') }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleMonthChange(e: React.ChangeEvent<HTMLInputElement>) {
    const m = e.target.value
    setMonth(m)
    if (orgId) load(orgId, m)
  }

  function openAdd() {
    setEditId(null)
    setForm({ ...EMPTY_FORM, expense_date: new Date().toISOString().split('T')[0] })
    setShowForm(true)
  }

  function openEdit(exp: Expense) {
    setEditId(exp.id)
    setForm({
      amount_tzs:     String(exp.amount_tzs),
      category:       exp.category,
      description:    exp.description,
      vendor:         exp.vendor ?? '',
      expense_date:   exp.expense_date,
      payment_method: exp.payment_method,
      notes:          exp.notes ?? '',
      receipt_url:    exp.receipt_url ?? '',
    })
    setShowForm(true)
  }

  async function handleSave() {
    if (!orgId || !form.amount_tzs || !form.description || !form.expense_date) return
    setSaving(true)
    try {
      const payload = {
        amount_tzs:     Number(form.amount_tzs),
        category:       form.category,
        description:    form.description,
        vendor:         form.vendor || null,
        expense_date:   form.expense_date,
        payment_method: form.payment_method,
        notes:          form.notes || null,
        receipt_url:    form.receipt_url || null,
      }
      const url = editId
        ? `/api/v1/organizations/${orgId}/expenses?expenseId=${editId}`
        : `/api/v1/organizations/${orgId}/expenses`
      const res = await fetch(url, {
        method:  editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json()
        alert(j.error ?? 'Imeshindwa kuhifadhi')
        return
      }
      setShowForm(false)
      await load(orgId, month)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!orgId || !confirm('Futa matumizi haya?')) return
    const res = await fetch(`/api/v1/organizations/${orgId}/expenses?expenseId=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setExpenses(prev => prev.filter(e => e.id !== id))
    }
  }

  const total   = expenses.reduce((s, e) => s + (e.amount_tzs ?? 0), 0)
  const byCat   = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount_tzs
    return acc
  }, {})

  const [y, mo] = month.split('-').map(Number)
  const MONTHS = ['Januari','Februari','Machi','Aprili','Mei','Juni','Julai','Agosti','Septemba','Oktoba','Novemba','Desemba']
  const monthLabel = `${MONTHS[mo - 1]} ${y}`

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="p-4 lg:p-5 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Matumizi</h1>
            <p className="text-xs text-gray-400 mt-0.5">{monthLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="month" value={month} onChange={handleMonthChange}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
            />
            <button
              onClick={openAdd}
              className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors"
            >
              + Ongeza
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-2xl" />)}
          </div>
        ) : error ? (
          <div className="text-center py-10 text-red-500">{error}</div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
                <p className="text-xs text-gray-500 mb-1">Jumla ya Matumizi</p>
                <p className="text-2xl font-bold text-red-600">TZS {fmtMoney(total)}</p>
                <p className="text-xs text-gray-400 mt-1">{expenses.length} rekodi</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Kwa Aina</p>
                <div className="space-y-1">
                  {Object.entries(byCat).sort(([,a],[,b]) => b - a).slice(0, 4).map(([cat, amt]) => (
                    <div key={cat} className="flex justify-between text-xs">
                      <span className="text-gray-600 truncate">{CATEGORIES[cat] ?? cat}</span>
                      <span className="font-medium text-gray-800 ml-2">{fmtMoney(amt)}</span>
                    </div>
                  ))}
                  {Object.keys(byCat).length === 0 && <p className="text-xs text-gray-400">—</p>}
                </div>
              </div>
            </div>

            {/* Expense list */}
            {expenses.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-3">💸</p>
                <p className="font-medium">Hakuna matumizi {monthLabel}</p>
                <button onClick={openAdd} className="mt-4 text-primary-500 text-sm font-medium">+ Ongeza matumizi ya kwanza</button>
              </div>
            ) : (
              <div className="space-y-2">
                {expenses.map(exp => (
                  <div key={exp.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {CATEGORIES[exp.category] ?? exp.category}
                          </span>
                          <span className="text-xs text-gray-400">{exp.expense_date}</span>
                        </div>
                        <p className="font-medium text-gray-900 text-sm">{exp.description}</p>
                        {exp.vendor && <p className="text-xs text-gray-500 mt-0.5">📍 {exp.vendor}</p>}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-base font-bold text-red-600">TZS {fmtMoney(exp.amount_tzs)}</span>
                          <span className="text-xs text-gray-400">{METHODS[exp.payment_method] ?? exp.payment_method}</span>
                          {exp.receipt_url && (
                            <a href={exp.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-primary-500">🧾 Risiti</a>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => openEdit(exp)}
                          className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                        >
                          Hariri
                        </button>
                        <button
                          onClick={() => handleDelete(exp.id)}
                          className="text-xs text-red-500 border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-50"
                        >
                          Futa
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{editId ? 'Hariri Gharama' : 'Ongeza Gharama'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Kiasi (TZS) *</label>
                <input
                  type="number" placeholder="0" value={form.amount_tzs}
                  onChange={e => setForm(f => ({ ...f, amount_tzs: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Maelezo *</label>
                <input
                  type="text" placeholder="Elezea gharama hii..." value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Aina</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  >
                    {Object.entries(CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Njia ya Malipo</label>
                  <select
                    value={form.payment_method}
                    onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  >
                    {Object.entries(METHODS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Tarehe *</label>
                <input
                  type="date" value={form.expense_date}
                  onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Muuzaji / Mtoaji</label>
                <input
                  type="text" placeholder="Jina la muuzaji (hiari)" value={form.vendor}
                  onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Kiungo cha Risiti (URL)</label>
                <input
                  type="url" placeholder="https://..." value={form.receipt_url}
                  onChange={e => setForm(f => ({ ...f, receipt_url: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Maelezo zaidi</label>
                <textarea
                  rows={2} placeholder="Maelezo ya ziada..." value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                />
              </div>
              <button
                onClick={handleSave} disabled={saving || !form.amount_tzs || !form.description || !form.expense_date}
                className="w-full bg-primary-500 text-white py-3 rounded-xl font-medium text-sm hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Inahifadhi...' : editId ? 'Hifadhi Mabadiliko' : 'Ongeza Gharama'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
