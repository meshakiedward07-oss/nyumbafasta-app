'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

const AD_TYPES = [
  { value: 'directory', label: 'Directory (Lazima)', required: true },
  { value: 'nearby',    label: 'Nearby Ad' },
  { value: 'featured',  label: 'Featured Business' },
  { value: 'banner',    label: 'Banner Ad' },
  { value: 'search',    label: 'Search Ad' },
  { value: 'video',     label: 'Video Ad' },
]

const VISIBILITY_OPTIONS = [
  { value: 'new_campaign',  label: 'Kampeni Mpya',    desc: 'Inaonekana kwenye /advertising/new' },
  { value: 'dashboard',     label: 'Dashboard',        desc: 'Upsell kwenye dashibodi ya mfanyabiashara' },
  { value: 'featured_only', label: 'Featured/Directory', desc: 'Ukurasa wa upgrade peke yake' },
  { value: 'all',           label: 'Mahali Pote',     desc: 'Inaonekana kila mahali' },
]

const PLACEMENT_OPTIONS = [
  { value: 'banner',    label: 'Banner (Homepage)' },
  { value: 'search',    label: 'Search Ads' },
  { value: 'nearby',    label: 'Nearby Ads' },
  { value: 'video',     label: 'Video Ads' },
  { value: 'featured',  label: 'Featured Business' },
  { value: 'microsite', label: 'Dalali Microsites' },
  { value: 'directory', label: 'Business Directory' },
]

type Plan = {
  id: string
  name: string
  ad_type: string
  bundle_types: string[]
  description: string | null
  price_tzs: number
  duration_days: number
  slot_limit: number
  features: string[]
  placements: string[]
  visibility: string
  display_order: number
  is_active: boolean
  updated_at: string
}

const EMPTY_FORM = {
  name: '',
  is_bundle: false,
  ad_type: 'directory',
  bundle_types: ['directory'] as string[],
  description: '',
  price_tzs: 0,
  duration_days: 30,
  slot_limit: 5,
  features: '',
  placements: ['directory'] as string[],
  visibility: 'new_campaign',
  display_order: 99,
  is_active: true,
}

export default function AdminAdvertPlansPage() {
  const [plans, setPlans]       = useState<Plan[]>([])
  const [loading, setLoading]   = useState(false)
  const [editing, setEditing]   = useState<Plan | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [toast, setToast]       = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const r = await fetch('/api/v1/admin/adverts/plans')
    const d = await r.json()
    setPlans(d.plans ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function openCreate() {
    setForm(EMPTY_FORM); setEditing(null); setCreating(true); setError('')
  }

  function openEdit(p: Plan) {
    const isBundle = p.ad_type === 'bundle' || (p.bundle_types ?? []).length > 1
    setForm({
      name: p.name,
      is_bundle: isBundle,
      ad_type: isBundle ? 'bundle' : (p.ad_type || 'directory'),
      bundle_types: p.bundle_types?.length > 0 ? p.bundle_types : [p.ad_type],
      description: p.description ?? '',
      price_tzs: p.price_tzs,
      duration_days: p.duration_days,
      slot_limit: p.slot_limit,
      features: (p.features ?? []).join('\n'),
      placements: p.placements ?? [p.ad_type],
      visibility: p.visibility ?? 'new_campaign',
      display_order: p.display_order,
      is_active: p.is_active,
    })
    setEditing(p); setCreating(false); setError('')
  }

  function set(k: string, v: unknown) { setForm(p => ({ ...p, [k]: v })) }

  function toggleBundleType(v: string) {
    if (v === 'directory') return // directory is always mandatory
    setForm(p => {
      const has = p.bundle_types.includes(v)
      return {
        ...p,
        bundle_types: has
          ? p.bundle_types.filter(x => x !== v)
          : [...p.bundle_types, v],
      }
    })
  }

  function togglePlacement(v: string) {
    setForm(p => ({
      ...p,
      placements: p.placements.includes(v)
        ? p.placements.filter(x => x !== v)
        : [...p.placements, v],
    }))
  }

  function switchMode(isBundle: boolean) {
    setForm(p => ({
      ...p,
      is_bundle: isBundle,
      ad_type: isBundle ? 'bundle' : 'directory',
      bundle_types: isBundle ? ['directory'] : [p.ad_type === 'bundle' ? 'directory' : p.ad_type],
    }))
  }

  async function save() {
    setSaving(true); setError('')
    if (!form.name.trim()) { setError('Jina la mpango linahitajika'); setSaving(false); return }
    if (form.price_tzs <= 0) { setError('Bei lazima iwe zaidi ya sifuri'); setSaving(false); return }
    if (form.is_bundle && form.bundle_types.length < 2) {
      setError('Bundle lazima iwe na aina mbili au zaidi za matangazo')
      setSaving(false); return
    }
    if (form.placements.length === 0) { setError('Chagua angalau mahali mmoja'); setSaving(false); return }

    const payload = {
      name: form.name,
      ad_type: form.is_bundle ? 'bundle' : form.ad_type,
      bundle_types: form.is_bundle ? form.bundle_types : [form.ad_type],
      description: form.description || null,
      price_tzs: form.price_tzs,
      duration_days: form.duration_days,
      slot_limit: form.slot_limit,
      features: form.features.split('\n').map(f => f.trim()).filter(Boolean),
      placements: form.placements,
      visibility: form.visibility,
      display_order: form.display_order,
      is_active: form.is_active,
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
      showToast(editing ? '✅ Mpango umehifadhiwa!' : '✅ Mpango mpya umeundwa!')
      await load()
      setEditing(null); setCreating(false)
    } catch { setError('Haikuweza kuhifadhi. Jaribu tena.') }
    finally { setSaving(false) }
  }

  async function deletePlan(p: Plan) {
    if (!confirm(`Una uhakika unataka kufuta "${p.name}"?`)) return
    const res = await fetch(`/api/v1/admin/adverts/plans/${p.id}`, { method: 'DELETE' })
    const d = await res.json()
    if (d.deactivated) {
      showToast('⚠️ Mpango una kampeni — umesimamishwa badala ya kufutwa')
    } else {
      showToast('🗑 Mpango umefutwa')
    }
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

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[200] px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white bg-gray-900 animate-in slide-in-from-top-2">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/adverts" className="text-gray-400 hover:text-gray-600 text-sm">
              ← Kampeni
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-700">Mipango</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Mipango ya Matangazo</h1>
        </div>
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

          {/* Plan type toggle */}
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => switchMode(false)}
              className={`px-4 py-2 text-sm font-semibold rounded-xl border transition ${
                !form.is_bundle
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Aina Moja
            </button>
            <button
              onClick={() => switchMode(true)}
              className={`px-4 py-2 text-sm font-semibold rounded-xl border transition ${
                form.is_bundle
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Bundle (Aina Nyingi)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jina la Mpango *</label>
              <input
                value={form.name} onChange={e => set('name', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                placeholder="Mfano: Basic Bundle — Directory + Nearby"
              />
            </div>

            {!form.is_bundle && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aina ya Tangazo *</label>
                <select
                  value={form.ad_type} onChange={e => { set('ad_type', e.target.value); set('bundle_types', [e.target.value]) }}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                >
                  {AD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            )}

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
              <label className="block text-sm font-medium text-gray-700 mb-1">Vikomo vya Nafasi</label>
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

            {/* Bundle types selector */}
            {form.is_bundle && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Aina za Matangazo Zilizojumuishwa *
                  <span className="text-xs font-normal text-amber-600 ml-2">Directory ni lazima kwa mipango yote</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {AD_TYPES.map(t => {
                    const isSelected = form.bundle_types.includes(t.value)
                    const isLocked   = t.value === 'directory'
                    return (
                      <label
                        key={t.value}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-sm transition ${
                          isSelected
                            ? isLocked
                              ? 'border-amber-300 bg-amber-50 text-amber-700 cursor-not-allowed'
                              : 'border-primary-400 bg-primary-50 text-primary-700 cursor-pointer'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleBundleType(t.value)}
                          disabled={isLocked}
                          className="accent-primary-500"
                        />
                        {t.label}
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Visibility */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upatikanaji — Mpango huu utaonekana wapi?
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {VISIBILITY_OPTIONS.map(opt => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                      form.visibility === opt.value
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={opt.value}
                      checked={form.visibility === opt.value}
                      onChange={() => set('visibility', opt.value)}
                      className="accent-primary-500 mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-700">{opt.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
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
                Maeneo ya Kuonyesha *
                <span className="text-xs font-normal text-gray-400 ml-1">
                  (wapi matangazo ya mpango huu yataonekana kwenye app)
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
              {saving ? 'Inahifadhi...' : editing ? 'Hifadhi Mabadiliko' : 'Unda Mpango'}
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Jina</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Aina</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Upatikanaji</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Bei</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Siku</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Hali</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {plans.map(p => {
                  const isBundle = p.ad_type === 'bundle' || (p.bundle_types ?? []).length > 1
                  const types = isBundle ? (p.bundle_types ?? []) : [p.ad_type]
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{p.name}</div>
                        {p.description && <div className="text-xs text-gray-400 truncate max-w-[200px]">{p.description}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {isBundle && (
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium mr-1">Bundle</span>
                        )}
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {types.map(t => (
                            <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              t === 'directory' ? 'bg-amber-100 text-amber-700' : 'bg-primary-50 text-primary-700'
                            }`}>
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                          {VISIBILITY_OPTIONS.find(v => v.value === (p.visibility ?? 'new_campaign'))?.label ?? p.visibility}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        TZS {p.price_tzs.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{p.duration_days}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => toggleActive(p)} title="Bonyeza kubadilisha hali">
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
                            onClick={() => deletePlan(p)}
                            className="text-xs border border-red-200 text-red-600 px-2.5 py-1 rounded-lg hover:bg-red-50 transition"
                          >
                            Futa
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {plans.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">Hakuna mipango. Unda mpango mpya.</div>
          )}
        </div>
      )}
    </div>
  )
}
