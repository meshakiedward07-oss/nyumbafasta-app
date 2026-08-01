'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { TANZANIA_REGIONS } from '@/lib/data/tanzania-locations'

const AD_TYPES = ['banner', 'search', 'nearby', 'video', 'featured', 'directory', 'bundle']

type SlotConfig = {
  id: string
  ad_type: string
  region: string
  max_slots: number
  created_at: string
}

const AD_ICONS: Record<string, string> = {
  banner: '🎯', search: '🔍', nearby: '📍', video: '🎬', featured: '⭐', directory: '🏪', bundle: '📦',
}

export default function AdSlotConfigPage() {
  const [configs, setConfigs]   = useState<SlotConfig[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)
  const [form, setForm]         = useState({ ad_type: 'banner', region: 'Dar es Salaam', max_slots: 1 })

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/v1/admin/ads/slot-config')
    const d   = await res.json()
    setConfigs(d.configs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/v1/admin/ads/slot-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const d = await res.json()
    if (res.ok) {
      showToast('Imehifadhiwa ✓')
      load()
      setForm({ ad_type: 'banner', region: 'Dar es Salaam', max_slots: 1 })
    } else {
      showToast(d.error ?? 'Kuna tatizo', false)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const res = await fetch(`/api/v1/admin/ads/slot-config?id=${id}`, { method: 'DELETE' })
    if (res.ok) { showToast('Imefutwa'); load() }
    else showToast('Imeshindwa kufuta', false)
    setDeleting(null)
  }

  return (
    <div className="min-h-screen bg-gray-50/60">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white ${toast.ok ? 'bg-gray-900' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/admin/adverts"
            className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition flex-shrink-0">
            <i className="ti ti-arrow-left" />
          </Link>
          <div>
            <h1 className="font-bold text-gray-800 text-base">Mipangilio ya Nafasi za Matangazo</h1>
            <p className="text-xs text-gray-400 mt-0.5">Weka kikomo cha kampeni zinazoruhusuwa kwa mkoa na aina</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-5">

        {/* Add form */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
            <span>➕</span>
            <h2 className="text-sm font-bold text-gray-700">Ongeza Mipangilio Mipya</h2>
          </div>
          <form onSubmit={handleSave} className="p-5 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Aina ya Tangazo</label>
              <select
                value={form.ad_type}
                onChange={e => setForm(f => ({ ...f, ad_type: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                {AD_TYPES.map(t => (
                  <option key={t} value={t}>{AD_ICONS[t] ?? '📢'} {t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Mkoa</label>
              <select
                value={form.region}
                onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                {TANZANIA_REGIONS.map(r => (
                  <option key={r.name} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Idadi ya Juu (max_slots)</label>
              <input
                type="number" min={1} max={50}
                value={form.max_slots}
                onChange={e => setForm(f => ({ ...f, max_slots: parseInt(e.target.value) || 1 }))}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>

            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-primary-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-primary-600 transition disabled:opacity-50"
              >
                {saving ? 'Inahifadhi...' : 'Hifadhi'}
              </button>
            </div>
          </form>
        </div>

        {/* Config list */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
            <span>⚙️</span>
            <h2 className="text-sm font-bold text-gray-700">Mipangilio Iliyowekwa</h2>
            <span className="ml-auto text-xs text-gray-400">{configs.length} rekodi</span>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : configs.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-gray-400">Hakuna mipangilio. Ongeza hapo juu.</p>
              <p className="text-xs text-gray-300 mt-1">Bila mipangilio, mfumo unatumia kikomo cha mpango wa dalali.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {configs.map(c => (
                <div key={c.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="text-xl flex-shrink-0">{AD_ICONS[c.ad_type] ?? '📢'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-800">
                      {c.ad_type.charAt(0).toUpperCase() + c.ad_type.slice(1)} — {c.region}
                    </div>
                    <div className="text-xs text-gray-400">
                      Nafasi za juu: <span className="font-bold text-gray-700">{c.max_slots}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={deleting === c.id}
                    className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition disabled:opacity-40"
                  >
                    {deleting === c.id ? '...' : 'Futa'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center">
          Mipangilio hii inabatilisha kikomo cha mpango kwa mkoa husika.
          Bila rekodi, mfumo unatumia <code className="bg-gray-100 px-1 rounded">plan_slot_limit</code> ya mpango.
        </p>
      </div>
    </div>
  )
}
