'use client'
import { useState, useEffect, useCallback } from 'react'

// ── Tax system is DORMANT — set NEXT_PUBLIC_TAX_ENABLED=true on Vercel when ready ──
const TAX_ENABLED = process.env.NEXT_PUBLIC_TAX_ENABLED === 'true'

const MONTHS = ['','Januari','Februari','Machi','Aprili','Mei','Juni','Julai','Agosti','Septemba','Oktoba','Novemba','Desemba']
function dateFmt(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
function fmt(n: number) { return `TZS ${(n ?? 0).toLocaleString()}` }

const STATUS: Record<string, { label: string; cls: string; next?: string; nextLabel?: string }> = {
  draft:     { label: 'Rasimu',    cls: 'bg-gray-100 text-gray-600',    next: 'sent',      nextLabel: 'Tuma' },
  sent:      { label: 'Imetumwa', cls: 'bg-blue-50 text-blue-700',    next: 'paid',      nextLabel: 'Imelipwa' },
  paid:      { label: 'Imelipwa', cls: 'bg-green-50 text-green-700' },
  cancelled: { label: 'Imefutwa', cls: 'bg-red-50 text-red-500' },
}

interface InvoiceItem { description: string; quantity: string; unit_price: string }
interface Invoice {
  id: string; invoice_number: string; client_name: string; client_phone: string | null
  client_email: string | null; issue_date: string; due_date: string | null
  status: string; subtotal_tzs: number; tax_tzs: number; total_tzs: number
  notes: string | null; created_at: string
}

const EMPTY_FORM = {
  client_name: '', client_phone: '', client_email: '',
  due_date: '', notes: '', tax_tzs: '0',
}
const EMPTY_ITEM: InvoiceItem = { description: '', quantity: '1', unit_price: '' }

export default function InvoicesPage() {
  const [invoices,     setInvoices]     = useState<Invoice[]>([])
  const [loading,      setLoading]      = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showCreate,   setShowCreate]   = useState(false)
  const [viewInvoice,  setViewInvoice]  = useState<(Invoice & { items?: { description: string; quantity: number; unit_price: number; amount: number }[] }) | null>(null)
  const [form,         setForm]         = useState(EMPTY_FORM)
  const [items,        setItems]        = useState<InvoiceItem[]>([{ ...EMPTY_ITEM }])
  const [saving,       setSaving]       = useState(false)
  const [formError,    setFormError]    = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const url = filterStatus === 'all'
        ? '/api/v1/dalali/invoices'
        : `/api/v1/dalali/invoices?status=${filterStatus}`
      const res  = await fetch(url)
      const json = await res.json()
      setInvoices(json.invoices ?? [])
    } finally { setLoading(false) }
  }, [filterStatus])

  useEffect(() => { load() }, [load])

  // ── Computed subtotal ────────────────────────────────────────────────────
  const subtotal = items.reduce((s, it) => {
    const q = parseFloat(it.quantity) || 0
    const p = parseFloat(it.unit_price) || 0
    return s + q * p
  }, 0)
  const tax   = TAX_ENABLED ? (parseFloat(form.tax_tzs) || 0) : 0
  const total = subtotal + tax

  // ── Create invoice ───────────────────────────────────────────────────────
  async function handleCreate() {
    setFormError('')
    if (!form.client_name.trim()) { setFormError('Jina la mteja linahitajika'); return }
    if (items.some(it => !it.description.trim() || !it.unit_price)) {
      setFormError('Kila kitu kinahitaji maelezo na bei'); return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/v1/dalali/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name:  form.client_name.trim(),
          client_phone: form.client_phone || null,
          client_email: form.client_email || null,
          due_date:     form.due_date || null,
          notes:        form.notes || null,
          items: items.map(it => ({
            description: it.description,
            quantity:    parseFloat(it.quantity) || 1,
            unit_price:  parseFloat(it.unit_price) || 0,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) { setFormError(json.error ?? 'Imeshindwa'); return }
      setShowCreate(false)
      setForm(EMPTY_FORM)
      setItems([{ ...EMPTY_ITEM }])
      await load()
    } finally { setSaving(false) }
  }

  // ── Load invoice detail ──────────────────────────────────────────────────
  async function openView(inv: Invoice) {
    const res  = await fetch(`/api/v1/dalali/invoices/${inv.id}`)
    const json = await res.json()
    setViewInvoice(json.invoice ?? inv)
  }

  // ── Update status ────────────────────────────────────────────────────────
  async function updateStatus(id: string, status: string) {
    await fetch(`/api/v1/dalali/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    if (viewInvoice?.id === id) setViewInvoice(v => v ? { ...v, status } : v)
  }

  // ── Delete draft ─────────────────────────────────────────────────────────
  async function deleteDraft(id: string) {
    if (!confirm('Futa invoice hii?')) return
    await fetch(`/api/v1/dalali/invoices/${id}`, { method: 'DELETE' })
    setInvoices(prev => prev.filter(i => i.id !== id))
    if (viewInvoice?.id === id) setViewInvoice(null)
  }

  const filtered = filterStatus === 'all' ? invoices : invoices.filter(i => i.status === filterStatus)
  const totalValue = invoices.filter(i => i.status !== 'cancelled').reduce((s, i) => s + i.total_tzs, 0)
  const paidValue  = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total_tzs, 0)

  return (
    <div className="flex flex-col min-h-screen max-w-3xl mx-auto">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
            <p className="text-xs text-gray-400 mt-0.5">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setForm(EMPTY_FORM); setItems([{ ...EMPTY_ITEM }]); setFormError('') }}
            className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors"
          >
            + Unda Invoice
          </button>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-gray-50 rounded-xl p-2.5 text-center">
            <p className="text-[10px] text-gray-400 mb-0.5">Jumla</p>
            <p className="text-sm font-bold text-gray-900">{fmt(totalValue)}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-2.5 text-center">
            <p className="text-[10px] text-gray-400 mb-0.5">Imelipwa</p>
            <p className="text-sm font-bold text-green-700">{fmt(paidValue)}</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-2.5 text-center">
            <p className="text-[10px] text-gray-400 mb-0.5">Inasubiri</p>
            <p className="text-sm font-bold text-amber-700">{fmt(totalValue - paidValue)}</p>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(['all', 'draft', 'sent', 'paid', 'cancelled'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === s ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'all' ? 'Zote' : STATUS[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice list */}
      <div className="flex-1 p-4 space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-2xl" />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🧾</p>
            <p className="font-medium">Hakuna invoices bado</p>
            <button onClick={() => setShowCreate(true)} className="mt-4 text-primary-500 text-sm font-medium">
              + Unda invoice ya kwanza
            </button>
          </div>
        ) : (
          filtered.map(inv => {
            const s = STATUS[inv.status] ?? STATUS['draft']
            return (
              <div key={inv.id}
                className="bg-white border border-gray-100 rounded-2xl p-4 cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => openView(inv)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-400">{inv.invoice_number}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
                    </div>
                    <p className="font-semibold text-gray-900">{inv.client_name}</p>
                    {inv.client_phone && <p className="text-xs text-gray-400 mt-0.5">{inv.client_phone}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-base font-bold text-gray-900">{fmt(inv.total_tzs)}</span>
                      <span className="text-xs text-gray-400">· {dateFmt(inv.issue_date)}</span>
                      {inv.due_date && <span className="text-xs text-gray-400">Mwisho: {dateFmt(inv.due_date)}</span>}
                    </div>
                  </div>
                  {/* Quick status action */}
                  {s.next && (
                    <button
                      onClick={e => { e.stopPropagation(); updateStatus(inv.id, s.next!) }}
                      className="flex-shrink-0 text-xs bg-primary-50 text-primary-600 border border-primary-200 px-2.5 py-1.5 rounded-lg hover:bg-primary-100 transition-colors"
                    >
                      {s.nextLabel}
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Create modal ─────────────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="font-semibold text-gray-900">Unda Invoice Mpya</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>

            <div className="p-4 space-y-4">
              {formError && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{formError}</p>}

              {/* Client info */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Mteja *</label>
                <input type="text" placeholder="Jina kamili la mteja" value={form.client_name}
                  onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 mb-2" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="tel" placeholder="Simu (hiari)" value={form.client_phone}
                    onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  <input type="email" placeholder="Barua pepe (hiari)" value={form.client_email}
                    onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Tarehe ya Mwisho (hiari)</label>
                <input type="date" value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>

              {/* Line items */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Vitu vya Invoice *</label>
                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-xl p-3 space-y-2">
                      <input type="text" placeholder="Maelezo ya huduma/kazi..." value={it.description}
                        onChange={e => setItems(prev => prev.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white" />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-400 mb-0.5 block">Idadi</label>
                          <input type="number" min="0.01" step="0.01" value={it.quantity}
                            onChange={e => setItems(prev => prev.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 mb-0.5 block">Bei (TZS)</label>
                          <input type="number" min="0" placeholder="0" value={it.unit_price}
                            onChange={e => setItems(prev => prev.map((x, i) => i === idx ? { ...x, unit_price: e.target.value } : x))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700">
                          = {fmt((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0))}
                        </span>
                        {items.length > 1 && (
                          <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                            className="text-xs text-red-400 hover:text-red-600">Futa</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setItems(prev => [...prev, { ...EMPTY_ITEM }])}
                  className="mt-2 text-xs text-primary-500 font-medium hover:text-primary-700">
                  + Ongeza kitu
                </button>
              </div>

              {/* Tax — dormant until NEXT_PUBLIC_TAX_ENABLED=true */}
              {TAX_ENABLED && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Kodi ya Serikali (TZS)</label>
                  <input type="number" min="0" value={form.tax_tzs}
                    onChange={e => setForm(f => ({ ...f, tax_tzs: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
              )}

              {/* Totals preview */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Jumla ndogo</span>
                  <span className="font-medium">{fmt(subtotal)}</span>
                </div>
                {TAX_ENABLED && tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Kodi ya Serikali</span>
                    <span className="font-medium">{fmt(tax)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-1 border-t border-gray-200">
                  <span>Jumla Kuu</span>
                  <span className="text-primary-600">{fmt(total)}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Maelezo ya Ziada</label>
                <textarea rows={2} placeholder="Hiari — masharti ya malipo, shukrani, n.k." value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
              </div>

              <button onClick={handleCreate} disabled={saving || !form.client_name.trim() || subtotal === 0}
                className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold text-sm hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {saving ? 'Inatengeneza...' : '🧾 Tengeneza Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View / Print modal ─────────────────────────────────────────────── */}
      {viewInvoice && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-mono text-xs text-gray-400">{viewInvoice.invoice_number}</p>
                <h2 className="font-semibold text-gray-900">{viewInvoice.client_name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()}
                  className="text-xs border border-gray-200 px-2.5 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50">
                  🖨 Chapisha
                </button>
                <button onClick={() => setViewInvoice(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Invoice header */}
              <div className="flex justify-between text-sm">
                <div>
                  <p className="text-xs text-gray-400">Mteja</p>
                  <p className="font-medium">{viewInvoice.client_name}</p>
                  {viewInvoice.client_phone && <p className="text-xs text-gray-500">{viewInvoice.client_phone}</p>}
                  {viewInvoice.client_email && <p className="text-xs text-gray-500">{viewInvoice.client_email}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Tarehe</p>
                  <p className="font-medium">{dateFmt(viewInvoice.issue_date)}</p>
                  {viewInvoice.due_date && (
                    <>
                      <p className="text-xs text-gray-400 mt-1">Mwisho</p>
                      <p className="font-medium">{dateFmt(viewInvoice.due_date)}</p>
                    </>
                  )}
                </div>
              </div>

              {/* Items table */}
              {viewInvoice.items && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Maelezo</th>
                        <th className="px-3 py-2 text-right">Idadi</th>
                        <th className="px-3 py-2 text-right">Bei</th>
                        <th className="px-3 py-2 text-right">Jumla</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {viewInvoice.items.map((it, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2">{it.description}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{it.quantity}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt(it.unit_price)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{fmt(it.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-right text-xs text-gray-500">Jumla ndogo</td>
                        <td className="px-3 py-2 text-right font-medium">{fmt(viewInvoice.subtotal_tzs)}</td>
                      </tr>
                      {TAX_ENABLED && viewInvoice.tax_tzs > 0 && (
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-right text-xs text-gray-500">Kodi ya Serikali</td>
                          <td className="px-3 py-2 text-right font-medium">{fmt(viewInvoice.tax_tzs)}</td>
                        </tr>
                      )}
                      <tr className="font-bold">
                        <td colSpan={3} className="px-3 py-2 text-right text-sm">JUMLA KUU</td>
                        <td className="px-3 py-2 text-right text-primary-600">{fmt(viewInvoice.total_tzs)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {viewInvoice.notes && (
                <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
                  <p className="text-xs text-gray-400 mb-1">Maelezo</p>
                  {viewInvoice.notes}
                </div>
              )}

              {/* Status & actions */}
              <div className="flex items-center gap-2 pt-1">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS[viewInvoice.status]?.cls}`}>
                  {STATUS[viewInvoice.status]?.label ?? viewInvoice.status}
                </span>
                <div className="ml-auto flex gap-2">
                  {STATUS[viewInvoice.status]?.next && (
                    <button
                      onClick={() => updateStatus(viewInvoice.id, STATUS[viewInvoice.status].next!)}
                      className="text-xs bg-primary-500 text-white px-3 py-1.5 rounded-lg hover:bg-primary-600 transition-colors"
                    >
                      ✓ {STATUS[viewInvoice.status].nextLabel}
                    </button>
                  )}
                  {viewInvoice.status === 'sent' && (
                    <button
                      onClick={() => updateStatus(viewInvoice.id, 'cancelled')}
                      className="text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50"
                    >
                      Futa
                    </button>
                  )}
                  {viewInvoice.status === 'draft' && (
                    <button
                      onClick={() => deleteDraft(viewInvoice.id)}
                      className="text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50"
                    >
                      Futa
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
