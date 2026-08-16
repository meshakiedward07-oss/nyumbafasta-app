'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/context'
import dynamic from 'next/dynamic'
import { BulkPhotoUpload } from '@/components/listings/BulkPhotoUpload'
import type { LocationData } from '@/components/maps/ListingLocationPicker'
import { TANZANIA_REGIONS } from '@/lib/data/tanzania-locations'
import CommissionField, { type CommissionState } from '@/components/listings/CommissionField'
import { formatCommission } from '@/lib/listings/commission'

const ListingLocationPicker = dynamic(
  () => import('@/components/maps/ListingLocationPicker'),
  { ssr: false, loading: () => <div className="h-[320px] bg-gray-100 rounded-2xl animate-pulse" /> }
)

type ListingType = 'chumba' | 'apartment' | 'nyumba' | 'studio' | 'duka'
type Furnished = 'furnished' | 'semi' | 'empty'

type ListingData = {
  id: string
  type: ListingType
  status: string
  price_monthly: number
  bedrooms: number | null
  furnished: Furnished
  description: string | null
  region: string
  district: string
  amenities: string[]
  images: string[]
  latitude: number | null
  longitude: number | null
  address_full: string | null
  place_id: string | null
  commission_type: string | null
  commission_value: number | null
  commission_notes: string | null
  listing_unit_type: 'single' | 'multi' | null
  total_capacity: number | null
  auto_deactivate_on_full: boolean | null
}

const LISTING_TYPES = [
  { value: 'chumba' as ListingType,    label: 'Chumba',    icon: 'door' },
  { value: 'apartment' as ListingType, label: 'Apartment', icon: 'building' },
  { value: 'nyumba' as ListingType,    label: 'Nyumba',    icon: 'home' },
  { value: 'studio' as ListingType,    label: 'Studio',    icon: 'sofa' },
  { value: 'duka' as ListingType,      label: 'Duka',      icon: 'building-store' },
]

const REGIONS = TANZANIA_REGIONS.map(r => r.name)

const AMENITIES = [
  { value: 'umeme', label: 'Umeme', icon: 'bolt' },
  { value: 'maji', label: 'Maji', icon: 'droplet' },
  { value: 'wifi', label: 'WiFi', icon: 'wifi' },
  { value: 'parking', label: 'Parking', icon: 'car' },
  { value: 'choo_ndani', label: 'Choo ndani', icon: 'bath' },
  { value: 'daladala', label: 'Daladala', icon: 'bus' },
  { value: 'watchman', label: 'Watchman', icon: 'shield' },
  { value: 'ac', label: 'AC', icon: 'snowflake' },
  { value: 'dstv', label: 'DSTV', icon: 'device-tv' },
  { value: 'solar', label: 'Solar', icon: 'sun' },
  { value: 'soko', label: 'Soko karibu', icon: 'shopping-cart' },
  { value: 'bustani', label: 'Bustani', icon: 'leaf' },
]


function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 px-4 py-3">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${
          i < current ? 'bg-primary-500' : i === current ? 'bg-primary-300' : 'bg-gray-200'
        }`} />
      ))}
    </div>
  )
}

export default function EditListingClient({ listing }: { listing: ListingData }) {
  const { t } = useLanguage()
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [photosUploading, setPhotosUploading] = useState(false)
  const [error, setError] = useState('')

  const [type, setType] = useState<ListingType>(listing.type)
  const [price, setPrice] = useState(String(listing.price_monthly))
  const [bedrooms, setBedrooms] = useState(String(listing.bedrooms ?? ''))
  const [furnished, setFurnished] = useState<Furnished>(listing.furnished)
  const [description, setDescription] = useState(listing.description ?? '')
  const [region, setRegion] = useState(listing.region)
  const [district, setDistrict] = useState(listing.district)
  const [amenities, setAmenities] = useState<string[]>(listing.amenities ?? [])
  const [images, setImages] = useState<string[]>(listing.images ?? [])
  const [latitude, setLatitude] = useState<number | null>(listing.latitude ?? null)
  const [longitude, setLongitude] = useState<number | null>(listing.longitude ?? null)
  const [addressFull, setAddressFull] = useState(listing.address_full ?? '')
  const [placeId, setPlaceId] = useState(listing.place_id ?? '')
  const [commission, setCommission] = useState<CommissionState>(() => {
    const type = listing.commission_type as CommissionState['type'] | null
    return type
      ? { enabled: true, type, value: String(listing.commission_value ?? ''), notes: listing.commission_notes ?? '' }
      : { enabled: false, type: null, value: '', notes: '' }
  })
  const [unitType, setUnitType] = useState<'single' | 'multi'>(listing.listing_unit_type === 'multi' ? 'multi' : 'single')
  const [totalCapacity, setTotalCapacity] = useState(String(listing.total_capacity ?? '1'))
  const [autoDeactivate, setAutoDeactivate] = useState(listing.auto_deactivate_on_full !== false)

  const draftKey = useMemo(() => `edit_listing_draft_${listing.id}`, [listing.id])

  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey)
      if (!saved) return
      const d = JSON.parse(saved)
      if (d.type)        setType(d.type)
      if (d.price)       setPrice(d.price)
      if (d.bedrooms !== undefined) setBedrooms(d.bedrooms)
      if (d.furnished)   setFurnished(d.furnished)
      if (d.description !== undefined) setDescription(d.description)
      if (d.region)      setRegion(d.region)
      if (d.district)    setDistrict(d.district)
      if (d.amenities)   setAmenities(d.amenities)
      if (d._commission) setCommission(d._commission)
      if (d.unitType)    setUnitType(d.unitType)
      if (d.totalCapacity !== undefined) setTotalCapacity(d.totalCapacity)
      if (d.autoDeactivate !== undefined) setAutoDeactivate(d.autoDeactivate)
    } catch {}
  }, [draftKey])

  // Save draft debounced 500ms on any change
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ type, price, bedrooms, furnished, description, region, district, amenities, _commission: commission, unitType, totalCapacity, autoDeactivate }))
      } catch {}
    }, 500)
    return () => clearTimeout(t)
  }, [type, price, bedrooms, furnished, description, region, district, amenities, commission, unitType, totalCapacity, autoDeactivate, draftKey])

  function handleLocationChange(loc: LocationData) {
    setLatitude(loc.latitude)
    setLongitude(loc.longitude)
    setAddressFull(loc.address_full)
    setPlaceId(loc.place_id ?? '')
  }

  function toggleAmenity(v: string) {
    setAmenities(prev => prev.includes(v) ? prev.filter(a => a !== v) : [...prev, v])
  }

  async function handleSubmit() {
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type, price_monthly: parseInt(price),
          bedrooms: bedrooms ? parseInt(bedrooms) : null,
          furnished, description, region, district, amenities, images,
          latitude, longitude,
          address_full: addressFull || null,
          place_id: placeId || null,
          commission_type: commission.enabled && commission.type ? commission.type : null,
          commission_value: commission.enabled && commission.type && commission.value ? parseFloat(commission.value) : null,
          commission_notes: commission.enabled && commission.notes.trim() ? commission.notes.trim() : null,
          listing_unit_type: unitType,
          total_capacity: unitType === 'multi' ? (parseInt(totalCapacity) || 1) : 1,
          auto_deactivate_on_full: autoDeactivate,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Imeshindwa kurekebisha')
      try { localStorage.removeItem(draftKey) } catch {}
      router.push('/dashboard?edited=1')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Hitilafu imetokea')
      setSubmitting(false)
    }
  }

  const canProceed = [
    type && price && parseInt(price) > 0,
    region && district.trim().length > 1,
    true,
    true,
  ][step]

  const stepTitles = [t('edit_step_details'), t('edit_step_location'), t('edit_step_amenities'), t('edit_step_photos')]

  return (
    <div className="min-h-screen bg-gray-50 pb-28">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => step === 0 ? router.back() : setStep(s => s - 1)}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-gray-100 text-gray-600">←</button>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-gray-900">{t('edit_title')}</h1>
            <p className="text-xs text-gray-400">{t('edit_step_of').replace('{{n}}', String(step + 1))}{stepTitles[step]}</p>
          </div>
          {listing.status === 'active' && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
              <i className="ti ti-alert-triangle" aria-hidden="true" /> {t('edit_pending_again')}
            </span>
          )}
        </div>
        <StepBar current={step} total={4} />
      </div>

      <div className="px-4 pt-4 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        {/* STEP 0 — Maelezo */}
        {step === 0 && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 block">{t('edit_listing_type')}</label>
              <div className="grid grid-cols-2 gap-2">
                {LISTING_TYPES.map((t, i) => (
                  <button key={t.value} onClick={() => setType(t.value)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      type === t.value ? 'border-primary-500 bg-primary-50' : 'border-gray-100 bg-gray-50'
                    } ${i === LISTING_TYPES.length - 1 && LISTING_TYPES.length % 2 !== 0 ? 'col-span-2' : ''}`}>
                    <i className={`ti ti-${t.icon} text-xl`} aria-hidden="true" />
                    <span className={`text-sm font-medium ${type === t.value ? 'text-primary-700' : 'text-gray-700'}`}>{t.label}</span>
                    {type === t.value && <i className="ti ti-check ml-auto text-primary-500 text-sm" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">{t('edit_price_label')}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">Tsh</span>
                  <input type="number" inputMode="numeric" min="0" value={price} onChange={e => setPrice(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">{t('edit_rooms_label')}</label>
                  <select value={bedrooms} onChange={e => setBedrooms(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                    <option value="">{t('edit_optional')}</option>
                    {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{t('edit_rooms_n')} {n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">{t('edit_furnished_label')}</label>
                  <select value={furnished} onChange={e => setFurnished(e.target.value as Furnished)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                    <option value="empty">{t('edit_furnished_empty')}</option>
                    <option value="semi">{t('edit_furnished_semi')}</option>
                    <option value="furnished">{t('edit_furnished_yes')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">{t('edit_desc_label')}</label>
                <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <CommissionField value={commission} onChange={setCommission} />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 block">
                Aina ya Upatikanaji
              </label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button onClick={() => setUnitType('single')}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    unitType === 'single' ? 'border-primary-500 bg-primary-50' : 'border-gray-100 bg-gray-50'
                  }`}>
                  <i className="ti ti-home text-xl" aria-hidden="true" />
                  <span className={`text-sm font-medium ${unitType === 'single' ? 'text-primary-700' : 'text-gray-700'}`}>Moja tu</span>
                  {unitType === 'single' && <i className="ti ti-check ml-auto text-primary-500 text-sm" aria-hidden="true" />}
                </button>
                <button onClick={() => setUnitType('multi')}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    unitType === 'multi' ? 'border-primary-500 bg-primary-50' : 'border-gray-100 bg-gray-50'
                  }`}>
                  <i className="ti ti-building text-xl" aria-hidden="true" />
                  <span className={`text-sm font-medium ${unitType === 'multi' ? 'text-primary-700' : 'text-gray-700'}`}>Nyingi</span>
                  {unitType === 'multi' && <i className="ti ti-check ml-auto text-primary-500 text-sm" aria-hidden="true" />}
                </button>
              </div>
              {unitType === 'multi' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      Idadi ya Vyumba/Vitengo
                    </label>
                    <input type="number" inputMode="numeric" min="1" max="500"
                      value={totalCapacity} onChange={e => setTotalCapacity(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  </div>
                  <div className="flex items-center gap-3">
                    <button role="switch" aria-checked={autoDeactivate}
                      onClick={() => setAutoDeactivate(v => !v)}
                      className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${autoDeactivate ? 'bg-primary-500' : 'bg-gray-200'}`}>
                      <span className={`block w-4 h-4 rounded-full bg-white shadow-sm transition-transform mx-1 ${autoDeactivate ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                    <span className="text-xs text-gray-600">Zima listing moja kwa moja ikijaa</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* STEP 1 — Mahali */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">{t('edit_region_label')}</label>
                <select value={region} onChange={e => setRegion(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">{t('edit_district_label')}</label>
                <input type="text" value={district} onChange={e => setDistrict(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
            </div>

            {/* Satellite location picker */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 block">
                <i className="ti ti-map-pin" aria-hidden="true" /> {t('edit_map_pin')}
              </label>
              <ListingLocationPicker
                initialLocation={
                  latitude !== null && longitude !== null
                    ? { latitude, longitude, address_full: addressFull, place_id: placeId || undefined }
                    : undefined
                }
                onLocationChange={handleLocationChange}
              />
            </div>
          </div>
        )}

        {/* STEP 2 — Huduma */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 block">
              {t('edit_amenities_sel')} ({amenities.length} {t('edit_selected')})
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AMENITIES.map(a => {
                const selected = amenities.includes(a.value)
                return (
                  <button key={a.value} onClick={() => toggleAmenity(a.value)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                      selected ? 'border-primary-500 bg-primary-50' : 'border-gray-100 bg-gray-50'
                    }`}>
                    <i className={`ti ti-${a.icon} text-lg leading-none`} aria-hidden="true" />
                    <span className={`text-xs font-medium flex-1 ${selected ? 'text-primary-700' : 'text-gray-600'}`}>{a.label}</span>
                    {selected && <i className="ti ti-check text-primary-500 text-xs" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* STEP 3 — Picha & Preview */}
        {step === 3 && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 block">
                {t('edit_photos_label')}
              </label>
              <BulkPhotoUpload
                existingImages={listing.images ?? []}
                onChange={(urls, uploading) => {
                  setImages(urls)
                  setPhotosUploading(uploading)
                }}
                maxPhotos={15}
              />
            </div>

            {/* Summary */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-2 text-sm">
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-1"><i className="ti ti-clipboard-list" aria-hidden="true" />{t('edit_summary')}</h3>
              {[
                [t('edit_sum_type'), LISTING_TYPES.find(lt => lt.value === type)?.label ?? type],
                [t('edit_sum_price'), `Tsh ${parseInt(price || '0').toLocaleString()} ${t('dash_per_month')}`],
                [t('edit_sum_location'), `${district}, ${region}`],
                [t('edit_sum_amenities'), `${amenities.length} ${t('edit_selected')}`],
                [t('edit_sum_photos'), `${images.length} ${t('edit_photos_count')}`],
                ...(commission.enabled && commission.type
                  ? [[t('edit_sum_commission'), formatCommission(commission.type, parseFloat(commission.value) || null)]]
                  : []),
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-gray-50 pb-1.5 last:border-0">
                  <span className="text-gray-400 text-xs">{label}</span>
                  <span className="text-gray-800 font-medium text-xs">{value}</span>
                </div>
              ))}
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
              ℹ️ {t('edit_review_notice')}
            </div>
          </>
        )}
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-100 px-4 pt-4 shadow-lg" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        {step < 3 ? (
          <button onClick={() => setStep(s => s + 1)} disabled={!canProceed}
            className="w-full bg-primary-500 text-white py-3.5 rounded-2xl text-sm font-semibold disabled:opacity-40 active:scale-95 transition-all">
            {t('edit_continue_to')} {stepTitles[step + 1]}
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting || photosUploading}
            className="w-full bg-primary-500 text-white py-3.5 rounded-2xl text-sm font-semibold disabled:opacity-50 active:scale-95 transition-all">
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('qe_saving')}
              </span>
            ) : photosUploading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('edit_wait_photos')}
              </span>
            ) : t('qe_save_btn')}
          </button>
        )}
      </div>
    </div>
  )
}
