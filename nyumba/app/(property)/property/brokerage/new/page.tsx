'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TANZANIA_REGIONS, getDistricts } from '@/lib/data/tanzania-locations'
import { BulkPhotoUpload } from '@/components/listings/BulkPhotoUpload'
import { VideoUpload } from '@/components/listings/VideoUpload'

const LISTING_TYPE_LABELS: Record<string, string> = {
  chumba:    'Chumba',
  apartment: 'Apartment',
  nyumba:    'Nyumba',
  studio:    'Studio',
  duka:      'Duka',
}

const FURNISHED_LABELS: Record<string, string> = {
  empty:     'Tupu (hayana samani)',
  semi:      'Semi-furnished',
  furnished: 'Imejazwa samani',
}

export default function BrokerageNewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const unitId = searchParams.get('unit_id')

  // Org info
  const [orgPhone,    setOrgPhone]    = useState('')
  const [orgName,     setOrgName]     = useState('')
  const [loadingOrg,  setLoadingOrg]  = useState(true)

  // Step
  const [step, setStep] = useState(1)

  // Listing fields
  const [title,         setTitle]         = useState('')
  const [listingType,   setListingType]   = useState('apartment')
  const [description,   setDescription]   = useState('')
  const [priceMonthly,  setPriceMonthly]  = useState('')
  const [depositMonths, setDepositMonths] = useState('1')
  const [bedrooms,      setBedrooms]      = useState('')
  const [furnished,     setFurnished]     = useState('empty')
  const [region,        setRegion]        = useState('')
  const [district,      setDistrict]      = useState('')
  const [ward,          setWard]          = useState('')
  const [mtaa,          setMtaa]          = useState('')
  const [amenities,     setAmenities]     = useState<string[]>([])

  // Media (direct device upload)
  const [images,          setImages]          = useState<string[]>([])
  const [photosUploading, setPhotosUploading] = useState(false)
  const [videoUrl,        setVideoUrl]        = useState<string | null>(null)
  const [videoUploading,  setVideoUploading]  = useState(false)

  // Contact
  const [orgContactName,  setOrgContactName]  = useState('')
  const [orgContactPhone, setOrgContactPhone] = useState('')

  // Agreement
  const [agreedBroker,     setAgreedBroker]     = useState(false)
  const [agreedCommission, setAgreedCommission] = useState(false)

  // Submission
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [done,       setDone]       = useState(false)

  const districts   = region ? getDistricts(region) : []
  const regionNames = TANZANIA_REGIONS.map(r => r.name)

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch('/api/v1/organizations')
        const data = await res.json()
        const orgs = data.organizations ?? []
        const primary = orgs.find((o: { role: string }) => o.role === 'owner') ?? orgs[0]
        if (primary) {
          const org = primary.organization
          setOrgPhone(org.phone ?? '')
          setOrgName(org.name ?? '')
          setOrgContactPhone(org.phone ?? '')
          setOrgContactName(org.name ?? '')
        }
      } catch { /* silent */ }
      finally { setLoadingOrg(false) }
    }
    load()
  }, [])

  function toggleAmenity(a: string) {
    setAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }

  // Quality gates
  const detailsValid = !!(title.trim() && priceMonthly && region && district)
  const mediaValid   = images.length >= 1 && videoUrl !== null && !photosUploading && !videoUploading
  const step1Valid   = detailsValid && mediaValid
  const step2Valid   = !!orgContactPhone.trim()
  const step3Valid   = agreedBroker && agreedCommission

  async function handleSubmit() {
    if (!step1Valid || !step2Valid || !step3Valid) return
    setSubmitting(true); setError(null)
    try {
      const res = await fetch('/api/v1/org/brokerage-requests', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id:           unitId || null,
          title:             title.trim(),
          listing_type:      listingType,
          description:       description.trim() || null,
          price_monthly:     Number(priceMonthly),
          deposit_months:    Number(depositMonths) || 1,
          bedrooms:          bedrooms ? Number(bedrooms) : null,
          furnished,
          region,
          district,
          ward:              ward.trim() || null,
          mtaa:              mtaa.trim() || null,
          amenities,
          images,
          video_url:         videoUrl,
          org_contact_name:  orgContactName.trim() || null,
          org_contact_phone: orgContactPhone.trim(),
          agreed_broker_terms: true,
          agreed_commission:   true,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Kuna tatizo. Jaribu tena.'); return }
      setDone(true)
    } catch {
      setError('Hitilafu ya mtandao. Jaribu tena.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingOrg) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="h-40 bg-gray-100 animate-pulse rounded-2xl" />
      </div>
    )
  }

  if (done) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="ti ti-circle-check text-5xl text-green-500" aria-hidden="true" />
        </div>
        <h1 className="font-bold text-gray-900 text-xl mb-2">Ombi Limewasilishwa!</h1>
        <p className="text-gray-500 text-sm max-w-xs mx-auto">
          Staff wa NyumbaFasta watapitia ombi lako na kukuwasiliana kupitia nambari yako.
          Kawaida inachukua saa 24-48.
        </p>
        <div className="mt-6 space-y-2">
          <button
            onClick={() => router.push('/property/brokerage')}
            className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold text-sm hover:bg-primary-600 transition"
          >
            Angalia Hali ya Maombi
          </button>
          <button
            onClick={() => router.push('/property/dashboard')}
            className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm hover:bg-gray-200 transition"
          >
            Rudi Dashibodini
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto pb-24">
      {/* Header */}
      <button
        onClick={() => step > 1 ? setStep(s => s - 1) : router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-5 min-h-[44px] -ml-1 px-1 rounded-xl active:bg-gray-100 transition"
      >
        <i className="ti ti-arrow-left text-base" aria-hidden="true" />
        {step > 1 ? 'Nyuma' : 'Brokerage'}
      </button>

      <h1 className="font-bold text-gray-900 text-xl">Ombi la Kutafuta Mpangaji</h1>
      <p className="text-sm text-gray-400 mt-0.5 mb-5">NyumbaFasta itatangaza na kukupata mpangaji</p>

      {/* Step bar */}
      <div className="flex items-center gap-2 mb-6">
        {[{ n: 1, label: 'Mali' }, { n: 2, label: 'Mawasiliano' }, { n: 3, label: 'Kukubaliana' }].map(({ n, label }, idx) => (
          <div key={n} className="flex items-center gap-2 flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-full h-2 rounded-full transition-all ${n <= step ? 'bg-primary-500' : 'bg-gray-200'}`} />
              <span className={`text-[9px] mt-1 font-semibold ${n <= step ? 'text-primary-600' : 'text-gray-300'}`}>{label}</span>
            </div>
            {idx < 2 && <div className="w-2 flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Listing details + media ─── */}
      {step === 1 && (
        <div className="space-y-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Hatua 1 ya 3 — Taarifa za Mali
          </p>

          {/* Title */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Jina la Tangazo *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="mfano: Apartment 2BR Masaki, karibu na bahari"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          {/* Type + Furnished */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Aina ya Mali *</label>
              <select value={listingType} onChange={e => setListingType(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                {Object.entries(LISTING_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Samani</label>
              <select value={furnished} onChange={e => setFurnished(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                {Object.entries(FURNISHED_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Bei/Mwezi (TZS) *</label>
            <input type="number" value={priceMonthly} onChange={e => setPriceMonthly(e.target.value)}
              placeholder="0" min="0"
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>

          {/* Bedrooms + Deposit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Vyumba vya Kulala</label>
              <input type="number" value={bedrooms} onChange={e => setBedrooms(e.target.value)}
                placeholder="—" min="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Amana (miezi)</label>
              <input type="number" value={depositMonths} onChange={e => setDepositMonths(e.target.value)}
                placeholder="1" min="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
          </div>

          {/* Region + District */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Mkoa *</label>
              <select value={region} onChange={e => { setRegion(e.target.value); setDistrict('') }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                <option value="">Chagua mkoa</option>
                {regionNames.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Wilaya *</label>
              <select value={district} onChange={e => setDistrict(e.target.value)} disabled={!region}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white disabled:opacity-50">
                <option value="">Chagua wilaya</option>
                {districts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Ward + Mtaa */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Kata (hiari)</label>
              <input value={ward} onChange={e => setWard(e.target.value)} placeholder="Kata"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Mtaa (hiari)</label>
              <input value={mtaa} onChange={e => setMtaa(e.target.value)} placeholder="Mtaa/Barabara"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Maelezo (hiari)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Elezea zaidi kuhusu nyumba/kitengo hiki..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
          </div>

          {/* Amenities */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Muundo na Huduma</label>
            <p className="text-[11px] text-gray-400 mb-2">Chagua vyumba na huduma zilizopo — zitatumika kwenye muhtasari wa tangazo</p>
            <div className="space-y-2.5">
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1.5 block">Vyumba</span>
                <div className="flex flex-wrap gap-2">
                  {['Sebule', 'Jikoni', 'Choo Ndani'].map(a => (
                    <button key={a} type="button" onClick={() => toggleAmenity(a)}
                      className={`text-xs px-3 py-2 rounded-full border font-medium transition active:scale-95 ${
                        amenities.includes(a) ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                      }`}>{a}</button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1.5 block">Huduma</span>
                <div className="flex flex-wrap gap-2">
                  {['WiFi', 'Umeme wa TANESCO', 'Maji ya bomba', 'Generator', 'Parking', 'Usalama 24/7', 'CCTV', 'Bwawa la kuogelea', 'Gym', 'Lifti', 'Balcony', 'AC', 'Mazingira ya watoto'].map(a => (
                    <button key={a} type="button" onClick={() => toggleAmenity(a)}
                      className={`text-xs px-3 py-2 rounded-full border font-medium transition active:scale-95 ${
                        amenities.includes(a) ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                      }`}>{a}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Quality gate: Photos (required) ── */}
          <div className={`rounded-2xl border-2 p-4 transition-colors ${images.length >= 1 ? 'border-primary-200 bg-primary-50/30' : 'border-dashed border-gray-300'}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${images.length >= 1 ? 'bg-primary-500' : 'bg-gray-200'}`}>
                {images.length >= 1
                  ? <i className="ti ti-check text-white text-[10px]" aria-hidden="true" />
                  : <span className="text-gray-400 text-[10px] font-bold">!</span>
                }
              </div>
              <label className="text-sm font-semibold text-gray-800">
                Picha za Mali <span className="text-red-500">*</span>
              </label>
              {images.length >= 1 && (
                <span className="ml-auto text-xs text-primary-600 font-medium">{images.length} picha ✓</span>
              )}
            </div>
            <BulkPhotoUpload
              onChange={(urls, uploading) => {
                setImages(urls)
                setPhotosUploading(uploading)
              }}
              maxPhotos={8}
            />
            {images.length === 0 && !photosUploading && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <i className="ti ti-alert-triangle" aria-hidden="true" />
                Lazima upake angalau picha 1 kabla ya kuendelea
              </p>
            )}
          </div>

          {/* ── Quality gate: Video (required) ── */}
          <div className={`rounded-2xl border-2 p-4 transition-colors ${videoUrl ? 'border-primary-200 bg-primary-50/30' : 'border-dashed border-gray-300'}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${videoUrl ? 'bg-primary-500' : 'bg-gray-200'}`}>
                {videoUrl
                  ? <i className="ti ti-check text-white text-[10px]" aria-hidden="true" />
                  : <span className="text-gray-400 text-[10px] font-bold">!</span>
                }
              </div>
              <label className="text-sm font-semibold text-gray-800">
                Video ya Mali <span className="text-red-500">*</span>
              </label>
              {videoUrl && (
                <span className="ml-auto text-xs text-primary-600 font-medium">Video iko ✓</span>
              )}
            </div>
            <VideoUpload
              existingVideoUrl={videoUrl}
              onUploadComplete={url => setVideoUrl(url)}
              onRemove={() => setVideoUrl(null)}
              onUploadStateChange={setVideoUploading}
            />
            {!videoUrl && !videoUploading && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <i className="ti ti-alert-triangle" aria-hidden="true" />
                Lazima upake video kabla ya kuendelea — inasaidia wateja kuona nyumba vizuri
              </p>
            )}
          </div>

          {/* Proceed button — blocked until both photo and video are uploaded */}
          <button
            onClick={() => setStep(2)}
            disabled={!step1Valid}
            className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold text-sm hover:bg-primary-600 transition disabled:opacity-40 mt-2"
          >
            {photosUploading || videoUploading ? 'Subiri upakiaji ukamilike...' : 'Endelea →'}
          </button>

          {detailsValid && !mediaValid && !photosUploading && !videoUploading && (
            <p className="text-center text-xs text-gray-400">
              {images.length === 0 && !videoUrl ? 'Picha na video zinahitajika' :
               images.length === 0 ? 'Picha inahitajika' : 'Video inahitajika'}
            </p>
          )}
        </div>
      )}

      {/* ── STEP 2: Contact info ─── */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Hatua 2 ya 3 — Mawasiliano
          </p>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 flex gap-2">
            <i className="ti ti-info-circle text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Nambari hii ndiyo itakayopelekwa kwa dalali wa NyumbaFasta. Mpangaji atakapopata mawasiliano,
              dalali atawasiliana nawe moja kwa moja.
            </span>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Jina la Mawasiliano</label>
            <input
              value={orgContactName}
              onChange={e => setOrgContactName(e.target.value)}
              placeholder={orgName || 'Jina la mwasiliani'}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Nambari ya Simu / WhatsApp *</label>
            <input
              type="tel"
              value={orgContactPhone}
              onChange={e => setOrgContactPhone(e.target.value)}
              placeholder="+255 7XX XXX XXX"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <p className="text-xs text-gray-400 mt-1">
              Imejazwa kutoka kwenye profaili ya shirika lako: {orgPhone || '—'}
            </p>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-700 mb-2">Muhtasari wa Ombi</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <span className="text-gray-400">Mali:</span>
              <span className="text-gray-700 font-medium truncate">{title}</span>
              <span className="text-gray-400">Aina:</span>
              <span className="text-gray-700">{LISTING_TYPE_LABELS[listingType]}</span>
              <span className="text-gray-400">Bei:</span>
              <span className="text-gray-700 font-semibold text-primary-600">
                TZS {Number(priceMonthly).toLocaleString()}/mwezi
              </span>
              <span className="text-gray-400">Eneo:</span>
              <span className="text-gray-700">{district}, {region}</span>
              <span className="text-gray-400">Picha:</span>
              <span className="text-gray-700">{images.length} zimepakiwa</span>
              <span className="text-gray-400">Video:</span>
              <span className={videoUrl ? 'text-primary-600 font-medium' : 'text-gray-400'}>
                {videoUrl ? '✓ Ipo' : '—'}
              </span>
              <span className="text-gray-400">Kamisheni:</span>
              <span className="text-gray-700 font-semibold">
                TZS {Number(priceMonthly).toLocaleString()} (mwezi 1)
              </span>
            </div>
          </div>

          <button
            onClick={() => setStep(3)}
            disabled={!step2Valid}
            className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold text-sm hover:bg-primary-600 transition disabled:opacity-40"
          >
            Endelea →
          </button>
        </div>
      )}

      {/* ── STEP 3: Agreement + Submit ─── */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Hatua 3 ya 3 — Makubaliano
          </p>

          <label className="flex gap-3 bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-primary-300 transition">
            <div className="flex-shrink-0 mt-0.5">
              <input type="checkbox" checked={agreedBroker} onChange={e => setAgreedBroker(e.target.checked)}
                className="w-4 h-4 accent-primary-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Nakubaliana na NyumbaFasta kutangaza kwa niaba yangu</p>
              <p className="text-xs text-gray-500 mt-1">
                NyumbaFasta itashughulikia utangazaji, mawasiliano ya awali na mpangaji,
                na kupanga miadi. Mamlaka ya biashara bado iko kwangu.
              </p>
            </div>
          </label>

          <label className="flex gap-3 bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-primary-300 transition">
            <div className="flex-shrink-0 mt-0.5">
              <input type="checkbox" checked={agreedCommission} onChange={e => setAgreedCommission(e.target.checked)}
                className="w-4 h-4 accent-primary-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Nakubaliana na masharti ya kamisheni</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Kamisheni ya{' '}
                <span className="font-bold text-primary-600">
                  TZS {Number(priceMonthly || 0).toLocaleString()}
                </span>{' '}
                (sawa na kodi ya mwezi mmoja) italipwa na <strong className="text-gray-700">mpangaji atakayeletwa na NyumbaFasta</strong> kwa shirika letu.
                Shirika letu litasaidia kukusanya kamisheni hiyo na kuiwasilisha kwa NyumbaFasta mara mkataba utakapofungwa.
              </p>
            </div>
          </label>

          <div className="bg-primary-50 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-primary-600 font-medium">Kamisheni itakayodaiwa</p>
              <p className="text-2xl font-bold text-primary-700 mt-0.5">
                TZS {Number(priceMonthly || 0).toLocaleString()}
              </p>
              <p className="text-xs text-primary-500">= Kodi ya mwezi 1 — inalipwa baada ya deal kufungwa</p>
            </div>
            <i className="ti ti-coin text-4xl text-primary-300" aria-hidden="true" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">
              <i className="ti ti-alert-circle mr-1" aria-hidden="true" />
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || !step3Valid}
            className="w-full bg-primary-500 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-primary-600 transition disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><i className="ti ti-loader-2 animate-spin" aria-hidden="true" />Inawasilisha...</>
            ) : (
              <><i className="ti ti-send" aria-hidden="true" />Wasilisha Ombi kwa NyumbaFasta</>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
