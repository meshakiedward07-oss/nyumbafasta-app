'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TANZANIA_REGIONS, getDistricts } from '@/lib/data/tanzania-locations'

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

const AMENITY_OPTIONS = [
  'WiFi', 'Umeme wa TANESCO', 'Maji ya bomba', 'Generator',
  'Parking', 'Usalama 24/7', 'CCTV', 'Bwawa la kuogelea',
  'Gym', 'Lifti', 'Balcony', 'Jiko la gesi',
  'AC', 'Dsh/Starsat', 'Mazingira ya watoto', 'Uzio wa waya',
]

export default function BrokerageNewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const unitId = searchParams.get('unit_id')

  // Org info
  const [orgPhone,  setOrgPhone]  = useState('')
  const [orgName,   setOrgName]   = useState('')
  const [loadingOrg, setLoadingOrg] = useState(true)

  // Step
  const [step, setStep] = useState(1)

  // Listing card fields
  const [title,        setTitle]        = useState('')
  const [listingType,  setListingType]  = useState('apartment')
  const [description,  setDescription]  = useState('')
  const [priceMonthly, setPriceMonthly] = useState('')
  const [depositMonths,setDepositMonths]= useState('1')
  const [bedrooms,     setBedrooms]     = useState('')
  const [furnished,    setFurnished]    = useState('empty')
  const [region,       setRegion]       = useState('')
  const [district,     setDistrict]     = useState('')
  const [ward,         setWard]         = useState('')
  const [mtaa,         setMtaa]         = useState('')
  const [amenities,    setAmenities]    = useState<string[]>([])
  const [images,       setImages]       = useState<string[]>([''])
  const [orgContactName,  setOrgContactName]  = useState('')
  const [orgContactPhone, setOrgContactPhone] = useState('')

  // Agreement
  const [agreedBroker,     setAgreedBroker]     = useState(false)
  const [agreedCommission, setAgreedCommission] = useState(false)

  // Submission
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [done,       setDone]       = useState(false)

  const districts = region ? getDistricts(region) : []
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
    setAmenities(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
    )
  }

  function handleImageChange(i: number, val: string) {
    setImages(prev => { const n = [...prev]; n[i] = val; return n })
  }

  function addImageRow() {
    if (images.length < 8) setImages(prev => [...prev, ''])
  }

  function removeImageRow(i: number) {
    setImages(prev => prev.filter((_, j) => j !== i))
  }

  const validImages = images.filter(u => u.trim().length > 0)

  const step1Valid = title.trim() && priceMonthly && region && district
  const step2Valid = orgContactPhone.trim()
  const step3Valid = agreedBroker && agreedCommission

  async function handleSubmit() {
    if (!step1Valid || !step2Valid || !step3Valid) return
    setSubmitting(true); setError(null)
    try {
      const res = await fetch('/api/v1/org/brokerage-requests', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id:          unitId || null,
          title:            title.trim(),
          listing_type:     listingType,
          description:      description.trim() || null,
          price_monthly:    Number(priceMonthly),
          deposit_months:   Number(depositMonths) || 1,
          bedrooms:         bedrooms ? Number(bedrooms) : null,
          furnished,
          region,
          district,
          ward:             ward.trim() || null,
          mtaa:             mtaa.trim() || null,
          amenities,
          images:           validImages,
          org_contact_name: orgContactName.trim() || null,
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
    <div className="p-4 lg:p-6 max-w-lg mx-auto pb-20">
      {/* Header */}
      <button onClick={() => step > 1 ? setStep(s => s - 1) : router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-5">
        <i className="ti ti-arrow-left" aria-hidden="true" />
        {step > 1 ? 'Nyuma' : 'Brokerage'}
      </button>

      <h1 className="font-bold text-gray-900 text-lg">Ombi la Kutafuta Mpangaji</h1>
      <p className="text-xs text-gray-400 mt-0.5 mb-5">NyumbaFasta itatangaza na kukupata mpangaji</p>

      {/* Step indicators */}
      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map(s => (
          <div
            key={s}
            className={`flex-1 h-1.5 rounded-full transition-all ${
              s <= step ? 'bg-primary-500' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* ── STEP 1: Listing card ─────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
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

          {/* Price + Bedrooms + Deposit */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Bei/Mwezi (TZS) *</label>
              <input type="number" value={priceMonthly} onChange={e => setPriceMonthly(e.target.value)}
                placeholder="0" min="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Vyumba</label>
              <input type="number" value={bedrooms} onChange={e => setBedrooms(e.target.value)}
                placeholder="—" min="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Amana (miezi)</label>
              <input type="number" value={depositMonths} onChange={e => setDepositMonths(e.target.value)}
                placeholder="1" min="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
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
            <label className="text-xs font-medium text-gray-700 mb-2 block">Huduma Zinazopatikana</label>
            <div className="flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAmenity(a)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
                    amenities.includes(a)
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Images */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-2 block">
              Picha za Mali (URL — hiari, hadi 8)
            </label>
            <div className="space-y-2">
              {images.map((url, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={url}
                    onChange={e => handleImageChange(i, e.target.value)}
                    placeholder={`URL ya picha ${i + 1}...`}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                  {images.length > 1 && (
                    <button type="button" onClick={() => removeImageRow(i)}
                      className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                      <i className="ti ti-trash text-sm" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {images.length < 8 && (
              <button type="button" onClick={addImageRow}
                className="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                <i className="ti ti-plus" aria-hidden="true" />
                Ongeza picha
              </button>
            )}
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!step1Valid}
            className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold text-sm hover:bg-primary-600 transition disabled:opacity-40 mt-2"
          >
            Endelea →
          </button>
        </div>
      )}

      {/* ── STEP 2: Contact info ─────────────────────── */}
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

          {/* Summary card */}
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

      {/* ── STEP 3: Agreement + Submit ───────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Hatua 3 ya 3 — Makubaliano
          </p>

          {/* Broker terms */}
          <label className="flex gap-3 bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-primary-300 transition">
            <div className="flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={agreedBroker}
                onChange={e => setAgreedBroker(e.target.checked)}
                className="w-4 h-4 accent-primary-500"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Nakubaliana na NyumbaFasta kutangaza kwa niaba yangu</p>
              <p className="text-xs text-gray-500 mt-1">
                NyumbaFasta itashughulikia utangazaji, mawasiliano ya awali na mpangaji,
                na kupanga miadi. Mamlaka ya biashara bado iko kwangu.
              </p>
            </div>
          </label>

          {/* Commission agreement */}
          <label className="flex gap-3 bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-primary-300 transition">
            <div className="flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={agreedCommission}
                onChange={e => setAgreedCommission(e.target.checked)}
                className="w-4 h-4 accent-primary-500"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Nakubaliana kulipa kamisheni ya mwezi 1 wa kodi
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Mpangaji atakapopatikana na mkataba kufungwa, nitawasilisha kwa NyumbaFasta
                kamisheni ya{' '}
                <span className="font-bold text-primary-600">
                  TZS {Number(priceMonthly || 0).toLocaleString()}
                </span>{' '}
                (sawa na kodi ya mwezi mmoja).
              </p>
            </div>
          </label>

          {/* Commission box */}
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
              <>
                <i className="ti ti-loader-2 animate-spin" aria-hidden="true" />
                Inawasilisha...
              </>
            ) : (
              <>
                <i className="ti ti-send" aria-hidden="true" />
                Wasilisha Ombi kwa NyumbaFasta
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
