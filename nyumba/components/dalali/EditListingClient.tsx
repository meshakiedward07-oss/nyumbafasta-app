'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { BulkPhotoUpload } from '@/components/listings/BulkPhotoUpload'
import type { LocationData } from '@/components/maps/ListingLocationPicker'
import { TANZANIA_REGIONS } from '@/lib/data/tanzania-locations'

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
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Imeshindwa kurekebisha')
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

  const stepTitles = ['Maelezo', 'Mahali', 'Huduma', 'Picha & Kagua']

  return (
    <div className="min-h-screen bg-gray-50 pb-10">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => step === 0 ? router.back() : setStep(s => s - 1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600">←</button>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-gray-900">Hariri Listing</h1>
            <p className="text-xs text-gray-400">Hatua {step + 1} ya 4 — {stepTitles[step]}</p>
          </div>
          {listing.status === 'active' && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
              <i className="ti ti-alert-triangle" aria-hidden="true" /> Itasubiri idhini tena
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
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 block">Aina ya Nyumba</label>
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
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Bei (Tsh / mwezi) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">Tsh</span>
                  <input type="number" inputMode="numeric" min="0" value={price} onChange={e => setPrice(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Vyumba</label>
                  <select value={bedrooms} onChange={e => setBedrooms(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                    <option value="">Si lazima</option>
                    {[1,2,3,4,5,6].map(n => <option key={n} value={n}>Vyumba {n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Samani</label>
                  <select value={furnished} onChange={e => setFurnished(e.target.value as Furnished)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                    <option value="empty">Bila Samani</option>
                    <option value="semi">Nusu Samani</option>
                    <option value="furnished">Ina Samani</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Maelezo</label>
                <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
              </div>
            </div>
          </>
        )}

        {/* STEP 1 — Mahali */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Mkoa *</label>
                <select value={region} onChange={e => setRegion(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Mtaa / Wilaya *</label>
                <input type="text" value={district} onChange={e => setDistrict(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300" />
              </div>
            </div>

            {/* Satellite location picker */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 block">
                <i className="ti ti-map-pin" aria-hidden="true" /> Pin ya Ramani (hiari)
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
              Huduma Zilizopo ({amenities.length} zilizochaguliwa)
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
                Picha za Nyumba
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
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-1"><i className="ti ti-clipboard-list" aria-hidden="true" />Muhtasari</h3>
              {[
                ['Aina', LISTING_TYPES.find(t => t.value === type)?.label ?? type],
                ['Bei', `Tsh ${parseInt(price || '0').toLocaleString()} / mwezi`],
                ['Mahali', `${district}, ${region}`],
                ['Huduma', `${amenities.length} zilizochaguliwa`],
                ['Picha', `${images.length} picha`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-gray-50 pb-1.5 last:border-0">
                  <span className="text-gray-400 text-xs">{label}</span>
                  <span className="text-gray-800 font-medium text-xs">{value}</span>
                </div>
              ))}
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
              ℹ️ Baada ya kubadilisha, listing itapitiwa tena na admin kabla ya kuonekana.
            </div>
          </>
        )}
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-100 px-4 pt-4 shadow-lg" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        {step < 3 ? (
          <button onClick={() => setStep(s => s + 1)} disabled={!canProceed}
            className="w-full bg-primary-500 text-white py-3.5 rounded-2xl text-sm font-semibold disabled:opacity-40 active:scale-95 transition-all">
            Endelea → {stepTitles[step + 1]}
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting || photosUploading}
            className="w-full bg-primary-500 text-white py-3.5 rounded-2xl text-sm font-semibold disabled:opacity-50 active:scale-95 transition-all">
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Inahifadhi...
              </span>
            ) : photosUploading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Subiri picha zikamilike...
              </span>
            ) : 'Hifadhi Mabadiliko'}
          </button>
        )}
      </div>
    </div>
  )
}
