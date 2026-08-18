'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { TANZANIA_REGIONS, getDistricts, getWards } from '@/lib/data/tanzania-locations'
import { createClient } from '@/lib/supabase/client'
import { BulkPhotoUpload } from '@/components/listings/BulkPhotoUpload'
import { getListingLimit, getPhotoLimit, canUseFeature } from '@/lib/config/subscription-plans'
import { VideoUpload } from '@/components/listings/VideoUpload'
import { useDalaliProfile } from '@/lib/hooks/useDalaliProfile'
import CommissionField, { type CommissionState } from '@/components/listings/CommissionField'
import { formatCommission } from '@/lib/listings/commission'
import { useLanguage } from '@/lib/i18n/context'
import type { TKey } from '@/lib/i18n/translations'

const ListingLocationPicker = dynamic(
  () => import('@/components/maps/ListingLocationPicker'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full rounded-2xl bg-gray-100 animate-pulse" style={{ height: 320 }} />
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
  ward: string
  mtaa: string
  amenities: string[]
  images: string[]
  video_url: string | null
  latitude: number | null
  longitude: number | null
  address_full: string
  place_id: string
  shop_size_sqm: string
  floor_level: string
  commercial_use: string
  listing_unit_type: 'single' | 'multi'
  total_capacity: string
  auto_deactivate_on_full: boolean
}

// ── Constants ────────────────────────────────────────────
const LISTING_TYPES: { value: ListingType; label: string; icon: string }[] = [
  { value: 'chumba',    label: 'Chumba',    icon: 'door' },
  { value: 'apartment', label: 'Apartment', icon: 'building' },
  { value: 'nyumba',    label: 'Nyumba',    icon: 'home' },
  { value: 'studio',    label: 'Studio',    icon: 'sofa' },
  { value: 'duka',      label: 'Duka',      icon: 'building-store' },
]

const AMENITIES: { value: string; label: string; icon: string }[] = [
  { value: 'umeme',      label: 'Umeme',       icon: 'bolt' },
  { value: 'maji',       label: 'Maji',        icon: 'droplet' },
  { value: 'wifi',       label: 'WiFi',        icon: 'wifi' },
  { value: 'parking',    label: 'Parking',     icon: 'car' },
  { value: 'choo_ndani', label: 'Choo ndani',  icon: 'bath' },
  { value: 'daladala',   label: 'Daladala',    icon: 'bus' },
  { value: 'watchman',   label: 'Watchman',    icon: 'shield' },
  { value: 'ac',         label: 'AC',          icon: 'snowflake' },
  { value: 'dstv',       label: 'DSTV',        icon: 'device-tv' },
  { value: 'solar',      label: 'Solar',       icon: 'sun' },
  { value: 'soko',       label: 'Soko karibu', icon: 'shopping-cart' },
  { value: 'bustani',    label: 'Bustani',     icon: 'leaf' },
]


// ── Step progress bar ────────────────────────────────────
function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 px-4 py-3">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
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
  const { profile: dalaliProfile } = useDalaliProfile()
  const { t } = useLanguage()

  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [photosUploading, setPhotosUploading] = useState(false)
  const [videoUploading, setVideoUploading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState<{ autoApproved: boolean; listingId: string } | null>(null)

  // ── Listing limit ─────────────────────────────────────────
  type LimitInfo = { limit: number; current: number; canAdd: boolean; remaining: number; plan: string | null }
  const [limitInfo, setLimitInfo]     = useState<LimitInfo | null>(null)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [extraCount, setExtraCount]   = useState(1)
  const [extraPhone, setExtraPhone]   = useState('')
  const [payingExtra, setPayingExtra] = useState(false)
  const [extraDone, setExtraDone]     = useState(false)

  // Plan limits sourced from subscription-plans.ts — single source of truth


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
          .in('status', ['active', 'grace_period'])
          .maybeSingle(),
        supabase.from('listings')
          .select('id', { count: 'exact', head: true })
          .eq('dalali_id', user.id)
          .in('status', ['pending', 'active', 'taken', 'expired']),
      ])

      const baseLim = sub ? getListingLimit(sub.plan) : 0
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
    if (!extraPhone.trim()) { setError(t('wiz_err_phone_required')); return }
    setPayingExtra(true)
    setError('')
    try {
      const res  = await fetch('/api/v1/payments/extra-listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: extraCount, msisdn: extraPhone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('wiz_err_generic'))
      setExtraDone(true)
      await loadLimit()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('wiz_err_generic'))
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
    ward: '',
    mtaa: '',
    amenities: [],
    images: [],
    video_url: null,
    latitude: null,
    longitude: null,
    address_full: '',
    place_id: '',
    shop_size_sqm: '',
    floor_level: '',
    commercial_use: '',
    listing_unit_type: 'single',
    total_capacity: '',
    auto_deactivate_on_full: true,
  })

  const [commission, setCommission] = useState<CommissionState>({
    enabled: false, type: null, value: '', notes: '',
  })

  const supabase = createClient()
  const [draftKey, setDraftKey] = useState<string | null>(null)
  const [draftRestored, setDraftRestored] = useState(false)

  // Resolve user-scoped draft key on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setDraftKey(`add_listing_draft_${data.user.id}`)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Restore draft from localStorage once draftKey is known
  useEffect(() => {
    if (!draftKey) return
    try {
      const saved = localStorage.getItem(draftKey)
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Omit<FormData, 'images'>> & { _commission?: CommissionState }
        const { _commission, ...formData } = parsed
        setForm(prev => ({ ...prev, ...formData, images: prev.images }))
        if (_commission) setCommission(_commission)
        setDraftRestored(true)
      }
    } catch {}
  }, [draftKey])

  // Save draft to localStorage whenever form or commission changes (debounced 500ms)
  useEffect(() => {
    if (!draftKey) return
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { images: _images, ...formWithoutImages } = form
    const timer = setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify({ ...formWithoutImages, _commission: commission })) } catch {}
    }, 500)
    return () => clearTimeout(timer)
  }, [form, commission, draftKey])

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
      // Validate multi-unit capacity
      if (form.listing_unit_type === 'multi' && (!form.total_capacity || parseInt(form.total_capacity) < 1)) {
        setError(t('wiz_capacity_required'))
        setSubmitting(false)
        return
      }

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
          commission_type: commission.enabled && commission.type ? commission.type : null,
          commission_value: commission.enabled && commission.type && commission.value ? parseFloat(commission.value) : null,
          commission_notes: commission.enabled && commission.notes.trim() ? commission.notes.trim() : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('wiz_err_create_failed'))
      try { if (draftKey) localStorage.removeItem(draftKey) } catch {}
      setSubmitted({ autoApproved: data.auto_approved === true, listingId: data.id })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('wiz_err_generic'))
      setSubmitting(false)
    }
  }

  // ── Quality checks (mirror server-side checkListingQuality) ──
  const qualityChecks = [
    {
      key: 'photos',
      label: t('wiz_qc_photos_label'),
      hint: t('wiz_qc_photos_hint').replace('{{n}}', String(form.images.length)),
      passed: form.images.length >= 3,
      required: true,
    },
    {
      key: 'description',
      label: t('wiz_qc_desc_label'),
      hint: t('wiz_qc_desc_hint').replace('{{n}}', String(form.description.trim().length)),
      passed: form.description.trim().length >= 30,
      required: true,
    },
    {
      key: 'ward',
      label: t('wiz_qc_ward_label'),
      hint: form.ward || t('wiz_qc_not_set'),
      passed: form.ward.trim().length > 1,
      required: true,
    },
    {
      key: 'amenities',
      label: t('wiz_qc_amenities_label'),
      hint: t('wiz_qc_amenities_hint').replace('{{n}}', String(form.amenities.length)),
      passed: form.amenities.length >= 1,
      required: false,
    },
    {
      key: 'location',
      label: t('wiz_qc_location_label'),
      hint: form.latitude !== null ? t('wiz_qc_location_set') : t('wiz_qc_not_set'),
      passed: form.latitude !== null && form.longitude !== null,
      required: false,
    },
  ]
  const allRequiredPassed = qualityChecks.filter(c => c.required).every(c => c.passed)

  // ── Step validation ───────────────────────────────────
  const canProceed = [
    !!(form.type && form.price_monthly && parseInt(form.price_monthly) > 0 && form.description.trim().length >= 30),
    !!(form.region && form.district.trim().length > 1 && form.ward.trim().length > 1),
    true, // amenities optional
    allRequiredPassed,
  ][step]

  const stepTitles = [
    t('edit_step_details'),
    t('edit_step_location'),
    t('edit_step_amenities'),
    t('edit_step_photos'),
  ]

  // Helper: translate listing type label using existing my_type_* keys
  const typeKeyMap: Record<ListingType, TKey> = {
    chumba:    'my_type_chumba',
    apartment: 'my_type_apartment',
    nyumba:    'my_type_nyumba',
    studio:    'my_type_studio',
    duka:      'my_type_duka',
  }

  // ── KYC gate — block unverified dalalis before they fill the form ────────
  // Admin sets verification_status = 'approved'; treat it the same as 'verified'.
  const isVerified = dalaliProfile?.verificationStatus === 'verified' || dalaliProfile?.verificationStatus === 'approved'
  if (dalaliProfile && !isVerified) {
    const isPending  = dalaliProfile.verificationStatus === 'pending'
    const isRejected = dalaliProfile.verificationStatus === 'rejected'
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 ${isPending ? 'bg-amber-50' : isRejected ? 'bg-red-50' : 'bg-blue-50'}`}>
          <i className={`ti text-4xl ${isPending ? 'ti-clock text-amber-500' : isRejected ? 'ti-alert-circle text-red-500' : 'ti-shield-check text-blue-500'}`} aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {isPending ? t('wiz_kyc_pending_title') : isRejected ? t('wiz_kyc_rejected_title') : t('wiz_kyc_unverified_title')}
        </h2>
        <p className="text-sm text-gray-500 mb-6 max-w-xs">
          {isPending
            ? t('wiz_kyc_pending_desc')
            : isRejected
            ? t('wiz_kyc_rejected_desc')
            : t('wiz_kyc_unverified_desc')}
        </p>
        <Link
          href="/dashboard/verify"
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition ${isPending ? 'bg-amber-500 hover:bg-amber-600' : isRejected ? 'bg-red-500 hover:bg-red-600' : 'bg-primary-500 hover:bg-primary-600'}`}
        >
          <i className="ti ti-shield-check" aria-hidden="true" />
          {isPending ? t('wiz_kyc_check_status') : isRejected ? t('wiz_kyc_resubmit') : t('wiz_kyc_verify_now')}
        </Link>
        <button onClick={() => router.back()} className="mt-4 text-sm text-gray-400 hover:text-gray-600">{t('wiz_kyc_go_back')}</button>
      </div>
    )
  }

  // ── Success screen ────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 ${submitted.autoApproved ? 'bg-green-100' : 'bg-amber-100'}`}>
          <i className={`ti text-4xl ${submitted.autoApproved ? 'ti-circle-check text-green-500' : 'ti-clock text-amber-500'}`} aria-hidden="true" />
        </div>
        {submitted.autoApproved ? (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('wiz_success_approved_title')}</h2>
            <p className="text-sm text-gray-500 mb-1">{t('wiz_success_approved_desc')}</p>
            <p className="text-xs text-green-600 mb-8 flex items-center justify-center gap-1">
              <i className="ti ti-stars" aria-hidden="true" /> {t('wiz_success_approved_quality')}
            </p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('wiz_success_pending_title')}</h2>
            <p className="text-sm text-gray-500 mb-1">{t('wiz_success_pending_desc')}</p>
            <p className="text-xs text-amber-600 mb-8">{t('wiz_success_pending_hours')}</p>
          </>
        )}
        <button
          onClick={() => { router.push('/dashboard'); router.refresh() }}
          className="w-full max-w-xs bg-primary-500 text-white py-3.5 rounded-2xl font-semibold text-sm mb-3"
        >
          {t('wiz_success_dashboard_btn')}
        </button>
        <button
          onClick={() => { setSubmitted(null); setStep(0); setCommission({ enabled: false, type: null, value: '', notes: '' }); setForm({ type: 'chumba', price_monthly: '', bedrooms: '', furnished: 'empty', description: '', region: '', district: '', ward: '', mtaa: '', amenities: [], images: [], video_url: null, latitude: null, longitude: null, address_full: '', place_id: '', shop_size_sqm: '', floor_level: '', commercial_use: '', listing_unit_type: 'single', total_capacity: '', auto_deactivate_on_full: true }) }}
          className="text-sm text-gray-400 underline"
        >
          {t('wiz_success_add_another')}
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">

      {/* Draft restored banner */}
      {draftRestored && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-700 flex items-center gap-1.5">
            <i className="ti ti-file-text" aria-hidden="true" /> {t('wiz_draft_restored')}
          </p>
          <button
            onClick={() => {
              setForm({ type: 'chumba', price_monthly: '', bedrooms: '', furnished: 'empty', description: '', region: '', district: '', ward: '', mtaa: '', amenities: [], images: [], video_url: null, latitude: null, longitude: null, address_full: '', place_id: '', shop_size_sqm: '', floor_level: '', commercial_use: '', listing_unit_type: 'single', total_capacity: '', auto_deactivate_on_full: true })
              setCommission({ enabled: false, type: null, value: '', notes: '' })
              try { if (draftKey) localStorage.removeItem(draftKey) } catch {}
              setDraftRestored(false)
            }}
            className="text-xs text-amber-600 font-medium underline"
          >
            {t('wiz_draft_reset')}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => step === 0 ? router.back() : setStep(s => s - 1)}
            aria-label={t('wiz_kyc_go_back')}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-gray-100 text-gray-600"
          >
            ←
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-gray-900">{t('wiz_header_title')}</h1>
            <p className="text-xs text-gray-400">
              {t('wiz_header_step')
                .replace('{{step}}', String(step + 1))
                .replace('{{title}}', stepTitles[step])}
            </p>
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
                {t('wiz_type_label')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {LISTING_TYPES.map((lt, i) => (
                  <button
                    key={lt.value}
                    onClick={() => set('type', lt.value)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      form.type === lt.value
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-100 bg-gray-50'
                    } ${i === LISTING_TYPES.length - 1 && LISTING_TYPES.length % 2 !== 0 ? 'col-span-2' : ''}`}
                  >
                    <i className={`ti ti-${lt.icon} text-xl`} aria-hidden="true" />
                    <span className={`text-sm font-medium ${form.type === lt.value ? 'text-primary-700' : 'text-gray-700'}`}>
                      {t(typeKeyMap[lt.value])}
                    </span>
                    {form.type === lt.value && <i className="ti ti-check ml-auto text-primary-500 text-sm" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Price + Bedrooms */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                  {t('wiz_price_label')} <span className="text-red-400">*</span>
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
                {form.price_monthly && parseInt(form.price_monthly) <= 0 && (
                  <p className="text-xs text-red-500 mt-1">{t('wiz_price_error')}</p>
                )}
              </div>

              {form.type !== 'duka' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      {t('wiz_rooms_label')}
                    </label>
                    <select
                      value={form.bedrooms}
                      onChange={e => set('bedrooms', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base
                                 focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                    >
                      <option value="">{t('edit_optional')}</option>
                      {[1,2,3,4,5,6].map(n => (
                        <option key={n} value={n}>{t('wiz_rooms_n').replace('{{n}}', String(n))}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      {t('wiz_furnished_label')}
                    </label>
                    <select
                      value={form.furnished}
                      onChange={e => set('furnished', e.target.value as Furnished)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base
                                 focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                    >
                      <option value="empty">{t('edit_furnished_empty')}</option>
                      <option value="semi">{t('edit_furnished_semi')}</option>
                      <option value="furnished">{t('edit_furnished_yes')}</option>
                    </select>
                  </div>
                </div>
              )}

              {form.type === 'duka' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                        {t('wiz_size_label')}
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
                        {t('wiz_floor_label')}
                      </label>
                      <select
                        value={form.floor_level}
                        onChange={e => set('floor_level', e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base
                                   focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                      >
                        <option value="">{t('wiz_floor_choose')}</option>
                        <option value="0">{t('wiz_floor_ground')}</option>
                        {[1,2,3,4,5].map(n => (
                          <option key={n} value={n}>{t('wiz_floor_n').replace('{{n}}', String(n))}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      {t('wiz_commercial_use')}
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
                {t('wiz_unit_type_label')}
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
                  <i className="ti ti-home text-xl" aria-hidden="true" />
                  <span className={`text-sm font-medium ${form.listing_unit_type === 'single' ? 'text-primary-700' : 'text-gray-700'}`}>
                    {t('wiz_unit_single')}
                  </span>
                  {form.listing_unit_type === 'single' && <i className="ti ti-check ml-auto text-primary-500 text-sm" aria-hidden="true" />}
                </button>
                <button
                  onClick={() => set('listing_unit_type', 'multi')}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    form.listing_unit_type === 'multi'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <i className="ti ti-building text-xl" aria-hidden="true" />
                  <span className={`text-sm font-medium ${form.listing_unit_type === 'multi' ? 'text-primary-700' : 'text-gray-700'}`}>
                    {t('wiz_unit_multi')}
                  </span>
                  {form.listing_unit_type === 'multi' && <i className="ti ti-check ml-auto text-primary-500 text-sm" aria-hidden="true" />}
                </button>
              </div>

              {form.listing_unit_type === 'multi' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      {t('wiz_capacity_label')} <span className="text-red-400">*</span>
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
                    <p className="text-xs text-gray-400 mt-1.5 leading-snug">
                      <i className="ti ti-info-circle mr-1" aria-hidden="true" />
                      {t('wiz_capacity_hint')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      role="switch"
                      aria-checked={form.auto_deactivate_on_full}
                      aria-label={t('wiz_auto_deactivate')}
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
                      {t('wiz_auto_deactivate')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                {t('edit_desc_label')} <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={4}
                placeholder={form.type === 'duka' ? t('wiz_desc_placeholder_duka') : t('wiz_desc_placeholder')}
                value={form.description}
                onChange={e => set('description', e.target.value)}
                maxLength={500}
                className={`w-full border rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 resize-none ${
                  form.description.trim().length >= 30
                    ? 'border-green-300 focus:ring-green-200'
                    : form.description.length > 0
                    ? 'border-amber-300 focus:ring-amber-200'
                    : 'border-gray-200 focus:ring-primary-300'
                }`}
              />
              <div className="flex items-center justify-between mt-1">
                <p className={`text-xs ${
                  form.description.trim().length >= 30 ? 'text-green-600' :
                  form.description.length > 0 ? 'text-amber-600' : 'text-gray-400'
                }`}>
                  {form.description.trim().length >= 30
                    ? t('wiz_desc_good')
                    : form.description.length > 0
                    ? t('wiz_desc_short').replace('{{n}}', String(form.description.trim().length))
                    : t('wiz_desc_min')}
                </p>
                <p className={`text-xs ${form.description.length >= 490 ? 'text-amber-500' : 'text-gray-400'}`}>
                  {form.description.length}/500
                </p>
              </div>
            </div>

            {/* Commission */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <CommissionField value={commission} onChange={setCommission} />
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
                {t('wiz_region_label')} <span className="text-red-400">*</span>
              </label>
              <select
                value={form.region}
                onChange={e => {
                  set('region', e.target.value)
                  set('district', '')
                  set('ward', '')
                  set('mtaa', '')
                }}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base
                           focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
              >
                <option value="">{t('wiz_region_choose')}</option>
                {TANZANIA_REGIONS.map(r => (
                  <option key={r.name} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                {t('wiz_district_label')} <span className="text-red-400">*</span>
              </label>
              {form.region && getDistricts(form.region).length > 0 ? (
                <select
                  value={form.district}
                  onChange={e => { set('district', e.target.value); set('ward', ''); set('mtaa', '') }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base
                             focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                >
                  <option value="">{t('wiz_district_choose')}</option>
                  {getDistricts(form.region).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder={form.region ? t('wiz_district_type') : t('wiz_district_choose_region')}
                  value={form.district}
                  onChange={e => { set('district', e.target.value); set('ward', ''); set('mtaa', '') }}
                  disabled={!form.region}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base
                             focus:outline-none focus:ring-2 focus:ring-primary-300
                             disabled:bg-gray-50 disabled:text-gray-400"
                />
              )}
            </div>

            {/* Kata (Ward) */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                {t('wiz_ward_label')} <span className="text-red-400">*</span>
              </label>
              {form.district && getWards(form.region, form.district).length > 0 ? (
                <select
                  value={form.ward}
                  onChange={e => set('ward', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base
                             focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                >
                  <option value="">{t('wiz_ward_choose')}</option>
                  {getWards(form.region, form.district).map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder={form.district ? t('wiz_ward_type') : t('wiz_ward_choose_district')}
                  value={form.ward}
                  onChange={e => set('ward', e.target.value)}
                  disabled={!form.district}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base
                             focus:outline-none focus:ring-2 focus:ring-primary-300
                             disabled:bg-gray-50 disabled:text-gray-400"
                />
              )}
              {!form.ward && form.district && (
                <p className="text-xs text-amber-600 mt-1">{t('wiz_ward_required')}</p>
              )}
            </div>

            {/* Mtaa / Kijiji */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                {t('wiz_mtaa_label')}
              </label>
              <input
                type="text"
                placeholder={form.district ? t('wiz_mtaa_placeholder') : t('wiz_ward_choose_district')}
                value={form.mtaa}
                onChange={e => set('mtaa', e.target.value)}
                disabled={!form.district}
                maxLength={100}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base
                           focus:outline-none focus:ring-2 focus:ring-primary-300
                           disabled:bg-gray-50 disabled:text-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1">{t('wiz_mtaa_hint')}</p>
            </div>

            {/* Location picker map */}
            <div>
              <ListingLocationPicker
                initialLocation={
                  form.latitude !== null && form.longitude !== null
                    ? {
                        latitude: form.latitude,
                        longitude: form.longitude,
                        address_full: form.address_full,
                        place_id: form.place_id || undefined,
                      }
                    : undefined
                }
                onLocationChange={loc => {
                  set('latitude', loc.latitude)
                  set('longitude', loc.longitude)
                  set('address_full', loc.address_full)
                  set('place_id', loc.place_id ?? '')
                }}
              />
            </div>

            <div className="bg-primary-50 border border-primary-100 rounded-xl p-3 text-xs text-primary-700">
              {t('wiz_location_tip')}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            STEP 2 — Huduma (Amenities)
        ══════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 block">
              {t('wiz_amenities_label').replace('{{n}}', String(form.amenities.length))}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AMENITIES.map(a => {
                const selected = form.amenities.includes(a.value)
                return (
                  <button
                    key={a.value}
                    onClick={() => toggleAmenity(a.value)}
                    aria-pressed={selected}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                      selected
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <i className={`ti ti-${a.icon} text-lg leading-none`} aria-hidden="true" />
                    <span className={`text-xs font-medium flex-1 ${selected ? 'text-primary-700' : 'text-gray-600'}`}>
                      {a.label}
                    </span>
                    {selected && <i className="ti ti-check text-primary-500 text-xs" aria-hidden="true" />}
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
                {t('edit_photos_label')}
              </label>
              <BulkPhotoUpload
                onChange={(urls, uploading) => {
                  set('images', urls)
                  setPhotosUploading(uploading)
                }}
                maxPhotos={getPhotoLimit(limitInfo?.plan)}
              />
              <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                <i className="ti ti-info-circle" aria-hidden="true" />
                {t('wiz_photos_plan_hint')
                  .replace('{{plan}}', limitInfo?.plan ?? 'free')
                  .replace('{{n}}', String(getPhotoLimit(limitInfo?.plan)))}
              </p>
            </div>

            {/* ── Video upload ── */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 block">
                <i className="ti ti-video" aria-hidden="true" /> {t('wiz_video_label')}
              </label>
              {canUseFeature(limitInfo?.plan, 'videos') ? (
                <VideoUpload
                  existingVideoUrl={form.video_url}
                  onUploadComplete={(url) => set('video_url', url)}
                  onRemove={() => set('video_url', null)}
                  onUploadStateChange={setVideoUploading}
                />
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                  <i className="ti ti-lock text-gray-400 text-2xl mb-1 block" aria-hidden="true" />
                  <p className="text-sm font-medium text-gray-600">{t('wiz_video_no_free')}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t('wiz_video_upgrade_hint')}</p>
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard/subscription')}
                    className="mt-3 text-xs bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold"
                  >
                    {t('dash_upgrade_now')}
                  </button>
                </div>
              )}
            </div>

            {/* Preview summary */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1"><i className="ti ti-clipboard-list" aria-hidden="true" />{t('wiz_summary_title')}</h3>
              <div className="space-y-2 text-sm">
                <Row label={t('wiz_sum_type')} value={t(typeKeyMap[form.type])} />
                <Row label={t('wiz_sum_price')} value={t('wiz_sum_price_val').replace('{{n}}', parseInt(form.price_monthly || '0').toLocaleString())} />
                {form.type !== 'duka' && form.bedrooms && <Row label={t('wiz_sum_rooms')} value={t('wiz_sum_rooms_val').replace('{{n}}', form.bedrooms)} />}
                {form.type !== 'duka' && (
                  <Row label={t('wiz_sum_furnished')} value={
                    form.furnished === 'furnished' ? t('edit_furnished_yes')
                    : form.furnished === 'semi' ? t('edit_furnished_semi')
                    : t('edit_furnished_empty')
                  } />
                )}
                {form.type === 'duka' && form.shop_size_sqm && <Row label={t('wiz_sum_size')} value={t('wiz_sum_size_val').replace('{{n}}', form.shop_size_sqm)} />}
                {form.type === 'duka' && form.floor_level !== '' && <Row label={t('wiz_sum_floor')} value={form.floor_level === '0' ? t('wiz_sum_floor_ground') : t('wiz_sum_floor_n').replace('{{n}}', form.floor_level)} />}
                {form.type === 'duka' && form.commercial_use && <Row label={t('wiz_sum_commercial')} value={form.commercial_use} />}
                <Row label={t('wiz_sum_location')} value={`${form.district}, ${form.region}`} />
                {form.ward && <Row label={t('wiz_sum_ward')} value={form.ward} />}
                {form.mtaa && <Row label={t('wiz_sum_mtaa')} value={form.mtaa} />}
                {form.amenities.length > 0 && (
                  <Row label={t('wiz_sum_amenities')} value={t('wiz_sum_amenities_val').replace('{{n}}', String(form.amenities.length))} />
                )}
                <Row label={t('wiz_sum_photos')} value={t('wiz_sum_photos_val').replace('{{n}}', String(form.images.length))} />
                {form.video_url && <Row label={t('wiz_sum_video')} value={t('wiz_sum_video_uploaded')} />}
                {commission.enabled && commission.type && (
                  <Row label={t('wiz_sum_commission')} value={formatCommission(commission.type, parseFloat(commission.value) || null)} />
                )}
              </div>

              {/* WhatsApp ya mawasiliano — read-only */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {t('wiz_contact_title')}
                </p>
                <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <i className="ti ti-device-mobile text-base" aria-hidden="true" />
                    <div>
                      <p className="text-xs text-gray-400">{t('wiz_contact_whatsapp')}</p>
                      <p className="text-sm font-medium text-gray-800">
                        {dalaliProfile?.whatsappNumber
                          ? `+${dalaliProfile.whatsappNumber}`
                          : <span className="text-amber-600">{t('wiz_contact_no_number')}</span>
                        }
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/dashboard/profile"
                    className="text-xs text-primary-600 font-medium underline"
                  >
                    {t('wiz_contact_change')}
                  </Link>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {t('wiz_contact_hint')}
                </p>
              </div>
            </div>

            {/* Quality checklist */}
            <div className={`rounded-2xl border p-4 ${allRequiredPassed ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <p className={`text-xs font-bold mb-3 flex items-center gap-1.5 ${allRequiredPassed ? 'text-green-700' : 'text-amber-700'}`}>
                <i className={`ti ${allRequiredPassed ? 'ti-stars text-green-500' : 'ti-list-check text-amber-500'}`} aria-hidden="true" />
                {t(allRequiredPassed ? 'wiz_quality_ready' : 'wiz_quality_incomplete')}
              </p>
              <div className="space-y-2">
                {qualityChecks.map(check => (
                  <div key={check.key} className="flex items-center gap-2.5">
                    <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                      check.passed
                        ? 'bg-green-500 text-white'
                        : check.required
                        ? 'bg-red-100 text-red-500 border border-red-300'
                        : 'bg-gray-100 text-gray-400 border border-gray-200'
                    }`}>
                      {check.passed ? '✓' : check.required ? '!' : '○'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-xs font-medium ${check.passed ? 'text-green-700' : check.required ? 'text-red-700' : 'text-gray-500'}`}>
                        {check.label}
                      </span>
                      {!check.required && <span className="text-[10px] text-gray-400 ml-1">{t('wiz_quality_optional')}</span>}
                    </div>
                    <span className={`text-[10px] font-mono ${check.passed ? 'text-green-600' : check.required ? 'text-red-500' : 'text-gray-400'}`}>
                      {check.hint}
                    </span>
                  </div>
                ))}
              </div>
              {!allRequiredPassed && (
                <p className="text-[10px] text-amber-600 mt-3 pt-2 border-t border-amber-200">
                  {t('wiz_quality_note')}
                </p>
              )}
            </div>

            {/* Expiry info */}
            <div suppressHydrationWarning className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
              <span className="text-blue-500 flex-shrink-0">ℹ️</span>
              <p className="text-blue-700 text-xs">
                {t('wiz_expiry_info').replace('{{date}}', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('sw-TZ', {
                  day: 'numeric', month: 'long', year: 'numeric',
                }))}
              </p>
            </div>
          </>
        )}

      </div>

      {/* ── Fixed bottom CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 px-4 pt-4 shadow-lg" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        {step < 3 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canProceed}
            className="w-full bg-primary-500 text-white py-3.5 rounded-2xl text-sm font-semibold
                       disabled:opacity-40 active:scale-95 transition-all"
          >
            {t('wiz_cta_continue').replace('{{title}}', stepTitles[step + 1])}
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting || photosUploading || videoUploading || !allRequiredPassed}
            className={`w-full py-3.5 rounded-2xl text-sm font-semibold disabled:opacity-50 active:scale-95 transition-all text-white ${
              allRequiredPassed ? 'bg-green-500' : 'bg-primary-500'
            }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('wiz_cta_publishing')}
              </span>
            ) : videoUploading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('wiz_cta_wait_video')}
              </span>
            ) : photosUploading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('edit_wait_photos')}
              </span>
            ) : allRequiredPassed ? (
              <span className="flex items-center justify-center gap-2">
                <i className="ti ti-stars" aria-hidden="true" /> {t('wiz_cta_publish')}
              </span>
            ) : t('wiz_cta_quality_first')}
          </button>
        )}
      </div>

      {/* ── Limit reached modal ── */}
      {showLimitModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setShowLimitModal(false)}>
          <div className="bg-white w-full rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <h3 className="font-bold text-lg text-gray-900 mb-1 flex items-center gap-2"><i className="ti ti-chart-bar" aria-hidden="true" />{t('wiz_limit_title')}</h3>
            <p className="text-gray-500 text-sm mb-5">
              {t('wiz_limit_desc')
                .replace('{{limit}}', String(limitInfo?.limit ?? 0))
                .replace('{{current}}', String(limitInfo?.current ?? 0))}
            </p>

            <div className="space-y-3">
              {/* Option 1 — Buy extra */}
              {!extraDone ? (
                <div className="border border-primary-200 rounded-2xl p-4 bg-primary-50">
                  <p className="font-semibold text-primary-800 mb-0.5 flex items-center gap-1"><i className="ti ti-plus" aria-hidden="true" />{t('wiz_limit_buy_extra_title')}</p>
                  <p className="text-sm text-primary-600 mb-3">{t('wiz_limit_buy_extra_price')}</p>
                  <div className="flex items-center gap-3 mb-3">
                    <button onClick={() => setExtraCount(c => Math.max(1, c - 1))}
                      className="min-w-[44px] min-h-[44px] rounded-full bg-primary-200 text-primary-800 font-bold text-lg flex items-center justify-center">−</button>
                    <span className="font-bold text-xl text-primary-900 w-6 text-center">{extraCount}</span>
                    <button onClick={() => setExtraCount(c => Math.min(10, c + 1))}
                      className="min-w-[44px] min-h-[44px] rounded-full bg-primary-200 text-primary-800 font-bold text-lg flex items-center justify-center">+</button>
                    <span className="text-sm text-gray-500 ml-1">{t('wiz_limit_extra_count').replace('{{n}}', (extraCount * 2000).toLocaleString())}</span>
                  </div>
                  <input
                    type="tel" inputMode="numeric"
                    placeholder={t('wiz_limit_phone_placeholder')}
                    value={extraPhone}
                    onChange={e => setExtraPhone(e.target.value)}
                    className="w-full text-base border border-primary-200 rounded-xl px-4 py-3 mb-3 focus:outline-none bg-white"
                  />
                  {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
                  <button onClick={handleBuyExtra} disabled={payingExtra}
                    className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-60">
                    {payingExtra ? t('wiz_limit_paying') : t('wiz_limit_pay_btn').replace('{{n}}', (extraCount * 2000).toLocaleString())}
                  </button>
                </div>
              ) : (
                <div className="border border-green-200 rounded-2xl p-4 bg-green-50 text-center">
                  <p className="text-3xl mb-1 flex justify-center"><i className="ti ti-circle-check text-primary-500" aria-hidden="true" /></p>
                  <p className="font-semibold text-green-800">{t('wiz_limit_success_msg').replace('{{n}}', String(extraCount))}</p>
                  <p className="text-sm text-green-600 mt-1">{t('wiz_limit_success_sub')}</p>
                  <button
                    onClick={() => { setShowLimitModal(false); setExtraDone(false); handleSubmit() }}
                    className="mt-3 w-full bg-green-500 text-white py-3 rounded-xl font-semibold text-sm">
                    {t('wiz_limit_continue_btn')}
                  </button>
                </div>
              )}

              {/* Option 2 — Upgrade */}
              {limitInfo?.plan === 'basic' && !extraDone && (
                <div className="border border-amber-200 rounded-2xl p-4 bg-amber-50">
                  <p className="font-semibold text-amber-800 mb-0.5"><i className="ti ti-star-filled mr-1" aria-hidden="true" />{t('wiz_limit_upgrade_title')}</p>
                  <p className="text-sm text-amber-600 mb-1">{t('wiz_limit_upgrade_desc')}</p>
                  <p className="font-bold text-amber-700">{t('wiz_limit_upgrade_price')}</p>
                  <button onClick={() => router.push('/dashboard/subscription')}
                    className="mt-3 w-full bg-amber-500 text-white py-3 rounded-xl font-semibold text-sm">
                    {t('dash_upgrade_now')}
                  </button>
                </div>
              )}

            </div>

            {!extraDone && (
              <button onClick={() => setShowLimitModal(false)} className="mt-4 w-full text-gray-400 text-sm">
                {t('wiz_limit_cancel')}
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
