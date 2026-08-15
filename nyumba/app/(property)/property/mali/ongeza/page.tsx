'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/context'
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
  const { t } = useLanguage()
  const router = useRouter()
  const [step,      setStep]      = useState(1)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [orgId,     setOrgId]     = useState<string | null>(null)
  const [limitHit,  setLimitHit]  = useState(false)
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
    if (!orgId) { setError(t('pr_ongeza_err_org')); return }
    if (!title.trim())   { setError(t('pr_ongeza_err_name')); return }
    if (!region)         { setError(t('pr_ongeza_err_region')); return }
    if (!district.trim()) { setError(t('pr_ongeza_err_district')); return }
    if (!price_monthly || Number(price_monthly) <= 0) { setError(t('pr_ongeza_err_price')); return }

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
      if (!res.ok) {
        if (data.upgrade_required) { setLimitHit(true); return }
        setError(data.error ?? 'Kuna tatizo'); return
      }
      router.push(`/property/mali/${data.listing.id}`)
    } catch {
      setError(t('pr_network_err'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto">
      {/* Upgrade gate overlay */}
      {limitHit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-center">
            <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ti ti-lock text-amber-500 text-3xl" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">{t('pr_ongeza_limit_title')}</h2>
            <p className="text-sm text-gray-500 mb-5">
              {t('pr_ongeza_limit_desc')}
            </p>
            <a href="/property/usajili"
              className="block w-full py-3 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition mb-3">
              {t('pr_ongeza_upgrade')}
            </a>
            <button onClick={() => setLimitHit(false)}
              className="text-sm text-gray-400 hover:text-gray-600">
              {t('pr_ongeza_back')}
            </button>
          </div>
        </div>
      )}

      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-3">
          <i className="ti ti-arrow-left" aria-hidden="true" />
          {t('pr_ongeza_back')}
        </button>
        <h1 className="text-xl font-bold text-gray-900">{t('pr_mali_ongeza_title')}</h1>
        <p className="text-sm text-gray-500">{t('pr_ongeza_sub')}</p>
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
            <h2 className="font-semibold text-gray-900">{t('pr_ongeza_step_type')}</h2>
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
              <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_mali_title_label')}</label>
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
                <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_ongeza_region_label')}</label>
                <select
                  value={region}
                  onChange={e => setRegion(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                >
                  <option value="">{t('pr_ongeza_region_ph')}</option>
                  {REGION_NAMES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_ongeza_district_label')}</label>
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
                if (!title.trim() || !region || !district.trim()) { setError(t('pr_err_required')); return }
                setError(null); setStep(2)
              }}
              className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold hover:bg-primary-600 transition"
            >
              {t('pr_continue')}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900">{t('pr_ongeza_step_details')}</h2>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_ongeza_rent_label')}</label>
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
                <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_ongeza_bedrooms_label')}</label>
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
                <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_ongeza_furnished_label')}</label>
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
              <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_unit_desc_label')}</label>
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
                {t('pr_back_btn')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 bg-primary-500 text-white py-3 rounded-xl font-semibold hover:bg-primary-600 transition disabled:opacity-40"
              >
                {saving ? t('pr_saving') : t('pr_ongeza_submit')}
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
