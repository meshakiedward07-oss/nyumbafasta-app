'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Advertiser = {
  id: string; business_name: string; business_category: string
  contact_phone: string; whatsapp_number: string | null
  city: string; district: string | null; description: string | null
  website_url: string | null; logo_url: string | null
}

export default function AdvertiserProfilePage() {
  const router = useRouter()
  const [advertiser, setAdvertiser] = useState<Advertiser | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const [form, setForm] = useState({
    business_name: '', business_category: '',
    contact_phone: '', whatsapp_number: '',
    city: '', district: '', description: '', website_url: '',
  })

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  useEffect(() => {
    fetch('/api/v1/advertising/me')
      .then(r => r.json())
      .then(d => {
        const adv = d.advertiser as Advertiser
        setAdvertiser(adv)
        setForm({
          business_name:     adv.business_name ?? '',
          business_category: adv.business_category ?? '',
          contact_phone:     adv.contact_phone ?? '',
          whatsapp_number:   adv.whatsapp_number ?? '',
          city:              adv.city ?? '',
          district:          adv.district ?? '',
          description:       adv.description ?? '',
          website_url:       adv.website_url ?? '',
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/v1/advertising/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const d = await res.json()
    if (res.ok) {
      setAdvertiser(d.advertiser)
      setToast({ msg: 'Imehifadhiwa!', ok: true })
    } else {
      setToast({ msg: d.error ?? 'Kuna tatizo', ok: false })
    }
    setSaving(false)
    setTimeout(() => setToast(null), 3000)
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Inapakia...</div>
  if (!advertiser) {
    router.replace('/advertising/login')
    return null
  }

  const missingWa = !advertiser.whatsapp_number

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-xl shadow-lg text-sm text-white font-medium ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          <i className="ti ti-arrow-left text-xl" />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Wasifu wa Mfanyabiashara</h1>
      </div>

      {missingWa && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-3 mb-5 text-sm text-red-800">
          ⚠️ <strong>Nambari ya WhatsApp haijawekwa.</strong> Wateja hawataweza kukufikia kupitia matangazo.
        </div>
      )}

      <form onSubmit={save} className="space-y-4 bg-white rounded-2xl border border-gray-200 p-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Jina la Biashara *</label>
          <input
            required value={form.business_name}
            onChange={e => set('business_name', e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Simu *</label>
            <input
              required type="tel" value={form.contact_phone}
              onChange={e => set('contact_phone', e.target.value)}
              placeholder="0712345678"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              WhatsApp <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="tel" value={form.whatsapp_number}
              onChange={e => set('whatsapp_number', e.target.value)}
              placeholder="255712345678"
              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 ${
                !form.whatsapp_number ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            />
            <p className="text-[11px] text-gray-400 mt-0.5">Wateja watawasiliana nawe hapa moja kwa moja</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mkoa / Mji *</label>
            <input
              required value={form.city}
              onChange={e => set('city', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Wilaya</label>
            <input
              value={form.district}
              onChange={e => set('district', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Maelezo ya Biashara</label>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tovuti</label>
          <input
            type="url" value={form.website_url}
            onChange={e => set('website_url', e.target.value)}
            placeholder="https://..."
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        <button
          type="submit" disabled={saving}
          className="w-full bg-primary-500 text-white py-3 rounded-xl font-bold hover:bg-primary-600 transition disabled:opacity-50"
        >
          {saving ? 'Inahifadhi...' : 'Hifadhi Mabadiliko'}
        </button>
      </form>
    </div>
  )
}
