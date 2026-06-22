'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { TANZANIA_REGIONS, getDistricts } from '@/lib/data/tanzania-locations'
import { createClient } from '@/lib/supabase/client'
import { BulkPhotoUpload } from '@/components/listings/BulkPhotoUpload'
import { VideoUpload } from '@/components/listings/VideoUpload'

const LocationPickerMap = dynamic(
  () => import('@/components/dalali/LocationPickerMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full rounded-2xl bg-gray-100 animate-pulse" style={{ height: 260 }} />
    ),
  }
)

// ── Types ────────────────────────────────────────────────
type ListingType = 'chumba' | 'apartment' | 'nyumba' | 'studio' | 'duka'
type Furnished = 'furnished' | 'semi' | 'empty'

type FormData = {
  type: ListingType
  price_monthly: string
  bedrooms: string
  furnished: Furnished
  description: string
  region: string
  district: string
  amenities: string[]
  images: string[]
  video_url: string | null
  latitude: number | null
  longitude: number | null
  shop_size_sqm: string
  floor_level: string
  commercial_use: string
  listing_unit_type: 'single' | 'multi'
  total_capacity: string
  auto_deactivate_on_full: boolean
}

// ── Constants ────────────────────────────────────────────
const LISTING_TYPES: { value: ListingType; label: string; icon: string }[] = [
  { value: 'chumba',    label: 'Chumba',    icon: '🚪' },
  { value: 'apartment', label: 'Apartment', icon: '🏢' },
  { value: 'nyumba',    label: 'Nyumba',    icon: '🏠' },
  { value: 'studio',    label: 'Studio',    icon: '🛋' },
  { value: 'duka',      label: 'Duka',      icon: '🏪' },
]

const AMENITIES: { value: string; label: string; icon: string }[] = [
  { value: 'umeme',      label: 'Umeme',       icon: '⚡' },
  { value: 'maji',       label: 'Maji',        icon: '💧' },
  { value: 'wifi',       label: 'WiFi',        icon: '📶' },
  { value: 'parking',    label: 'Parking',     icon: '🚗' },
  { value: 'choo_ndani', label: 'Choo ndani',  icon: '🚿' },
  { value: 'daladala',   label: 'Daladala',    icon: '🚌' },
  { value: 'watchman',   label: 'Watchman',    icon: '💂' },
  { value: 'ac',         label: 'AC',          icon: '❄️' },
  { value: 'dstv',       label: 'DSTV',        icon: '📺' },
  { value: 'solar',      label: 'Solar',       icon: '☀️' },
  { value: 'soko',       label: 'Soko karibu', icon: '🛒' },
  { value: 'bustani',    label: 'Bustani',     icon: '🌿' },
]


// ── Step progress bar ────────────────────────────────────
function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 px-4 py-3">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-all ${
            i < current ? 'bg-primary-500' : i === current ? 'bg-primary-300' : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  )
}

// ── Main wizard ──────────────────────────────────────────
export default function AddListingWizard() {
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [photosUploading, setPhotosUploading] = useState(false)
  const [error, setError] = useState('')

  // ── Listing limit ─────────────────────────────────────────
  type LimitInfo = { limit: number; current: number; canAdd: boolean; remaining: number; plan: string | null }
  const [limitInfo, setLimitInfo]     = useState<LimitInfo | null>(null)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [extraCount, setExtraCount]   = useState(1)
  const [extraPhone, setExtraPhone]   = useState('')
  const [payingExtra, setPayingExtra] = useState(false)
  const [extraDone, setExtraDone]     = useState(false)

  const PLAN_LIMITS: Record<string, number> = { basic: 5, premium: 20, enterprise: 50 }

  useEffect(() => { loadLimit() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadLimit(): Promise<LimitInfo | null> {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const [{ data: sub }, { count }] = await Promise.all([
        supabase.from('subscriptions')
          .select('plan, extra_listings')
          .eq('dalali_id', user.id)
          .eq('status', 'active')
          .maybeSingle(),
        supabase.from('listings')
          .select('id', { count: 'exact', head: true })
          .eq('dalali_id', user.id)
          .in('status', ['active', 'pending']),
      ])

      const baseLim = PLAN_LIMITS[sub?.plan ?? ''] ?? 0
      const extra   = (sub as { extra_listings?: number } | null)?.extra_listings ?? 0
      const total   = baseLim + extra
      const current = count ?? 0
      const info: LimitInfo = { limit: total, current, canAdd: current < total, remaining: total - current, plan: sub?.plan ?? null }
      setLimitInfo(info)
      return info
    } catch {
      return null
    }
  }

  async function handleBuyExtra() {
    if (!extraPhone.trim()) { setError('Weka nambari ya simu'); return }
    setPayingExtra(true)
    setError('')
    try {
      const res  = await fetch('/api/v1/payments/extra-listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: extraCount, msisdn: extraPhone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Imeshindwa')
      setExtraDone(true)
      await loadLimit()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Hitilafu imetokea')
    } finally {
      setPayingExtra(false)
    }
  }

  const [form, setForm] = useState<FormData>({
    type: 'chumba',
    price_monthly: '',
    bedrooms: '',
    furnished: 'empty',
    description: '',
    region: '',
    district: '',
    amenities: [],
    images: [],
    video_url: null,
    latitude: null,
    longitude: null,
    shop_size_sqm: '',
    floor_level: '',
    commercial_use: '',
    listing_unit_type: 'single',
    total_capacity: '',
    auto_deactivate_on_full: true,
  })

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function toggleAmenity(value: string) {
    set('amenities', form.amenities.includes(value)
      ? form.amenities.filter(a => a !== value)
      : [...form.amenities, value]
    )
  }

  // ── Submit ────────────────────────────────────────────
  async function handleSubmit() {
    setError('')
    setSubmitting(true)
    try {
      // Check limit before posting
      const info = await loadLimit()
      if (info && !info.canAdd) {
        setShowLimitModal(true)
        setSubmitting(false)
        return
      }

      const res = await fetch('/api/v1/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          price_monthly: parseInt(form.price_monthly),
          bedrooms: form.type !== 'duka' && form.bedrooms ? parseInt(form.bedrooms) : null,
          shop_size_sqm: form.type === 'duka' && form.shop_size_sqm ? parseInt(form.shop_size_sqm) : null,
          floor_level: form.type === 'duka' && form.floor_level ? parseInt(form.floor_level) : null,
          commercial_use: form.type === 'duka' && form.commercial_use ? form.commercial_use : null,
          listing_unit_type: form.listing_unit_type,
          total_capacity: form.listing_unit_type === 'single' ? 1 : parseInt(form.total_capacity) || 1,
          auto_deactivate_on_full: form.auto_deactivate_on_full,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Imeshindwa kuunda listing')
      router.push('/dashboard?new=1')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Hitilafu imetokea')
      setSubmitting(false)
    }
  }

  // ── Step validation ───────────────────────────────────
  const canProceed = [
    form.type && form.price_monthly && parseInt(form.price_monthly) > 0,
    form.region && form.district.trim().length > 1,
    true, // amenities optional
    true, // preview — always can submit
  ][step]

  const stepTitles = ['Maelezo', 'Mahali', 'Huduma', 'Picha & Kagua']

  return (
    <div className="min-h-screen bg-gray-50 pb-10">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => step === 0 ? router.back() : setStep(s => s - 1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600"
          >
            ←
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-gray-900">Ongeza Listing</h1>
            <p className="text-xs text-gray-400">Hatua {step + 1} ya 4 — {stepTitles[step]}</p>
          </div>
        </div>
        <StepBar current={step} total={4} />
      </div>

      <div className="px-4 pt-4 space-y-4">

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            STEP 0 — Maelezo
        ══════════════════════════════════════════════ */}
        {step === 0 && (
          <>
            {/* Type selector */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 block">
                Aina ya Mali
              </label>
              <div className="grid grid-cols-2 gap-2">
                {LISTING_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => set('type', t.value)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      form.type === t.value
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <span className="text-xl">{t.icon}</span>
                    <span className={`text-sm font-medium ${form.type === t.value ? 'text-primary-700' : 'text-gray-700'}`}>
                      {t.label}
                    </span>
                    {form.type === t.value && <span className="ml-auto text-primary-500 text-sm">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Price + Bedrooms */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                  Bei ya Kodi (Tsh / mwezi) <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">Tsh</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    placeholder="150,000"
                    value={form.price_monthly}
                    onChange={e => set('price_monthly', e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-base
                               focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
              </div>

              {form.type !== 'duka' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      Vyumba vya Kulala
                    </label>
                    <select
                      value={form.bedrooms}
                      onChange={e => set('bedrooms', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base
                                 focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                    >
                      <option value="">Si lazima</option>
                      {[1,2,3,4,5,6].map(n => (
                        <option key={n} value={n}>Vyumba {n}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      Hali ya Samani
                    </label>
                    <select
                      value={form.furnished}
                      onChange={e => set('furnished', e.target.value as Furnished)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base
                                 focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                    >
                      <option value="empty">Empty</option>
                      <option value="semi">Semi-furnished</option>
                      <option value="furnished">Furnished</option>
                    </select>
                  </div>
                </div>
              )}

              {form.type === 'duka' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                        Ukubwa (m²)
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        placeholder="e.g. 40"
                        value={form.shop_size_sqm}
                        onChange={e => set('shop_size_sqm', e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base
                                   focus:outline-none focus:ring-2 focus:ring-primary-300"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                        Ghorofa
                      </label>
                      <select
                        value={form.floor_level}
                        onChange={e => set('floor_level', e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base
                                   focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                      >
                        <option value="">Chagua</option>
                        <option value="0">Chini (Ground)</option>
                        {[1,2,3,4,5].map(n => (
                          <option key={n} value={n}>Ghorofa {n}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      Matumizi ya Biashara
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Duka la rejareja, Ofisi, Ghala..."
                      value={form.commercial_use}
                      onChange={e => set('commercial_use', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base
                                 focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Unit type & capacity */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 block">
                Aina ya Upatikanaji
              </label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  onClick={() => set('listing_unit_type', 'single')}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    form.listing_unit_type === 'single'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <span className="text-xl">🏠</span>
                  <span className={`text-sm font-medium ${form.listing_unit_type === 'single' ? 'text-primary-700' : 'text-gray-700'}`}>
                    Moja tu
                  </span>
                  {form.listing_unit_type === 'single' && <span className="ml-auto text-primary-500 text-sm">✓</span>}
                </button>
                <button
                  onClick={() => set('listing_unit_type', 'multi')}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    form.listing_unit_type === 'multi'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <span className="text-xl">🏢</span>
                  <span className={`text-sm font-medium ${form.listing_unit_type === 'multi' ? 'text-primary-700' : 'text-gray-700'}`}>
                    Vyumba vingi
                  </span>
                  {form.listing_unit_type === 'multi' && <span className="ml-auto text-primary-500 text-sm">✓</span>}
                </button>
              </div>

              {form.listing_unit_type === 'multi' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      Idadi ya Vyumba / Nafasi
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="500"
                      placeholder="e.g. 10"
                      value={form.total_capacity}
                      onChange={e => set('total_capacity', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base
                                 focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => set('auto_deactivate_on_full', !form.auto_deactivate_on_full)}
                      className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
                        form.auto_deactivate_on_full ? 'bg-primary-500' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`block w-4 h-4 rounded-full bg-white shadow-sm transition-transform mx-1 ${
                        form.auto_deactivate_on_full ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                    <span className="text-xs text-gray-600">
                      Funga listing automatically inapojaa
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Maelezo (hiari)
              </label>
              <textarea
                rows={4}
                placeholder={form.type === 'duka' ? 'Elezea duka lako — eneo, jirani, masharti maalum...' : 'Elezea nyumba yako — eneo, jirani, masharti maalum...'}
                value={form.description}
                onChange={e => set('description', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base
                           focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{form.description.length}/500</p>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════
            STEP 1 — Mahali
        ══════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Mkoa <span className="text-red-400">*</span>
              </label>
              <select
                value={form.region}
                onChange={e => {
                  set('region', e.target.value)
                  set('district', '') // reset district when region changes
                }}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base
                           focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
              >
                <option value="">Chagua Mkoa</option>
                {TANZANIA_REGIONS.map(r => (
                  <option key={r.name} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Wilaya <span className="text-red-400">*</span>
              </label>
              {form.region && getDistricts(form.region).length > 0 ? (
                <select
                  value={form.district}
                  onChange={e => set('district', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base
                             focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                >
                  <option value="">Chagua Wilaya</option>
                  {getDistricts(form.region).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder={form.region ? 'Andika jina la wilaya' : 'Chagua mkoa kwanza'}
                  value={form.district}
                  onChange={e => set('district', e.target.value)}
                  disabled={!form.region}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base
                             focus:outline-none focus:ring-2 focus:ring-primary-300
                             disabled:bg-gray-50 disabled:text-gray-400"
                />
              )}
            </div>

            {/* Location picker map */}
            <div>
              <LocationPickerMap
                value={form.latitude !== null && form.longitude !== null
                  ? { lat: form.latitude, lng: form.longitude }
                  : null
                }
                onChange={coords => {
                  set('latitude',  coords?.lat ?? null)
                  set('longitude', coords?.lng ?? null)
                }}
                region={form.region}
              />
            </div>

            <div className="bg-primary-50 border border-primary-100 rounded-xl p-3 text-xs text-primary-700">
              📍 Weka mtaa au wilaya halisi. Pin ya ramani ni optional lakini inasaidia wateja kukupata.
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            STEP 2 — Huduma (Amenities)
        ══════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 block">
              Chagua Huduma Zilizopo ({form.amenities.length} zilizochaguliwa)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AMENITIES.map(a => {
                const selected = form.amenities.includes(a.value)
                return (
                  <button
                    key={a.value}
                    onClick={() => toggleAmenity(a.value)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                      selected
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <span className="text-lg leading-none">{a.icon}</span>
                    <span className={`text-xs font-medium flex-1 ${selected ? 'text-primary-700' : 'text-gray-600'}`}>
                      {a.label}
                    </span>
                    {selected && <span className="text-primary-500 text-xs">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            STEP 3 — Picha & Preview
        ══════════════════════════════════════════════ */}
        {step === 3 && (
          <>
            {/* Bulk photo upload */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 block">
                Picha za Nyumba
              </label>
              <BulkPhotoUpload
                onChange={(urls, uploading) => {
                  set('images', urls)
                  setPhotosUploading(uploading)
                }}
                maxPhotos={15}
              />
            </div>

            {/* ── Video upload ── */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 block">
                🎥 Video ya Nyumba (hiari)
              </label>
              <VideoUpload
                existingVideoUrl={form.video_url}
                onUploadComplete={(url) => set('video_url', url)}
                onRemove={() => set('video_url', null)}
              />
            </div>

            {/* Preview summary */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-3">📋 Muhtasari wa Listing</h3>
              <div className="space-y-2 text-sm">
                <Row label="Aina" value={LISTING_TYPES.find(t => t.value === form.type)?.label ?? form.type} />
                <Row label="Bei" value={`Tsh ${parseInt(form.price_monthly || '0').toLocaleString()} / mwezi`} />
                {form.type !== 'duka' && form.bedrooms && <Row label="Vyumba" value={`Vyumba ${form.bedrooms}`} />}
                {form.type !== 'duka' && (
                  <Row label="Samani" value={
                    form.furnished === 'furnished' ? 'Furnished'
                    : form.furnished === 'semi' ? 'Semi-furnished'
                    : 'Empty'
                  } />
                )}
                {form.type === 'duka' && form.shop_size_sqm && <Row label="Ukubwa" value={`${form.shop_size_sqm} m²`} />}
                {form.type === 'duka' && form.floor_level !== '' && <Row label="Ghorofa" value={form.floor_level === '0' ? 'Chini' : `Ghorofa ${form.floor_level}`} />}
                {form.type === 'duka' && form.commercial_use && <Row label="Matumizi" value={form.commercial_use} />}
                <Row label="Mahali" value={`${form.district}, ${form.region}`} />
                {form.amenities.length > 0 && (
                  <Row label="Huduma" value={`${form.amenities.length} zilizochaguliwa`} />
                )}
                <Row label="Picha" value={`${form.images.length} picha`} />
                {form.video_url && <Row label="Video" value="✅ Imepakiwa" />}
              </div>
            </div>

            {/* Status note */}
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
              ℹ️ Listing yako itapitiwa na admin kabla ya kuonekana kwa wateja. Kawaida inachukua masaa 24.
            </div>

            {/* Expiry info */}
            <div suppressHydrationWarning className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
              <span className="text-blue-500 flex-shrink-0">ℹ️</span>
              <p className="text-blue-700 text-xs">
                Listing yako itaonekana kwa wateja kwa siku 90 — hadi{' '}
                {new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('sw-TZ', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>
            </div>
          </>
        )}

      </div>

      {/* ── Fixed bottom CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 shadow-lg">
        {step < 3 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canProceed}
            className="w-full bg-primary-500 text-white py-3.5 rounded-2xl text-sm font-semibold
                       disabled:opacity-40 active:scale-95 transition-all"
          >
            Endelea → {stepTitles[step + 1]}
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting || photosUploading}
            className="w-full bg-primary-500 text-white py-3.5 rounded-2xl text-sm font-semibold
                       disabled:opacity-50 active:scale-95 transition-all"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Inatuma...
              </span>
            ) : photosUploading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Subiri picha zikamilike...
              </span>
            ) : '✅ Wasilisha Listing'}
          </button>
        )}
      </div>

      {/* ── Limit reached modal ── */}
      {showLimitModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setShowLimitModal(false)}>
          <div className="bg-white w-full rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <h3 className="font-bold text-lg text-gray-900 mb-1">📊 Umefika Limit ya Listings</h3>
            <p className="text-gray-500 text-sm mb-5">
              Plan yako inaruhusu listings <strong>{limitInfo?.limit ?? 0}</strong> tu.
              Una listings <strong>{limitInfo?.current ?? 0}</strong> active sasa hivi.
            </p>

            <div className="space-y-3">
              {/* Option 1 — Buy extra */}
              {!extraDone ? (
                <div className="border border-primary-200 rounded-2xl p-4 bg-primary-50">
                  <p className="font-semibold text-primary-800 mb-0.5">➕ Ongeza Listings za Ziada</p>
                  <p className="text-sm text-primary-600 mb-3">Tsh 2,000 kwa listing moja kwa mwezi</p>
                  <div className="flex items-center gap-3 mb-3">
                    <button onClick={() => setExtraCount(c => Math.max(1, c - 1))}
                      className="w-8 h-8 rounded-full bg-primary-200 text-primary-800 font-bold text-lg flex items-center justify-center">−</button>
                    <span className="font-bold text-xl text-primary-900 w-6 text-center">{extraCount}</span>
                    <button onClick={() => setExtraCount(c => Math.min(10, c + 1))}
                      className="w-8 h-8 rounded-full bg-primary-200 text-primary-800 font-bold text-lg flex items-center justify-center">+</button>
                    <span className="text-sm text-gray-500 ml-1">= Tsh {(extraCount * 2000).toLocaleString()}/mwezi</span>
                  </div>
                  <input
                    type="tel" inputMode="numeric"
                    placeholder="Nambari ya simu (e.g. 0712345678)"
                    value={extraPhone}
                    onChange={e => setExtraPhone(e.target.value)}
                    className="w-full text-base border border-primary-200 rounded-xl px-4 py-3 mb-3 focus:outline-none bg-white"
                  />
                  {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
                  <button onClick={handleBuyExtra} disabled={payingExtra}
                    className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-60">
                    {payingExtra ? 'Inatuma...' : `Lipa Tsh ${(extraCount * 2000).toLocaleString()}`}
                  </button>
                </div>
              ) : (
                <div className="border border-green-200 rounded-2xl p-4 bg-green-50 text-center">
                  <p className="text-3xl mb-1">✅</p>
                  <p className="font-semibold text-green-800">Listings {extraCount} za ziada zimeongezwa!</p>
                  <p className="text-sm text-green-600 mt-1">Sasa unaweza kuendelea.</p>
                  <button
                    onClick={() => { setShowLimitModal(false); setExtraDone(false); handleSubmit() }}
                    className="mt-3 w-full bg-green-500 text-white py-3 rounded-xl font-semibold text-sm">
                    Endelea Kupost Listing →
                  </button>
                </div>
              )}

              {/* Option 2 — Upgrade */}
              {limitInfo?.plan === 'basic' && !extraDone && (
                <div className="border border-amber-200 rounded-2xl p-4 bg-amber-50">
                  <p className="font-semibold text-amber-800 mb-0.5">⭐ Upgrade kwenda Premium</p>
                  <p className="text-sm text-amber-600 mb-1">Listings 20 + boost + verified badge + analytics</p>
                  <p className="font-bold text-amber-700">Tsh 25,000/mwezi</p>
                  <button onClick={() => router.push('/dashboard/subscription')}
                    className="mt-3 w-full bg-amber-500 text-white py-3 rounded-xl font-semibold text-sm">
                    Upgrade Sasa
                  </button>
                </div>
              )}

              {/* Option 3 — Delete old */}
              {!extraDone && (
                <button onClick={() => router.push('/dashboard/listings')}
                  className="w-full border border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-medium">
                  🗑️ Futa Listing Iliyopita Badala Yake
                </button>
              )}
            </div>

            {!extraDone && (
              <button onClick={() => setShowLimitModal(false)} className="mt-4 w-full text-gray-400 text-sm">
                Ghairi
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className="text-gray-800 font-medium text-xs text-right">{value}</span>
    </div>
  )
}
