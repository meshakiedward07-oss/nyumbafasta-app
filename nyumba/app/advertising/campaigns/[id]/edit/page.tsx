'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { REGION_NAMES } from '@/lib/data/tanzania-locations'

type Campaign = {
  id: string; title: string; body_text: string | null; cta_type: string | null; cta_value: string | null
  target_region: string; target_district: string | null; target_category: string | null
  admin_note: string | null; ad_type: string; status: string
}

const CTA_TYPES = [
  { value: 'whatsapp', label: '💬 WhatsApp', placeholder: '255712345678' },
  { value: 'call',     label: '📞 Piga Simu', placeholder: '255712345678' },
  { value: 'website',  label: '🌐 Tovuti',    placeholder: 'https://...' },
]

export default function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving,  setSaving]    = useState(false)
  const [error,   setError]     = useState('')
  const [success, setSuccess]   = useState(false)

  const [form, setForm] = useState({
    title: '', body_text: '', cta_type: 'whatsapp', cta_value: '',
    target_region: '', target_district: '', target_category: '',
  })

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  useEffect(() => {
    fetch(`/api/v1/advertising/campaigns/${id}`)
      .then(r => r.json())
      .then(d => {
        const c = d.campaign as Campaign
        if (!c) { setError('Kampeni haikupatikana'); setLoading(false); return }
        if (c.status !== 'rejected') {
          router.replace('/advertising/dashboard')
          return
        }
        setCampaign(c)
        setForm({
          title:           c.title,
          body_text:       c.body_text       ?? '',
          cta_type:        c.cta_type        ?? 'whatsapp',
          cta_value:       c.cta_value       ?? '',
          target_region:   c.target_region,
          target_district: c.target_district ?? '',
          target_category: c.target_category ?? '',
        })
        setLoading(false)
      })
      .catch(() => { setError('Imeshindwa kupakua data'); setLoading(false) })
  }, [id, router])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/v1/advertising/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:           form.title,
          body_text:       form.body_text       || null,
          cta_type:        form.cta_type        || null,
          cta_value:       form.cta_value       || null,
          target_region:   form.target_region,
          target_district: form.target_district  || null,
          target_category: form.target_category  || null,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Imeshindwa kuhifadhi'); return }
      setSuccess(true)
      setTimeout(() => router.push('/advertising/dashboard'), 2000)
    } catch {
      setError('Haikuweza kuunganika. Jaribu tena.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 space-y-3">
        {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-xl" />)}
      </div>
    )
  }

  if (error && !campaign) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center text-gray-500">
        <p className="mb-4">{error}</p>
        <Link href="/advertising/dashboard" className="text-primary-600 hover:underline text-sm">← Rudi Dashboard</Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Imehifadhiwa na Kuwasilishwa!</h2>
        <p className="text-gray-500 text-sm">Tangazo lako limewasilishwa tena kwa ukaguzi. Unabadilishwa...</p>
      </div>
    )
  }

  const cta = CTA_TYPES.find(c => c.value === form.cta_type) ?? CTA_TYPES[0]

  return (
    <div className="max-w-lg mx-auto py-8 px-4 pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/advertising/dashboard" className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
          ←
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-800">Rekebisha Tangazo</h1>
          <p className="text-xs text-gray-400">Fanya mabadiliko na uwasilishe tena kwa ukaguzi</p>
        </div>
      </div>

      {campaign?.admin_note && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
          <p className="text-xs font-bold text-red-600 mb-1">Sababu ya Kukataliwa:</p>
          <p className="text-sm text-red-700">{campaign.admin_note}</p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Kichwa cha Tangazo *</label>
          <input
            required value={form.title} onChange={e => set('title', e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            placeholder="Mfano: Kodi za Nyumba Dar es Salaam"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Maandishi ya Tangazo</label>
          <textarea
            value={form.body_text} onChange={e => set('body_text', e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
            placeholder="Elezea biashara yako kwa ufupi..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Mkoa *</label>
          <select
            required value={form.target_region} onChange={e => set('target_region', e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
          >
            <option value="">Chagua mkoa...</option>
            {REGION_NAMES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Aina ya Mawasiliano</label>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {CTA_TYPES.map(c => (
              <button
                key={c.value} type="button"
                onClick={() => set('cta_type', c.value)}
                className={`py-2 rounded-xl text-xs font-medium border transition ${
                  form.cta_type === c.value
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <input
            value={form.cta_value} onChange={e => set('cta_value', e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            placeholder={cta.placeholder}
          />
        </div>

        <button
          type="submit" disabled={saving}
          className="w-full bg-primary-500 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-primary-600 transition disabled:opacity-50 mt-2"
        >
          {saving ? 'Inahifadhi...' : '✅ Hifadhi na Wasilisha Tena →'}
        </button>
      </form>
    </div>
  )
}
