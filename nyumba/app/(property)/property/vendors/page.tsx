'use client'
import { useEffect, useState } from 'react'
import type { Vendor } from '@/lib/types/property'
import { MAINTENANCE_CATEGORY_LABELS, MAINTENANCE_CATEGORY_ICONS } from '@/lib/types/property'

const CATEGORIES = [
  'all', 'plumbing', 'electrical', 'structural', 'cleaning', 'security', 'appliance', 'other',
] as const
type CatFilter = (typeof CATEGORIES)[number]

function fmt(n: number) { return `TZS ${n.toLocaleString()}` }

const EMPTY_FORM = {
  name: '', category: 'other', phone: '', email: '', specialty: '', location: '', notes: '',
}

export default function VendorsPage() {
  const [orgId,      setOrgId]      = useState<string | null>(null)
  const [vendors,    setVendors]    = useState<Vendor[]>([])
  const [loading,    setLoading]    = useState(true)
  const [catFilter,  setCatFilter]  = useState<CatFilter>('all')
  const [search,     setSearch]     = useState('')

  const [modal,      setModal]      = useState<'add' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<Vendor | null>(null)
  const [form,       setForm]       = useState({ ...EMPTY_FORM })
  const [saving,     setSaving]     = useState(false)
  const [formErr,    setFormErr]    = useState<string | null>(null)

  async function load(id: string) {
    const res  = await fetch(`/api/v1/organizations/${id}/vendors?active=false`)
    const data = await res.json()
    setVendors(data.vendors ?? [])
  }

  useEffect(() => {
    async function init() {
      try {
        const orgRes  = await fetch('/api/v1/organizations')
        const orgData = await orgRes.json()
        const orgs    = orgData.organizations ?? []
        const primary = orgs.find((o: { role: string }) => o.role === 'owner') ?? orgs[0]
        if (!primary) return
        const id = primary.organization.id
        setOrgId(id)
        await load(id)
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openAdd() {
    setForm({ ...EMPTY_FORM }); setEditTarget(null); setFormErr(null); setModal('add')
  }
  function openEdit(v: Vendor) {
    setForm({
      name: v.name, category: v.category, phone: v.phone ?? '',
      email: v.email ?? '', specialty: v.specialty ?? '',
      location: v.location ?? '', notes: v.notes ?? '',
    })
    setEditTarget(v); setFormErr(null); setModal('edit')
  }

  async function handleSave() {
    if (!orgId || !form.name.trim()) { setFormErr('Jina la mchezaji linahitajika'); return }
    setSaving(true); setFormErr(null)
    try {
      const body = {
        name:      form.name.trim(),
        category:  form.category,
        phone:     form.phone.trim()     || null,
        email:     form.email.trim()     || null,
        specialty: form.specialty.trim() || null,
        location:  form.location.trim()  || null,
        notes:     form.notes.trim()     || null,
      }
      let res: Response
      if (modal === 'add') {
        res = await fetch(`/api/v1/organizations/${orgId}/vendors`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
      } else {
        res = await fetch(`/api/v1/organizations/${orgId}/vendors/${editTarget!.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
      }
      const data = await res.json()
      if (!res.ok) { setFormErr(data.error ?? 'Kuna tatizo'); return }
      await load(orgId)
      setModal(null)
    } catch { setFormErr('Haikuweza kuhifadhi. Jaribu tena.') }
    finally { setSaving(false) }
  }

  async function handleToggleActive(vendor: Vendor) {
    if (!orgId) return
    const confirm_ = vendor.is_active
      ? window.confirm(`Futa ${vendor.name} kutoka kwenye orodha?`)
      : true
    if (!confirm_) return
    await fetch(`/api/v1/organizations/${orgId}/vendors/${vendor.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !vendor.is_active }),
    })
    await load(orgId)
  }

  const filtered = vendors.filter(v => {
    const matchesCat = catFilter === 'all' || v.category === catFilter
    const matchesSearch = !search.trim() ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.specialty?.toLowerCase().includes(search.toLowerCase()) ||
      v.location?.toLowerCase().includes(search.toLowerCase())
    return matchesCat && matchesSearch
  })

  const activeCount = vendors.filter(v => v.is_active).length

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {modal === 'add' ? 'Ongeza Mchezaji' : `Hariri — ${editTarget?.name}`}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Jina *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="mfano: Juma Bomba Services"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Aina ya Kazi</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                  {CATEGORIES.filter(c => c !== 'all').map(c => (
                    <option key={c} value={c}>{MAINTENANCE_CATEGORY_LABELS[c as keyof typeof MAINTENANCE_CATEGORY_LABELS] ?? c}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Simu</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+255..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Barua pepe</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="mfano@gmail.com"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Utaalamu (hiari)</label>
                <input value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}
                  placeholder="mfano: Bomba la maji, umeme wa jua..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Eneo (hiari)</label>
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="mfano: Kinondoni, Dar es Salaam"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Maelezo (hiari)</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Bei, masaa ya kufanya kazi, nk..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
              </div>
              {formErr && <p className="text-sm text-red-600">{formErr}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={saving || !form.name.trim()}
                  className="flex-1 bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 transition">
                  {saving ? 'Inahifadhi...' : modal === 'add' ? 'Ongeza' : 'Hifadhi'}
                </button>
                <button onClick={() => setModal(null)}
                  className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                  Ghairi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Wachuuzi</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeCount} wachuuzi hai · {vendors.length} wote
          </p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition flex-shrink-0">
          <i className="ti ti-plus" aria-hidden="true" />
          Ongeza
        </button>
      </div>

      {/* Search */}
      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Tafuta jina, utaalamu, eneo..."
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary-300" />

      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-4 pb-1">
        {CATEGORIES.map(c => {
          const count = c === 'all' ? vendors.filter(v => v.is_active).length : vendors.filter(v => v.category === c && v.is_active).length
          return (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap ${
                catFilter === c ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {c === 'all' ? 'Yote' : (MAINTENANCE_CATEGORY_LABELS[c as keyof typeof MAINTENANCE_CATEGORY_LABELS] ?? c)}
              <span className="ml-1 opacity-70">{count}</span>
            </button>
          )
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-14 text-center">
          <i className="ti ti-address-book text-5xl text-gray-200" aria-hidden="true" />
          <p className="text-gray-500 font-medium mt-3">
            {vendors.length === 0 ? 'Huna wachuuzi bado' : 'Hakuna matokeo'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {vendors.length === 0
              ? 'Ongeza mchezaji wa kwanza ili uweze kumpa kazi za matengenezo.'
              : 'Badilisha utafutaji au kichujio.'}
          </p>
          {vendors.length === 0 && (
            <button onClick={openAdd}
              className="mt-4 bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
              Ongeza Mchezaji
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(vendor => {
            const catLabel = MAINTENANCE_CATEGORY_LABELS[vendor.category as keyof typeof MAINTENANCE_CATEGORY_LABELS] ?? vendor.category
            const catIcon  = MAINTENANCE_CATEGORY_ICONS[vendor.category as keyof typeof MAINTENANCE_CATEGORY_ICONS] ?? 'tool'
            return (
              <div key={vendor.id} className={`bg-white rounded-2xl border p-4 shadow-sm transition ${!vendor.is_active ? 'opacity-50 border-gray-100' : 'border-gray-100 hover:border-primary-100'}`}>
                <div className="flex items-start gap-3">
                  {/* Category icon */}
                  <div className="w-10 h-10 bg-primary-50 rounded-full flex items-center justify-center flex-shrink-0">
                    <i className={`ti ti-${catIcon} text-primary-600 text-lg`} aria-hidden="true" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{vendor.name}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-50 text-primary-600 font-medium">
                        {catLabel}
                      </span>
                      {!vendor.is_active && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">Amefutwa</span>
                      )}
                    </div>
                    {vendor.specialty && (
                      <p className="text-xs text-gray-500 mt-0.5">{vendor.specialty}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-400">
                      {vendor.phone && (
                        <a href={`tel:${vendor.phone}`} className="flex items-center gap-1 hover:text-primary-600 transition">
                          <i className="ti ti-phone" aria-hidden="true" /> {vendor.phone}
                        </a>
                      )}
                      {vendor.location && (
                        <span className="flex items-center gap-1">
                          <i className="ti ti-map-pin" aria-hidden="true" /> {vendor.location}
                        </span>
                      )}
                      {vendor.jobs_completed > 0 && (
                        <span className="flex items-center gap-1 text-green-600">
                          <i className="ti ti-check" aria-hidden="true" /> {vendor.jobs_completed} kazi
                        </span>
                      )}
                    </div>
                    {vendor.notes && (
                      <p className="text-[11px] text-gray-400 mt-1 truncate">{vendor.notes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {vendor.phone && (
                      <a href={`https://wa.me/${vendor.phone.replace(/\D/g, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-xs px-2.5 py-1.5 bg-green-50 text-green-700 rounded-xl font-medium hover:bg-green-100 transition flex items-center gap-1">
                        <i className="ti ti-brand-whatsapp text-sm" aria-hidden="true" />
                        WA
                      </a>
                    )}
                    <button onClick={() => openEdit(vendor)}
                      className="text-xs px-2.5 py-1.5 bg-gray-50 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition">
                      Hariri
                    </button>
                    <button onClick={() => handleToggleActive(vendor)}
                      className={`text-xs px-2.5 py-1.5 rounded-xl font-medium transition ${
                        vendor.is_active
                          ? 'bg-red-50 text-red-500 hover:bg-red-100'
                          : 'bg-green-50 text-green-600 hover:bg-green-100'
                      }`}>
                      {vendor.is_active ? 'Futa' : 'Rejesha'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
