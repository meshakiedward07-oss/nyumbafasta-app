'use client'
import { useState } from 'react'

const AMENITY_OPTIONS = [
  { key: 'sebule',    label: 'Sebule / Living Room', icon: 'sofa' },
  { key: 'jiko',      label: 'Jiko / Kitchen',       icon: 'tools-kitchen-2' },
  { key: 'laundry',   label: 'Laundry',              icon: 'washing-machine' },
  { key: 'parking',   label: 'Parking',              icon: 'car' },
  { key: 'balcony',   label: 'Balcony / Terrace',    icon: 'building-pavilion' },
  { key: 'wifi',      label: 'WiFi',                 icon: 'wifi' },
  { key: 'generator', label: 'Generator',            icon: 'bolt' },
  { key: 'security',  label: 'Security 24hr',        icon: 'shield-check' },
]

const NAMING_STYLES = [
  { key: 'floor_letter', example: '1A, 1B, 2A, 2B…',     desc: 'Ghorofa + Herufi' },
  { key: 'ghorofa',      example: 'G1-A, G1-B, G2-A…',   desc: 'G + Ghorofa + Herufi' },
  { key: 'sequential',   example: '101, 102, 201, 202…',  desc: 'Nambari za Consecutive' },
]

function unitName(style: string, floor: number, idx: number): string {
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const letter = L[idx] ?? String(idx + 1)
  if (style === 'ghorofa')   return `G${floor}-${letter}`
  if (style === 'sequential') return `${floor}${String(idx + 1).padStart(2, '0')}`
  return `${floor}${letter}`
}

interface Props {
  listingId: string
  orgId:     string
  onDone:    (units: unknown[]) => void
  onClose:   () => void
}

export default function BuildingSetupModal({ listingId, orgId, onDone, onClose }: Props) {
  const [step, setStep] = useState<1 | 2>(1)

  // ── Step 1: structure ──────────────────────────────────────────────────────
  const [floors,   setFloors]   = useState(1)
  const [perFloor, setPerFloor] = useState(4)
  const [naming,   setNaming]   = useState('floor_letter')

  // ── Step 2: unit template ──────────────────────────────────────────────────
  const [unitType,     setUnitType]     = useState('apartment')
  const [bedrooms,     setBedrooms]     = useState(2)
  const [bathrooms,    setBathrooms]    = useState(1)
  const [ensuite,      setEnsuite]      = useState(true)
  const [amenities,    setAmenities]    = useState<string[]>(['sebule', 'jiko'])
  const [rent,         setRent]         = useState('')
  const [depMonths,    setDepMonths]    = useState(2)

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const total = floors * perFloor

  function toggleAmenity(key: string) {
    setAmenities(p => p.includes(key) ? p.filter(a => a !== key) : [...p, key])
  }

  // Preview names (first 8 + last 1)
  const preview: string[] = []
  outer: for (let f = 1; f <= floors; f++) {
    for (let u = 0; u < perFloor; u++) {
      preview.push(unitName(naming, f, u))
      if (preview.length >= 8) break outer
    }
  }
  const lastUnit = unitName(naming, floors, perFloor - 1)

  async function handleGenerate() {
    if (!rent || Number(rent) <= 0) { setError('Weka kodi ya kila mwezi'); return }
    setSaving(true); setError(null)

    const units = []
    for (let f = 1; f <= floors; f++) {
      for (let u = 0; u < perFloor; u++) {
        units.push({
          listing_id:     listingId,
          unit_number:    unitName(naming, f, u),
          floor_number:   f,
          unit_type:      unitType,
          bedrooms,
          bathrooms:      ensuite ? bedrooms : bathrooms,
          monthly_rent:   Number(rent),
          deposit_months: depMonths,
          amenities,
        })
      }
    }

    try {
      const res  = await fetch(`/api/v1/organizations/${orgId}/units/bulk`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ units }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Hitilafu imetokea'); return }
      onDone(data.units)
    } catch {
      setError('Hitilafu ya mtandao. Jaribu tena.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="font-bold text-gray-900 text-base">Muundo wa Jengo</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Hatua {step}/2 — {step === 1 ? 'Muundo & Orodha' : 'Kila Kitengo'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* step dots */}
            <div className="flex gap-1.5">
              {([1, 2] as const).map(s => (
                <div key={s} className={`w-2 h-2 rounded-full transition ${step === s ? 'bg-primary-500' : 'bg-gray-200'}`} />
              ))}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-1">
              <i className="ti ti-x text-xl" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <>
              {/* Floors + per-floor */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                    Idadi ya Ghorofa
                  </label>
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                    <button onClick={() => setFloors(f => Math.max(1, f - 1))}
                      className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-lg flex-shrink-0">
                      −
                    </button>
                    <input type="number" min="1" max="50" value={floors}
                      onChange={e => setFloors(Math.max(1, Math.min(50, Number(e.target.value))))}
                      className="flex-1 text-center font-bold text-gray-900 text-sm focus:outline-none min-w-0" />
                    <button onClick={() => setFloors(f => Math.min(50, f + 1))}
                      className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-lg flex-shrink-0">
                      +
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 text-center">Floors (1–50)</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                    Vitengo kwa Ghorofa
                  </label>
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                    <button onClick={() => setPerFloor(f => Math.max(1, f - 1))}
                      className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-lg flex-shrink-0">
                      −
                    </button>
                    <input type="number" min="1" max="20" value={perFloor}
                      onChange={e => setPerFloor(Math.max(1, Math.min(20, Number(e.target.value))))}
                      className="flex-1 text-center font-bold text-gray-900 text-sm focus:outline-none min-w-0" />
                    <button onClick={() => setPerFloor(f => Math.min(20, f + 1))}
                      className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-lg flex-shrink-0">
                      +
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 text-center">Units / floor (1–20)</p>
                </div>
              </div>

              {/* Naming style */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block">Mfumo wa Kutaja Vitengo</label>
                <div className="space-y-2">
                  {NAMING_STYLES.map(ns => (
                    <button key={ns.key} onClick={() => setNaming(ns.key)}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border-2 text-left transition ${
                        naming === ns.key
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-100 hover:border-gray-200'
                      }`}>
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        naming === ns.key ? 'border-primary-500 bg-primary-500' : 'border-gray-300'
                      }`}>
                        {naming === ns.key && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-mono font-semibold ${naming === ns.key ? 'text-primary-700' : 'text-gray-700'}`}>
                          {ns.example}
                        </p>
                        <p className="text-[10px] text-gray-400">{ns.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500">Mfano wa Majina</p>
                  <span className="text-xs bg-primary-100 text-primary-700 font-bold px-2 py-0.5 rounded-full">
                    {total} vitengo
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {preview.map(n => (
                    <span key={n}
                      className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1 font-mono font-medium text-gray-700">
                      {n}
                    </span>
                  ))}
                  {total > 8 && (
                    <>
                      <span className="text-xs text-gray-400 py-1">…</span>
                      <span className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1 font-mono font-medium text-gray-500">
                        {lastUnit}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 mt-2">
                  {floors} ghorofa × {perFloor} kila ghorofa = <strong className="text-gray-700">{total} vitengo</strong>
                </p>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={total < 1}
                className="w-full bg-primary-500 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-primary-600 transition disabled:opacity-40"
              >
                Endelea — Weka Maelezo ya Kila Kitengo
                <i className="ti ti-arrow-right ml-1.5" />
              </button>
            </>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <>
              {/* Unit type + counts */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Aina ya Kitengo</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: 'apartment', l: 'Apartment' },
                    { v: 'studio',    l: 'Studio' },
                    { v: 'room',      l: 'Chumba' },
                    { v: 'whole',     l: 'Nyumba Yote' },
                    { v: 'shop',      l: 'Duka' },
                    { v: 'office',    l: 'Ofisi' },
                  ].map(({ v, l }) => (
                    <button key={v} onClick={() => setUnitType(v)}
                      className={`py-2.5 rounded-xl border-2 text-xs font-semibold transition ${
                        unitType === v
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-100 text-gray-500 hover:border-gray-200'
                      }`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                    <i className="ti ti-bed mr-1" />Vyumba vya Kulala
                  </label>
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                    <button onClick={() => setBedrooms(b => Math.max(0, b - 1))}
                      className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-lg flex-shrink-0">−</button>
                    <span className="flex-1 text-center font-bold text-gray-900">{bedrooms}</span>
                    <button onClick={() => setBedrooms(b => Math.min(10, b + 1))}
                      className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-lg flex-shrink-0">+</button>
                  </div>
                </div>
                {!ensuite && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                      <i className="ti ti-bath mr-1" />Vyoo vya Pamoja
                    </label>
                    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                      <button onClick={() => setBathrooms(b => Math.max(0, b - 1))}
                        className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-lg flex-shrink-0">−</button>
                      <span className="flex-1 text-center font-bold text-gray-900">{bathrooms}</span>
                      <button onClick={() => setBathrooms(b => Math.min(10, b + 1))}
                        className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-lg flex-shrink-0">+</button>
                    </div>
                  </div>
                )}
              </div>

              {/* En-suite toggle */}
              <button
                onClick={() => setEnsuite(e => !e)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition ${
                  ensuite ? 'border-teal-400 bg-teal-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition ${
                  ensuite ? 'bg-teal-500 border-teal-500' : 'border-gray-300'
                }`}>
                  {ensuite && <i className="ti ti-check text-white text-xs" />}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${ensuite ? 'text-teal-800' : 'text-gray-700'}`}>
                    Vyoo vya Ndani (En-suite)
                  </p>
                  <p className="text-[10px] text-gray-400">Kila chumba cha kulala kina choo chake ndani</p>
                </div>
              </button>

              {/* Amenities */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block">Vifaa vya Ziada</label>
                <div className="grid grid-cols-2 gap-2">
                  {AMENITY_OPTIONS.map(a => {
                    const on = amenities.includes(a.key)
                    return (
                      <button key={a.key} onClick={() => toggleAmenity(a.key)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-left transition ${
                          on ? 'border-primary-400 bg-primary-50' : 'border-gray-100 hover:border-gray-200'
                        }`}>
                        <i className={`ti ti-${a.icon} text-base flex-shrink-0 ${on ? 'text-primary-600' : 'text-gray-400'}`} />
                        <span className={`text-xs font-medium leading-tight ${on ? 'text-primary-700' : 'text-gray-600'}`}>{a.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Rent + deposit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Kodi kwa Mwezi (TZS)</label>
                  <input
                    type="number" min="0" value={rent}
                    onChange={e => setRent(e.target.value)}
                    placeholder="mfano: 850000"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Amana (miezi)</label>
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                    <button onClick={() => setDepMonths(d => Math.max(0, d - 1))}
                      className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-lg flex-shrink-0">−</button>
                    <span className="flex-1 text-center font-bold text-gray-900">{depMonths}</span>
                    <button onClick={() => setDepMonths(d => Math.min(12, d + 1))}
                      className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-lg flex-shrink-0">+</button>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 space-y-1.5">
                <p className="text-xs font-bold text-teal-800 mb-2">Muhtasari wa Kutengeneza</p>
                <div className="text-xs text-teal-700 space-y-1">
                  <p><span className="text-base">🏢</span> {floors} ghorofa × {perFloor} = <strong>{total} vitengo</strong></p>
                  <p>
                    <span className="text-base">🛏️</span> {bedrooms} vya kulala
                    {ensuite
                      ? ` · ${bedrooms} vyoo vya ndani (en-suite)`
                      : ` · ${bathrooms} vyoo vya pamoja`}
                  </p>
                  {amenities.length > 0 && (
                    <p>
                      <span className="text-base">✅</span>{' '}
                      {amenities.map(a => AMENITY_OPTIONS.find(x => x.key === a)?.label ?? a).join(', ')}
                    </p>
                  )}
                  <p>
                    <span className="text-base">💰</span> TZS {Number(rent || 0).toLocaleString()}/mwezi
                    {depMonths > 0 && ` · amana miezi ${depMonths}`}
                  </p>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <i className="ti ti-alert-circle" />{error}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setStep(1); setError(null) }}
                  disabled={saving}
                  className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 py-3 disabled:opacity-40">
                  <i className="ti ti-arrow-left mr-1" />Rudi
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={saving}
                  className="flex-1 bg-primary-500 text-white py-3 rounded-xl font-bold text-sm hover:bg-primary-600 transition disabled:opacity-40">
                  {saving
                    ? <><i className="ti ti-loader-2 animate-spin mr-1.5" />Inatengeneza {total} vitengo…</>
                    : <><i className="ti ti-building-community mr-1.5" />Tengeneza Vitengo {total}</>
                  }
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
