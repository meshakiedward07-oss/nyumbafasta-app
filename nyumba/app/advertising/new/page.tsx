'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { REGION_NAMES } from '@/lib/data/tanzania-locations'
import UploadCreative from '@/components/ads/UploadCreative'

type Plan = {
  id: string; name: string; ad_type: string; price_tzs: number
  duration_days: number; slot_limit: number; description: string | null; features: string[]
}

const CTA_TYPES = [
  { value: 'whatsapp', label: '💬 WhatsApp', placeholder: '255712345678' },
  { value: 'call',     label: '📞 Piga Simu', placeholder: '255712345678' },
  { value: 'website',  label: '🌐 Tovuti',    placeholder: 'https://...' },
]

const TYPE_LABELS: Record<string, string> = {
  banner: 'Banner Ad', search: 'Search Ad', nearby: 'Nearby Ad', video: 'Video Ad', featured: 'Featured Business',
}

function NewCampaignForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [plans, setPlans]         = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [advertiserOk, setAdvertiserOk] = useState<boolean | null>(null)
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null)

  const [form, setForm] = useState({
    plan_id: searchParams.get('plan') ?? '',
    ad_type: '', title: '', body_text: '',
    image_url: '', video_url: '',
    cta_type: 'whatsapp', cta_value: '',
    target_region: '', target_district: '', target_category: '',
  })

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  useEffect(() => {
    fetch('/api/v1/advertising/plans')
      .then(r => r.json())
      .then(d => setPlans(d.plans ?? []))
    fetch('/api/v1/advertising/me')
      .then(r => r.ok ? setAdvertiserOk(true) : setAdvertiserOk(false))
      .catch(() => setAdvertiserOk(false))
  }, [])

  useEffect(() => {
    if (form.plan_id && plans.length > 0) {
      const p = plans.find(pl => pl.id === form.plan_id)
      if (p) { setSelectedPlan(p); set('ad_type', p.ad_type) }
    }
  }, [form.plan_id, plans])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPlan) { setError('Tafadhali chagua mpango wa tangazo'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/v1/advertising/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Kuna tatizo')
        return
      }
      if (data.waiting_list) { router.push('/advertising/dashboard?waiting=1'); return }
      // Show creative upload step before going to dashboard
      setCreatedCampaignId(data.campaign.id)
    } catch { setError('Haikuweza kuunganika. Jaribu tena.') }
    finally { setLoading(false) }
  }

  // ── Creative upload step (shown after campaign is created) ──
  if (createdCampaignId) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">✓</span>
            <span className="text-sm text-green-600 font-medium">Kampeni imeundwa!</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Pakia Creative ya Tangazo</h1>
          <p className="text-gray-500 text-sm mt-1">
            Pakia picha au video — mfumo utatengeneza mifumo yote ya banner, nearby, na featured kiotomatiki.
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <UploadCreative
            campaignId={createdCampaignId}
            onDone={() => router.push('/advertising/dashboard?created=1')}
            onSkip={() => router.push('/advertising/dashboard?created=1')}
          />
        </div>
      </div>
    )
  }

  if (advertiserOk === false) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Akaunti Haikupatikana</h2>
        <p className="text-gray-500 text-sm mb-6">Jiandikishe kwanza kama mfanyabiashara ili uweze kuweka matangazo.</p>
        <a href="/advertising/register" className="bg-primary-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary-600 transition">
          Jiandikishe Bure
        </a>
      </div>
    )
  }

  const byType = plans.reduce<Record<string, Plan[]>>((acc, p) => {
    if (!acc[p.ad_type]) acc[p.ad_type] = []
    acc[p.ad_type].push(p)
    return acc
  }, {})

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Tangazo Jipya</h1>
        <p className="text-gray-500 text-sm mt-1">Jaza maelezo ya kampeni yako ya matangazo</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4">{error}</div>
      )}

      <form onSubmit={submit} className="space-y-5">
        {/* Plan selection */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h2 className="font-bold text-gray-700 mb-3">1. Chagua Mpango</h2>
          {Object.entries(byType).map(([type, typePlans]) => (
            <div key={type} className="mb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">{TYPE_LABELS[type] ?? type}</h3>
              <div className="grid grid-cols-1 gap-2">
                {typePlans.map(p => (
                  <label
                    key={p.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      form.plan_id === p.id
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio" name="plan_id" value={p.id}
                      checked={form.plan_id === p.id}
                      onChange={() => set('plan_id', p.id)}
                      className="accent-primary-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 text-sm">{p.name}</div>
                      {p.description && <div className="text-xs text-gray-500">{p.description}</div>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-primary-600 text-sm">TZS {p.price_tzs.toLocaleString()}</div>
                      <div className="text-xs text-gray-400">Siku {p.duration_days}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {plans.length === 0 && (
            <p className="text-sm text-gray-400">Mipango inapakia...</p>
          )}
        </div>

        {selectedPlan && (
          <>
            {/* Content */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <h2 className="font-bold text-gray-700 mb-3">2. Maudhui ya Tangazo</h2>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kichwa cha Tangazo *</label>
                  <input
                    required value={form.title}
                    onChange={e => set('title', e.target.value)}
                    maxLength={100}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    placeholder="Mfano: Pata Nyumba Bora Dar es Salaam..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Maelezo (hiari)</label>
                  <textarea
                    value={form.body_text}
                    onChange={e => set('body_text', e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                    placeholder="Eleza zaidi biashara au ofa yako..."
                  />
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 text-xs text-blue-700">
                  📸 Hatua inayofuata: baada ya kuwasilisha fomu hii, utapakia picha au video yako.
                  Mfumo utatengeneza kiotomatiki mifumo yote ya banner, nearby, na featured.
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <h2 className="font-bold text-gray-700 mb-3">3. Jinsi Wateja Wanavyowasiliana</h2>

              <div className="grid grid-cols-3 gap-2 mb-3">
                {CTA_TYPES.map(ct => (
                  <label
                    key={ct.value}
                    className={`text-center p-2.5 rounded-xl border cursor-pointer text-xs font-medium transition ${
                      form.cta_type === ct.value
                        ? 'border-primary-400 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio" name="cta_type" value={ct.value}
                      checked={form.cta_type === ct.value}
                      onChange={() => set('cta_type', ct.value)}
                      className="sr-only"
                    />
                    {ct.label}
                  </label>
                ))}
              </div>

              <input
                required value={form.cta_value}
                onChange={e => set('cta_value', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                placeholder={CTA_TYPES.find(ct => ct.value === form.cta_type)?.placeholder ?? ''}
              />
            </div>

            {/* Targeting */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <h2 className="font-bold text-gray-700 mb-3">4. Eneo la Tangazo</h2>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mkoa / Mji *</label>
                  <select
                    required value={form.target_region}
                    onChange={e => set('target_region', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  >
                    <option value="">Chagua mkoa...</option>
                    {(REGION_NAMES ?? []).map((r: string) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Wilaya (hiari)</label>
                  <input
                    value={form.target_district}
                    onChange={e => set('target_district', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    placeholder="Mfano: Kinondoni"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full bg-primary-500 text-white py-3 rounded-xl font-bold hover:bg-primary-600 transition disabled:opacity-50"
            >
              {loading ? 'Inawasilisha...' : 'Wasilisha Tangazo →'}
            </button>

            <p className="text-xs text-center text-gray-400">
              Tangazo lako litakaguliwa na timu yetu ndani ya saa 24. Baada ya kukaguliwa, utalipa ili lianze.
            </p>
          </>
        )}
      </form>
    </div>
  )
}

export default function NewCampaignPage() {
  return <Suspense><NewCampaignForm /></Suspense>
}
