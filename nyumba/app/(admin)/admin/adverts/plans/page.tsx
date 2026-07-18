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
  { value: 'new_campaign',  label: 'Kampeni Mpya',       desc: 'Inaonekana kwenye /advertising/new' },
  { value: 'dashboard',     label: 'Dashboard',           desc: 'Upsell kwenye dashibodi ya mfanyabiashara' },
  { value: 'featured_only', label: 'Featured/Directory',  desc: 'Ukurasa wa upgrade peke yake' },
  { value: 'all',           label: 'Mahali Pote',         desc: 'Inaonekana kila mahali' },
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

const TYPE_COLORS: Record<string, string> = {
  directory: 'bg-amber-50 text-amber-700',
  nearby:    'bg-teal-50 text-teal-700',
  featured:  'bg-purple-50 text-purple-700',
  banner:    'bg-blue-50 text-blue-700',
  search:    'bg-indigo-50 text-indigo-700',
  video:     'bg-pink-50 text-pink-700',
  bundle:    'bg-gray-100 text-gray-700',
}

type Plan = {
  id: string; name: string; ad_type: string; bundle_types: string[]
  description: string | null; price_tzs: number; duration_days: number
  slot_limit: number; features: string[]; placements: string[]
  visibility: string; display_order: number; is_active: boolean; updated_at: string
}

const EMPTY_FORM = {
  name: '', is_bundle: false, ad_type: 'directory',
  bundle_types: ['directory'] as string[],
  description: '', price_tzs: 0, duration_days: 30,
  slot_limit: 5, features: '', placements: ['directory'] as string[],
  visibility: 'new_campaign', display_order: 99, is_active: true,
}

export default function AdminAdvertPlansPage() {
  const [plans, setPlans]       = useState<Plan[]>([])
  const [loading, setLoading]   = useState(false)
  const [editing, setEditing]   = useState<Plan | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)
  const [confirmDel, setConfirmDel] = useState<Plan | null>(null)

  async function load() {
    setLoading(true)
    const r = await fetch('/api/v1/admin/adverts/plans')
    setPlans((await r.json()).plans ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500) }

  function openCreate() { setForm(EMPTY_FORM); setEditing(null); setCreating(true); setError('') }

  function openEdit(p: Plan) {
    const isBundle = p.ad_type === 'bundle' || (p.bundle_types ?? []).length > 1
    setForm({
      name: p.name, is_bundle: isBundle,
      ad_type: isBundle ? 'bundle' : (p.ad_type || 'directory'),
      bundle_types: p.bundle_types?.length > 0 ? p.bundle_types : [p.ad_type],
      description: p.description ?? '', price_tzs: p.price_tzs, duration_days: p.duration_days,
      slot_limit: p.slot_limit, features: (p.features ?? []).join('\n'),
      placements: p.placements ?? [p.ad_type], visibility: p.visibility ?? 'new_campaign',
      display_order: p.display_order, is_active: p.is_active,
    })
    setEditing(p); setCreating(false); setError('')
  }

  function closeForm() { setEditing(null); setCreating(false); setError('') }
  function set(k: string, v: unknown) { setForm(p => ({ ...p, [k]: v })) }

  function toggleBundleType(v: string) {
    if (v === 'directory') return
    setForm(p => ({
      ...p, bundle_types: p.bundle_types.includes(v)
        ? p.bundle_types.filter(x => x !== v)
        : [...p.bundle_types, v],
    }))
  }

  function togglePlacement(v: string) {
    setForm(p => ({
      ...p, placements: p.placements.includes(v)
        ? p.placements.filter(x => x !== v)
        : [...p.placements, v],
    }))
  }

  function switchMode(isBundle: boolean) {
    setForm(p => ({
      ...p, is_bundle: isBundle,
      ad_type: isBundle ? 'bundle' : 'directory',
      bundle_types: isBundle ? ['directory'] : [p.ad_type === 'bundle' ? 'directory' : p.ad_type],
    }))
  }

  async function save() {
    setSaving(true); setError('')
    if (!form.name.trim())             { setError('Jina la mpango linahitajika'); setSaving(false); return }
    if (form.price_tzs <= 0)           { setError('Bei lazima iwe zaidi ya sifuri'); setSaving(false); return }
    if (form.is_bundle && form.bundle_types.length < 2) { setError('Bundle lazima iwe na aina mbili au zaidi'); setSaving(false); return }
    if (form.placements.length === 0)  { setError('Chagua angalau mahali mmoja'); setSaving(false); return }

    const payload = {
      name: form.name,
      ad_type: form.is_bundle ? 'bundle' : form.ad_type,
      bundle_types: form.is_bundle ? form.bundle_types : [form.ad_type],
      description: form.description || null, price_tzs: form.price_tzs,
      duration_days: form.duration_days, slot_limit: form.slot_limit,
      features: form.features.split('\n').map(f => f.trim()).filter(Boolean),
      placements: form.placements, visibility: form.visibility,
      display_order: form.display_order, is_active: form.is_active,
    }

    try {
      const res = editing
        ? await fetch(`/api/v1/admin/adverts/plans/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/v1/admin/adverts/plans',                { method: 'POST',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Kuna tatizo'); return }
      showToast(editing ? '✅ Mpango umehifadhiwa!' : '✅ Mpango mpya umeundwa!')
      await load(); closeForm()
    } catch { setError('Haikuweza kuhifadhi. Jaribu tena.') }
    finally { setSaving(false) }
  }

  async function deletePlan(p: Plan) {
    const res = await fetch(`/api/v1/admin/adverts/plans/${p.id}`, { method: 'DELETE' })
    const d   = await res.json()
    showToast(d.deactivated ? '⚠️ Mpango una kampeni — umesimamishwa badala ya kufutwa' : '🗑 Mpango umefutwa')
    setConfirmDel(null); await load()
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
    <div className="min-h-screen bg-gray-50/60">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[300] px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white animate-in slide-in-from-top-2 ${toast.ok ? 'bg-gray-900' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDel && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmDel(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center mb-3">🗑</div>
            <h3 className="font-bold text-gray-900 mb-1">Futa Mpango</h3>
            <p className="text-sm text-gray-500 mb-4">Una uhakika unataka kufuta <span className="font-semibold text-gray-800">{confirmDel.name}</span>? Hatua hii haiwezi kurudishwa.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Ghairi</button>
              <button onClick={() => deletePlan(confirmDel)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700">Futa</button>
            </div>
          </div>
        </div>
      )}

      {/* Form drawer */}
      {showForm && (
        <div className="fixed inset-0 z-[200] flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={closeForm} />
          <div className="relative bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl">

            {/* Drawer header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="font-bold text-gray-900">{editing ? `Hariri Mpango` : 'Mpango Mpya'}</h2>
                {editing && <p className="text-xs text-gray-400 mt-0.5">{editing.name}</p>}
              </div>
              <button onClick={closeForm} className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 transition">×</button>
            </div>

            <div className="p-6 space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
              )}

              {/* Type toggle */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Aina ya Mpango</label>
                <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                  {[{ v: false, label: 'Aina Moja' }, { v: true, label: 'Bundle (Aina Nyingi)' }].map(opt => (
                    <button key={String(opt.v)} onClick={() => switchMode(opt.v)}
                      className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${!form.is_bundle === !opt.v ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Basic info */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Taarifa za Msingi</label>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jina la Mpango *</label>
                    <input value={form.name} onChange={e => set('name', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                      placeholder="Mfano: Basic Bundle — Directory + Nearby" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Maelezo</label>
                    <input value={form.description} onChange={e => set('description', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                      placeholder="Maelezo mafupi..." />
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Bei na Muda</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bei (TZS) *</label>
                    <input type="number" value={form.price_tzs} onChange={e => set('price_tzs', Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Muda (siku) *</label>
                    <input type="number" value={form.duration_days} onChange={e => set('duration_days', Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nafasi</label>
                    <input type="number" value={form.slot_limit} onChange={e => set('slot_limit', Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  </div>
                </div>
              </div>

              {/* Ad type selector */}
              {!form.is_bundle ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Aina ya Tangazo *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {AD_TYPES.map(t => (
                      <button key={t.value} onClick={() => { set('ad_type', t.value); set('bundle_types', [t.value]) }}
                        className={`py-2.5 px-3 text-sm font-medium rounded-xl border transition text-left ${
                          form.ad_type === t.value ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Aina za Matangazo *</label>
                  <p className="text-xs text-amber-600 mb-3">Directory ni lazima kwa mipango yote</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {AD_TYPES.map(t => {
                      const isSelected = form.bundle_types.includes(t.value)
                      const isLocked   = t.value === 'directory'
                      return (
                        <label key={t.value}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-sm transition ${
                            isSelected
                              ? isLocked ? 'border-amber-300 bg-amber-50 text-amber-700 cursor-not-allowed' : 'border-primary-400 bg-primary-50 text-primary-700 cursor-pointer'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300 cursor-pointer'
                          }`}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleBundleType(t.value)} disabled={isLocked} className="accent-primary-500" />
                          {t.label}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Visibility */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Upatikanaji</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {VISIBILITY_OPTIONS.map(opt => (
                    <label key={opt.value}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                        form.visibility === opt.value ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <input type="radio" name="visibility" value={opt.value} checked={form.visibility === opt.value}
                        onChange={() => set('visibility', opt.value)} className="accent-primary-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">{opt.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Placements */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Maeneo ya Kuonyesha *</label>
                <p className="text-xs text-gray-400 mb-3">Wapi matangazo ya mpango huu yataonekana kwenye app</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PLACEMENT_OPTIONS.map(opt => (
                    <label key={opt.value}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer text-sm transition ${
                        form.placements.includes(opt.value) ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}>
                      <input type="checkbox" checked={form.placements.includes(opt.value)} onChange={() => togglePlacement(opt.value)} className="accent-primary-500" />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Features */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Vipengele</label>
                <textarea value={form.features} onChange={e => set('features', e.target.value)} rows={4}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none font-mono"
                  placeholder={"Nafasi 5 kwa mkoa\nInaonekana kwa wateja\nUjumbe wa WhatsApp..."} />
                <p className="text-xs text-gray-400 mt-1">Mstari mmoja kwa kila kipengele</p>
              </div>

              {/* Settings row */}
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="accent-primary-500" />
                  <label htmlFor="is_active" className="text-sm text-gray-700 font-medium">Mpango Unaofanya Kazi</label>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Mpangilio</label>
                  <input type="number" value={form.display_order} onChange={e => set('display_order', Number(e.target.value))}
                    className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 text-center" />
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pb-4">
                <button onClick={save} disabled={saving}
                  className="flex-1 bg-primary-500 text-white py-3 rounded-xl text-sm font-bold hover:bg-primary-600 disabled:opacity-50 transition">
                  {saving ? 'Inahifadhi...' : editing ? 'Hifadhi Mabadiliko' : 'Unda Mpango'}
                </button>
                <button onClick={closeForm}
                  className="border border-gray-300 text-gray-600 text-sm px-5 py-3 rounded-xl hover:bg-gray-50 transition font-medium">
                  Ghairi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <Link href="/admin/adverts" className="hover:text-gray-600 transition">← Kampeni</Link>
              <span>/</span>
              <span className="text-gray-600 font-medium">Mipango</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Mipango ya Matangazo</h1>
          </div>
          <button onClick={openCreate}
            className="bg-primary-500 text-white text-sm px-4 py-2.5 rounded-xl font-bold hover:bg-primary-600 transition flex items-center gap-1.5">
            + Mpango Mpya
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-5 max-w-5xl mx-auto">

        {/* Loading */}
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
          </div>
        )}

        {/* Plans table */}
        {!loading && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {plans.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-5xl mb-3">📋</div>
                <p className="font-semibold text-gray-600">Hakuna mipango bado</p>
                <p className="text-sm text-gray-400 mt-1 mb-5">Unda mpango wa kwanza wa matangazo</p>
                <button onClick={openCreate}
                  className="bg-primary-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-600 transition">
                  + Mpango Mpya
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Jina</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Aina</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Upatikanaji</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Bei</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Siku</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Hali</th>
                      <th className="px-4 py-3 w-24" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {plans.map(p => {
                      const isBundle = p.ad_type === 'bundle' || (p.bundle_types ?? []).length > 1
                      const types    = isBundle ? (p.bundle_types ?? []) : [p.ad_type]
                      return (
                        <tr key={p.id} className="hover:bg-gray-50/60 transition group">
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-gray-800">{p.name}</p>
                            {p.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{p.description}</p>}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap gap-1">
                              {isBundle && (
                                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold">BUNDLE</span>
                              )}
                              {types.map(t => (
                                <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${TYPE_COLORS[t] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {t}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 hidden md:table-cell">
                            <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                              {VISIBILITY_OPTIONS.find(v => v.value === (p.visibility ?? 'new_campaign'))?.label ?? p.visibility}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-gray-800">
                            Tsh {p.price_tzs.toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-gray-500 hidden sm:table-cell">
                            {p.duration_days}d
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <button onClick={() => toggleActive(p)} title="Bonyeza kubadilisha hali"
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition ${p.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                              {p.is_active ? '● Hai' : '○ Imezimwa'}
                            </button>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition">
                              <button onClick={() => openEdit(p)}
                                className="text-xs border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition text-gray-600 font-medium">
                                Hariri
                              </button>
                              <button onClick={() => setConfirmDel(p)}
                                className="text-xs border border-red-200 text-red-500 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition">
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
            )}
          </div>
        )}
      </div>
    </div>
  )
}
