'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FileUploadButton } from '@/components/property/FileUploadButton'

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

type RecurringTemplate = {
  id: string
  amount_tzs: string
  category: string
  description: string
  vendor: string
  payment_method: string
  day_of_month: number
}

type PageTab = 'expenses' | 'recurring'

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

const EMPTY_RECUR = {
  amount_tzs: '',
  category: 'other',
  description: '',
  vendor: '',
  payment_method: 'cash',
  day_of_month: 1,
}

const LS_KEY = 'nf_recurring_templates'

export default function MatumiziPage() {
  const router = useRouter()
  const now    = new Date()

  const [pageTab, setPageTab] = useState<PageTab>('expenses')
  const [month,   setMonth]   = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [orgId,   setOrgId]   = useState<string | null>(null)

  // Expense state
  const [expenses,  setExpenses]  = useState<Expense[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [showForm,  setShowForm]  = useState(false)
  const [editId,    setEditId]    = useState<string | null>(null)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [saving,    setSaving]    = useState(false)

  // Recurring template state
  const [templates,     setTemplates]     = useState<RecurringTemplate[]>([])
  const [showRecurForm, setShowRecurForm] = useState(false)
  const [editRecurId,   setEditRecurId]   = useState<string | null>(null)
  const [recurForm,     setRecurForm]     = useState<typeof EMPTY_RECUR>(EMPTY_RECUR)
  const [applyingId,    setApplyingId]    = useState<string | null>(null)

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
    try {
      const stored = localStorage.getItem(LS_KEY)
      if (stored) setTemplates(JSON.parse(stored))
    } catch { /* silent */ }

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

  function saveTemplates(updated: RecurringTemplate[]) {
    setTemplates(updated)
    localStorage.setItem(LS_KEY, JSON.stringify(updated))
  }

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
    if (res.ok) setExpenses(prev => prev.filter(e => e.id !== id))
  }

  function openAddRecur() {
    setEditRecurId(null)
    setRecurForm({ ...EMPTY_RECUR })
    setShowRecurForm(true)
  }

  function openEditRecur(t: RecurringTemplate) {
    setEditRecurId(t.id)
    setRecurForm({ amount_tzs: t.amount_tzs, category: t.category, description: t.description, vendor: t.vendor, payment_method: t.payment_method, day_of_month: t.day_of_month })
    setShowRecurForm(true)
  }

  function handleSaveRecur() {
    if (!recurForm.amount_tzs || !recurForm.description) return
    let updated: RecurringTemplate[]
    if (editRecurId) {
      updated = templates.map(t => t.id === editRecurId ? { ...t, ...recurForm } : t)
    } else {
      updated = [...templates, { id: crypto.randomUUID(), ...recurForm }]
    }
    saveTemplates(updated)
    setShowRecurForm(false)
  }

  function handleDeleteRecur(id: string) {
    if (!confirm('Futa kielezo hiki?')) return
    saveTemplates(templates.filter(t => t.id !== id))
  }

  async function applyTemplate(t: RecurringTemplate) {
    if (!orgId) return
    setApplyingId(t.id)
    try {
      const today = new Date()
      const day   = String(t.day_of_month).padStart(2, '0')
      const expenseDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${day}`
      const res = await fetch(`/api/v1/organizations/${orgId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_tzs:     Number(t.amount_tzs),
          category:       t.category,
          description:    t.description,
          vendor:         t.vendor || null,
          expense_date:   expenseDate,
          payment_method: t.payment_method,
          notes:          null,
          receipt_url:    null,
        }),
      })
      if (!res.ok) { const j = await res.json(); alert(j.error ?? 'Imeshindwa'); return }
      setPageTab('expenses')
      await load(orgId, month)
    } finally {
      setApplyingId(null)
    }
  }

  const total = expenses.reduce((s, e) => s + (e.amount_tzs ?? 0), 0)
  const byCat = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount_tzs
    return acc
  }, {})

  const [y, mo] = month.split('-').map(Number)
  const MONTHS = ['Januari','Februari','Machi','Aprili','Mei','Juni','Julai','Agosti','Septemba','Oktoba','Novemba','Desemba']
  const monthLabel = `${MONTHS[mo - 1]} ${y}`

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300'

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
            {pageTab === 'expenses' && (
              <input
                type="month" value={month} onChange={handleMonthChange}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
              />
            )}
            <button
              onClick={pageTab === 'expenses' ? openAdd : openAddRecur}
              className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors"
            >
              + Ongeza
            </button>
          </div>
        </div>
        {/* Sub-tabs */}
        <div className="flex gap-1 mt-3">
          <button
            onClick={() => setPageTab('expenses')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${pageTab === 'expenses' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            <i className="ti ti-list mr-1" />Matumizi
          </button>
          <button
            onClick={() => setPageTab('recurring')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1 ${pageTab === 'recurring' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            <i className="ti ti-repeat" />Mara kwa Mara
            {templates.length > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${pageTab === 'recurring' ? 'bg-white/20' : 'bg-primary-100 text-primary-700'}`}>{templates.length}</span>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Expenses tab */}
        {pageTab === 'expenses' && (
          <>
            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-2xl" />)}
              </div>
            ) : error ? (
              <div className="text-center py-10 text-red-500">{error}</div>
            ) : (
              <>
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
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{CATEGORIES[exp.category] ?? exp.category}</span>
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
                            <button onClick={() => openEdit(exp)} className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">Hariri</button>
                            <button onClick={() => handleDelete(exp.id)} className="text-xs text-red-500 border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-50">Futa</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Recurring templates tab */}
        {pageTab === 'recurring' && (
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-xs text-blue-700">
              <i className="ti ti-info-circle mr-1" />
              Vielelezo vya matumizi yanayorudiwa kila mwezi. Bonyeza &ldquo;Tumia&rdquo; kuongeza gharama mwezi huu haraka.
            </div>
            {templates.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-3">🔄</p>
                <p className="font-medium">Hakuna vielelezo vya matumizi ya mara kwa mara</p>
                <button onClick={openAddRecur} className="mt-4 text-primary-500 text-sm font-medium">+ Unda kielezo cha kwanza</button>
              </div>
            ) : (
              templates.map(t => (
                <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{CATEGORIES[t.category] ?? t.category}</span>
                        <span className="text-xs text-gray-400">Siku {t.day_of_month} ya mwezi</span>
                      </div>
                      <p className="font-medium text-gray-900 text-sm">{t.description}</p>
                      {t.vendor && <p className="text-xs text-gray-500 mt-0.5">📍 {t.vendor}</p>}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-base font-bold text-red-600">TZS {fmtMoney(Number(t.amount_tzs))}</span>
                        <span className="text-xs text-gray-400">{METHODS[t.payment_method] ?? t.payment_method}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => applyTemplate(t)}
                        disabled={!!applyingId}
                        className="text-xs text-primary-600 border border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-50 disabled:opacity-50 font-medium"
                      >
                        {applyingId === t.id ? '...' : 'Tumia'}
                      </button>
                      <button onClick={() => openEditRecur(t)} className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">Hariri</button>
                      <button onClick={() => handleDeleteRecur(t.id)} className="text-xs text-red-500 border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-50">Futa</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Expense Modal */}
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
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Maelezo *</label>
                <input
                  type="text" placeholder="Elezea gharama hii..." value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Aina</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                    {Object.entries(CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Njia ya Malipo</label>
                  <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} className={inputCls}>
                    {Object.entries(METHODS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Tarehe *</label>
                <input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Muuzaji / Mtoaji</label>
                <input type="text" placeholder="Jina la muuzaji (hiari)" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} className={inputCls} />
              </div>
              <FileUploadButton
                label="Pakia Risiti"
                value={form.receipt_url}
                onChange={url => setForm(f => ({ ...f, receipt_url: url }))}
                accept="image/*,application/pdf"
              />
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Maelezo zaidi</label>
                <textarea
                  rows={2} placeholder="Maelezo ya ziada..." value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className={`${inputCls} resize-none`}
                />
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !form.amount_tzs || !form.description || !form.expense_date}
                className="w-full bg-primary-500 text-white py-3 rounded-xl font-medium text-sm hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Inahifadhi...' : editId ? 'Hifadhi Mabadiliko' : 'Ongeza Gharama'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Recurring Template Modal */}
      {showRecurForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{editRecurId ? 'Hariri Kielezo' : 'Kielezo Kipya cha Mara kwa Mara'}</h2>
              <button onClick={() => setShowRecurForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Maelezo *</label>
                <input
                  type="text" placeholder="e.g. Maji ya mwezi, Umeme, Mlinzi..." value={recurForm.description}
                  onChange={e => setRecurForm(f => ({ ...f, description: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Kiasi (TZS) *</label>
                <input
                  type="number" placeholder="0" value={recurForm.amount_tzs}
                  onChange={e => setRecurForm(f => ({ ...f, amount_tzs: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Aina</label>
                  <select value={recurForm.category} onChange={e => setRecurForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                    {Object.entries(CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Siku ya Mwezi (1–28)</label>
                  <input
                    type="number" min={1} max={28} value={recurForm.day_of_month}
                    onChange={e => setRecurForm(f => ({ ...f, day_of_month: Number(e.target.value) }))}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Njia ya Malipo</label>
                  <select value={recurForm.payment_method} onChange={e => setRecurForm(f => ({ ...f, payment_method: e.target.value }))} className={inputCls}>
                    {Object.entries(METHODS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Muuzaji (hiari)</label>
                  <input
                    type="text" placeholder="—" value={recurForm.vendor}
                    onChange={e => setRecurForm(f => ({ ...f, vendor: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>
              <button
                onClick={handleSaveRecur}
                disabled={!recurForm.amount_tzs || !recurForm.description}
                className="w-full bg-primary-500 text-white py-3 rounded-xl font-medium text-sm hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {editRecurId ? 'Hifadhi Mabadiliko' : 'Unda Kielezo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
