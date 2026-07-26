'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { REGION_NAMES } from '@/lib/data/tanzania-locations'

const PROPERTY_TYPES = [
  { value: 'nyumba',    label: 'Nyumba', icon: 'home' },
  { value: 'apartment', label: 'Apartment', icon: 'building' },
  { value: 'chumba',   label: 'Chumba', icon: 'door' },
  { value: 'studio',   label: 'Studio', icon: 'lamp' },
  { value: 'duka',     label: 'Duka / Ofisi', icon: 'store' },
]

const FURNISHED = [
  { value: 'empty',     label: 'Bila Samani' },
  { value: 'semi',      label: 'Samani Kidogo' },
  { value: 'furnished', label: 'Samani Kamili' },
]

export default function OngezaMaliPage() {
  const router = useRouter()
  const [step,      setStep]      = useState(1)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [orgId,     setOrgId]     = useState<string | null>(null)
  const [orgLoaded, setOrgLoaded] = useState(false)

  // Form state
  const [type,          setType]          = useState('nyumba')
  const [title,         setTitle]         = useState('')
  const [region,        setRegion]        = useState('')
  const [district,      setDistrict]      = useState('')
  const [price_monthly, setPriceMonthly]  = useState('')
  const [bedrooms,      setBedrooms]      = useState('')
  const [furnished,     setFurnished]     = useState('empty')
  const [description,   setDescription]   = useState('')

  // Load orgId on first render
  if (!orgLoaded) {
    setOrgLoaded(true)
    fetch('/api/v1/organizations')
      .then(r => r.json())
      .then(d => {
        const orgs = d.organizations ?? []
        const primary = orgs.find((o: { role: string }) => o.role === 'owner') ?? orgs[0]
        if (primary) setOrgId(primary.organization.id)
      })
      .catch(() => {})
  }

  async function handleSubmit() {
    if (!orgId) { setError('Shirika halipatikani. Rudi nyuma ujaribu tena.'); return }
    if (!title.trim())   { setError('Jina la mali linahitajika'); return }
    if (!region)         { setError('Chagua mkoa'); return }
    if (!district.trim()) { setError('Wilaya inahitajika'); return }
    if (!price_monthly || Number(price_monthly) <= 0) { setError('Bei ya kodi inahitajika'); return }

    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/v1/organizations/${orgId}/mali`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:         title.trim(),
          type,
          region,
          district:      district.trim(),
          price_monthly: Number(price_monthly),
          bedrooms:      bedrooms ? Number(bedrooms) : null,
          furnished,
          description:   description.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Kuna tatizo'); return }
      router.push(`/property/mali/${data.listing.id}`)
    } catch {
      setError('Haikuweza kuunganika. Jaribu tena.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-3">
          <i className="ti ti-arrow-left" aria-hidden="true" />
          Rudi nyuma
        </button>
        <h1 className="text-xl font-bold text-gray-900">Ongeza Mali Mpya</h1>
        <p className="text-sm text-gray-500">Mali hii itasimamiwa na shirika lako</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2].map(s => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step >= s ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-400'
            }`}>
              {s}
            </div>
            <div className={`h-0.5 flex-1 rounded-full ${step > s ? 'bg-primary-500' : 'bg-gray-100'} ${s === 2 ? 'hidden' : ''}`} />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900">Aina ya Mali</h2>
            <div className="grid grid-cols-3 gap-2">
              {PROPERTY_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`p-3 rounded-xl border-2 text-center transition ${
                    type === t.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                  }`}
                >
                  <i className={`ti ti-${t.icon} text-2xl ${type === t.value ? 'text-primary-500' : 'text-gray-400'}`} aria-hidden="true" />
                  <p className={`text-xs font-medium mt-1 ${type === t.value ? 'text-primary-700' : 'text-gray-500'}`}>{t.label}</p>
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Jina la Mali *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="mfano: Nyumba ya Ghorofa 3, Kijitonyama"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Mkoa *</label>
                <select
                  value={region}
                  onChange={e => setRegion(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                >
                  <option value="">Chagua mkoa...</option>
                  {REGION_NAMES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Wilaya / Mtaa *</label>
                <input
                  type="text"
                  value={district}
                  onChange={e => setDistrict(e.target.value)}
                  placeholder="mfano: Kinondoni"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
            </div>

            <button
              onClick={() => {
                if (!title.trim() || !region || !district.trim()) { setError('Jaza sehemu zote zinazohitajika'); return }
                setError(null); setStep(2)
              }}
              className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold hover:bg-primary-600 transition"
            >
              Endelea
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900">Maelezo ya Bei</h2>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Bei ya Kodi (TZS/mwezi) *</label>
              <input
                type="number"
                value={price_monthly}
                onChange={e => setPriceMonthly(e.target.value)}
                placeholder="0"
                min="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Idadi ya Vyumba</label>
                <input
                  type="number"
                  value={bedrooms}
                  onChange={e => setBedrooms(e.target.value)}
                  placeholder="—"
                  min="0"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Samani</label>
                <select
                  value={furnished}
                  onChange={e => setFurnished(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                >
                  {FURNISHED.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Maelezo (hiari)</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Eleza zaidi kuhusu mali hii..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 py-3"
              >
                Rudi
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 bg-primary-500 text-white py-3 rounded-xl font-semibold hover:bg-primary-600 transition disabled:opacity-40"
              >
                {saving ? 'Inahifadhi...' : 'Hifadhi Mali'}
              </button>
            </div>
          </div>
        )}

        {error && step === 1 && (
          <p className="text-sm text-red-600 mt-3">{error}</p>
        )}
      </div>
    </div>
  )
}
