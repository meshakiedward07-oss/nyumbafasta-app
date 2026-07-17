'use client'
import { useState, useEffect } from 'react'

const PLACEMENT_OPTIONS = [
  { value: 'banner',    label: 'Banner (Homepage)' },
  { value: 'search',    label: 'Search Ads' },
  { value: 'nearby',    label: 'Nearby Ads' },
  { value: 'video',     label: 'Video Ads' },
  { value: 'featured',  label: 'Featured Business / Directory' },
  { value: 'microsite', label: 'Dalali Microsites' },
]

type Plan = {
  id: string; name: string; ad_type: string; description: string | null
  price_tzs: number; duration_days: number; slot_limit: number
  features: string[]; placements: string[]; display_order: number
  is_active: boolean; updated_at: string
}

const AD_TYPES = [
  { value: 'banner', label: 'Banner Ad' },
  { value: 'search', label: 'Search Ad' },
  { value: 'nearby', label: 'Nearby Ad' },
  { value: 'video',  label: 'Video Ad' },
  { value: 'featured', label: 'Featured Business' },
]

const emptyForm = {
  name: '', ad_type: 'banner', description: '',
  price_tzs: 0, duration_days: 30, slot_limit: 5,
  features: '', placements: ['banner'] as string[], display_order: 99, is_active: true,
}

export default function AdminAdvertPlansPage() {
  const [plans, setPlans]       = useState<Plan[]>([])
  const [loading, setLoading]   = useState(false)
  const [editing, setEditing]   = useState<Plan | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm]         = useState(emptyForm)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function load() {
    setLoading(true)
    const r = await fetch('/api/v1/admin/adverts/plans')
    const d = await r.json()
    setPlans(d.plans ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setForm(emptyForm); setEditing(null); setCreating(true); setError('')
  }

  function openEdit(p: Plan) {
    setForm({
      name: p.name, ad_type: p.ad_type, description: p.description ?? '',
      price_tzs: p.price_tzs, duration_days: p.duration_days, slot_limit: p.slot_limit,
      features: (p.features ?? []).join('\n'),
      placements: p.placements ?? [p.ad_type],
      display_order: p.display_order, is_active: p.is_active,
    })
    setEditing(p); setCreating(false); setError('')
  }

  function set(k: string, v: unknown) { setForm(p => ({ ...p, [k]: v })) }

  function togglePlacement(v: string) {
    setForm(p => ({
      ...p,
      placements: p.placements.includes(v)
        ? p.placements.filter(x => x !== v)
        : [...p.placements, v],
    }))
  }

  async function save() {
    setSaving(true); setError('')
    if (form.placements.length === 0) {
      setError('Chagua angalau placement moja')
      setSaving(false)
      return
    }
    const payload = {
      ...form,
      features: form.features.split('\n').map(f => f.trim()).filter(Boolean),
    }
    try {
      const res = editing
        ? await fetch(`/api/v1/admin/adverts/plans/${editing.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/v1/admin/adverts/plans', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Kuna tatizo'); return }
      await load()
      setEditing(null); setCreating(false)
    } catch { setError('Haikuweza kuhifadhi. Jaribu tena.') }
    finally { setSaving(false) }
  }

  async function deletePlan(id: string) {
    if (!confirm('Una uhakika unataka kufuta mpango huu?')) return
    await fetch(`/api/v1/admin/adverts/plans/${id}`, { method: 'DELETE' })
    await load()
  }

  async function toggleActive(p: Plan) {
    await fetch(`/api/v1/admin/adverts/plans/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !p.is_active }),
    })
    await load()
  }

  const showForm = creating || editing !== null

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Mipango ya Matangazo</h1>
        <button
          onClick={openCreate}
          className="bg-primary-500 text-white text-sm px-4 py-2 rounded-xl font-bold hover:bg-primary-600 transition"
        >
          + Mpango Mpya
        </button>
      </div>

      {/* Form panel */}
      {showForm && (
        <div className="bg-white border border-primary-200 rounded-2xl p-5 mb-6 shadow-sm">
          <h2 className="font-bold text-gray-700 mb-4">
            {editing ? `Hariri: ${editing.name}` : 'Unda Mpango Mpya'}
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4">{error}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jina *</label>
              <input
                value={form.name} onChange={e => set('name', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                placeholder="Mfano: Banner Premium — Dar es Salaam"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aina ya Tangazo *</label>
              <select
                value={form.ad_type} onChange={e => set('ad_type', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                {AD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bei (TZS) *</label>
              <input
                type="number" value={form.price_tzs} onChange={e => set('price_tzs', Number(e.target.value))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Muda (siku) *</label>
              <input
                type="number" value={form.duration_days} onChange={e => set('duration_days', Number(e.target.value))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vikomo vya Nafasi *</label>
              <input
                type="number" value={form.slot_limit} onChange={e => set('slot_limit', Number(e.target.value))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mpangilio (display_order)</label>
              <input
                type="number" value={form.display_order} onChange={e => set('display_order', Number(e.target.value))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Maelezo</label>
              <input
                value={form.description} onChange={e => set('description', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                placeholder="Maelezo mafupi ya mpango..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Vipengele (mstari mmoja kila kimoja)</label>
              <textarea
                value={form.features} onChange={e => set('features', e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none font-mono"
                placeholder="Nafasi 5 kwa mkoa&#10;Inaonekana kwa wateja&#10;Ujumbe wa WhatsApp..."
              />
            </div>

            {/* Placement checkboxes */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maeneo ya Matangazo *
                <span className="text-xs font-normal text-gray-400 ml-1">
                  (chagua wapi matangazo ya mpango huu yataonekana)
                </span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {PLACEMENT_OPTIONS.map(opt => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer text-sm transition ${
                      form.placements.includes(opt.value)
                        ? 'border-primary-400 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.placements.includes(opt.value)}
                      onChange={() => togglePlacement(opt.value)}
                      className="accent-primary-500"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox" id="is_active"
                checked={form.is_active} onChange={e => set('is_active', e.target.checked)}
                className="accent-primary-500"
              />
              <label htmlFor="is_active" className="text-sm text-gray-700">Mpango Unaofanya Kazi</label>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={save} disabled={saving}
              className="bg-primary-500 text-white text-sm px-5 py-2 rounded-xl font-bold hover:bg-primary-600 transition disabled:opacity-50"
            >
              {saving ? 'Inahifadhi...' : 'Hifadhi'}
            </button>
            <button
              onClick={() => { setEditing(null); setCreating(false) }}
              className="border border-gray-300 text-gray-600 text-sm px-5 py-2 rounded-xl hover:bg-gray-50 transition"
            >
              Ghairi
            </button>
          </div>
        </div>
      )}

      {/* Plans table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Jina</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Aina</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Bei</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Siku</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Nafasi</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Hali</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {plans.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{p.name}</div>
                    {p.description && <div className="text-xs text-gray-400 truncate max-w-xs">{p.description}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-500 text-xs">{p.ad_type}</div>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {(p.placements ?? []).map(pl => (
                        <span key={pl} className="text-[10px] bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded font-medium">
                          {pl}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">TZS {p.price_tzs.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.duration_days}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.slot_limit}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActive(p)} className="transition">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {p.is_active ? 'Hai' : 'Imezimwa'}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 justify-end">
                      <button
                        onClick={() => openEdit(p)}
                        className="text-xs border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition text-gray-600"
                      >
                        Hariri
                      </button>
                      <button
                        onClick={() => deletePlan(p.id)}
                        className="text-xs border border-red-200 text-red-600 px-2.5 py-1 rounded-lg hover:bg-red-50 transition"
                      >
                        Futa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {plans.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">Hakuna mipango. Unda mpango mpya.</div>
          )}
        </div>
      )}
    </div>
  )
}
