'use client'
import { useState, useEffect } from 'react'
import type { Pricing } from '@/lib/config/pricing'

const DEFAULTS: Pricing = {
  subscription:  { basic: 10000, premium: 25000, enterprise: 50000 },
  unlock:        2000,
  boost:         { 1: 5000, 2: 9000, 4: 16000 },
  extraListing:  2000,
  listingLimits: { free: 2, basic: 5, premium: 20, enterprise: 50 },
}

function fmtTsh(n: number) {
  return `Tsh ${n.toLocaleString()}`
}

type PriceFieldDef = {
  key:   string
  label: string
  hint:  string
  get:   (p: Pricing) => number
  set:   (p: Pricing, v: number) => Pricing
}

type LimitFieldDef = {
  key:   string
  label: string
  hint:  string
  get:   (p: Pricing) => number
  set:   (p: Pricing, v: number) => Pricing
}

const PRICE_FIELDS: PriceFieldDef[] = [
  {
    key: 'subscription_basic',
    label: 'Subscription — Basic',
    hint: 'Ada ya kila mwezi kwa plan ya Basic',
    get: p => p.subscription.basic,
    set: (p, v) => ({ ...p, subscription: { ...p.subscription, basic: v } }),
  },
  {
    key: 'subscription_premium',
    label: 'Subscription — Premium ⭐',
    hint: 'Ada ya kila mwezi kwa plan ya Premium',
    get: p => p.subscription.premium,
    set: (p, v) => ({ ...p, subscription: { ...p.subscription, premium: v } }),
  },
  {
    key: 'subscription_enterprise',
    label: 'Subscription — Enterprise 🏢',
    hint: 'Ada ya kila mwezi kwa plan ya Enterprise',
    get: p => p.subscription.enterprise,
    set: (p, v) => ({ ...p, subscription: { ...p.subscription, enterprise: v } }),
  },
  {
    key: 'unlock',
    label: 'Contact Unlock',
    hint: 'Mteja analipa kupata namba ya WhatsApp ya dalali',
    get: p => p.unlock,
    set: (p, v) => ({ ...p, unlock: v }),
  },
  {
    key: 'boost_1week',
    label: 'Boost — Wiki 1',
    hint: 'Listing inaonekana juu kwa wiki 1',
    get: p => p.boost[1],
    set: (p, v) => ({ ...p, boost: { ...p.boost, 1: v } }),
  },
  {
    key: 'boost_2week',
    label: 'Boost — Wiki 2',
    hint: 'Listing inaonekana juu kwa wiki 2',
    get: p => p.boost[2],
    set: (p, v) => ({ ...p, boost: { ...p.boost, 2: v } }),
  },
  {
    key: 'boost_4week',
    label: 'Boost — Wiki 4',
    hint: 'Listing inaonekana juu kwa wiki 4',
    get: p => p.boost[4],
    set: (p, v) => ({ ...p, boost: { ...p.boost, 4: v } }),
  },
  {
    key: 'extraListing',
    label: 'Extra Listing (kwa moja)',
    hint: 'Dalali ananunua listing zaidi ya kikomo cha plan yake',
    get: p => p.extraListing,
    set: (p, v) => ({ ...p, extraListing: v }),
  },
]

const LIMIT_FIELDS: LimitFieldDef[] = [
  {
    key: 'limit_free',
    label: 'Kikomo — Free (bila subscription)',
    hint: 'Idadi ya listings kwa dalali bila subscription inayofanya kazi',
    get: p => p.listingLimits.free,
    set: (p, v) => ({ ...p, listingLimits: { ...p.listingLimits, free: v } }),
  },
  {
    key: 'limit_basic',
    label: 'Kikomo — Basic',
    hint: 'Idadi ya listings kwa subscribers wa Basic',
    get: p => p.listingLimits.basic,
    set: (p, v) => ({ ...p, listingLimits: { ...p.listingLimits, basic: v } }),
  },
  {
    key: 'limit_premium',
    label: 'Kikomo — Premium ⭐',
    hint: 'Idadi ya listings kwa subscribers wa Premium',
    get: p => p.listingLimits.premium,
    set: (p, v) => ({ ...p, listingLimits: { ...p.listingLimits, premium: v } }),
  },
  {
    key: 'limit_enterprise',
    label: 'Kikomo — Enterprise 🏢',
    hint: 'Idadi ya listings kwa subscribers wa Enterprise',
    get: p => p.listingLimits.enterprise,
    set: (p, v) => ({ ...p, listingLimits: { ...p.listingLimits, enterprise: v } }),
  },
]

export default function PricingSettings() {
  const [pricing, setPricing] = useState<Pricing>(DEFAULTS)
  const [draft,   setDraft]   = useState<Pricing>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    fetch('/api/v1/admin/settings/pricing')
      .then(r => r.json())
      .then(d => {
        const full: Pricing = { ...DEFAULTS, ...d, listingLimits: { ...DEFAULTS.listingLimits, ...d.listingLimits } }
        setPricing(full)
        setDraft(full)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function handlePriceChange(field: PriceFieldDef, raw: string) {
    const v = parseInt(raw.replace(/\D/g, ''), 10)
    if (isNaN(v)) return
    setDraft(prev => field.set(prev, v))
  }

  function handleLimitChange(field: LimitFieldDef, raw: string) {
    const v = parseInt(raw.replace(/\D/g, ''), 10)
    if (isNaN(v)) return
    setDraft(prev => field.set(prev, v))
  }

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/v1/admin/settings/pricing', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(draft),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const full: Pricing = { ...DEFAULTS, ...json.pricing, listingLimits: { ...DEFAULTS.listingLimits, ...json.pricing.listingLimits } }
      setPricing(full)
      setDraft(full)
      setMsg({ text: 'Bei na viwango vimehifadhiwa. Vitatumika mara moja kwenye malipo yote mapya.', ok: true })
      setEditing(false)
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Hitilafu imetokea', ok: false })
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    if (!confirm('Resets zote kwa bei na viwango vya awali? Endelea?')) return
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/v1/admin/settings/pricing', { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const full: Pricing = { ...DEFAULTS, ...json.pricing, listingLimits: { ...DEFAULTS.listingLimits, ...json.pricing.listingLimits } }
      setPricing(full)
      setDraft(full)
      setMsg({ text: 'Bei na viwango vimeresetwa kwa awali.', ok: true })
      setEditing(false)
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Hitilafu imetokea', ok: false })
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setDraft(pricing)
    setEditing(false)
    setMsg(null)
  }

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(pricing)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <div>
          <p className="font-bold text-gray-800 text-sm flex items-center gap-2">
            <i className="ti ti-tag text-primary-500 text-base" aria-hidden="true" />
            Mipangilio ya Bei na Viwango
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Bei unayobadilisha itatumika mara moja kwenye malipo yote mapya</p>
        </div>
        {!editing && !loading && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 transition-colors"
          >
            <i className="ti ti-pencil" aria-hidden="true" />Badilisha
          </button>
        )}
      </div>

      {/* Feedback */}
      {msg && (
        <div className={`mx-5 mt-4 px-4 py-2.5 rounded-xl text-xs font-medium ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.ok ? '✅' : '❌'} {msg.text}
        </div>
      )}

      {loading ? (
        <div className="px-5 py-8 text-center">
          <i className="ti ti-loader-2 animate-spin text-primary-500 text-xl" aria-hidden="true" />
          <p className="text-xs text-gray-400 mt-2">Inapakia mipangilio ya sasa...</p>
        </div>
      ) : (
        <>
          {/* Price fields */}
          <div className="px-5 pt-4 pb-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bei za Huduma</p>
          </div>
          <div className="divide-y divide-gray-50">
            {PRICE_FIELDS.map(field => {
              const current = field.get(pricing)
              const value   = field.get(draft)
              const changed = editing && value !== current

              return (
                <div key={field.key} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800">{field.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{field.hint}</p>
                  </div>

                  {editing ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {changed && (
                        <span className="text-[10px] text-gray-400 line-through">{fmtTsh(current)}</span>
                      )}
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">Tsh</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="100"
                          step="100"
                          value={value}
                          onChange={e => handlePriceChange(field, e.target.value)}
                          className={`w-28 pl-9 pr-2 py-1.5 rounded-lg border text-xs font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary-400 ${
                            changed ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-white'
                          }`}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm font-bold text-primary-600 flex-shrink-0">{fmtTsh(current)}</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Listing limit fields */}
          <div className="px-5 pt-5 pb-1 border-t border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <i className="ti ti-list-numbers text-xs" aria-hidden="true" />
              Idadi ya Listings kwa Kila Plan
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Admin anaweza kupanga idadi ya listings inayoruhusiwa kwa kila aina ya subscription
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {LIMIT_FIELDS.map(field => {
              const current = field.get(pricing)
              const value   = field.get(draft)
              const changed = editing && value !== current

              return (
                <div key={field.key} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800">{field.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{field.hint}</p>
                  </div>

                  {editing ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {changed && (
                        <span className="text-[10px] text-gray-400 line-through">{current} listings</span>
                      )}
                      <div className="relative">
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          value={value}
                          onChange={e => handleLimitChange(field, e.target.value)}
                          className={`w-24 px-3 py-1.5 rounded-lg border text-xs font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary-400 ${
                            changed ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-white'
                          }`}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">ls</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm font-bold text-primary-600 flex-shrink-0">{current} listings</span>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Edit actions */}
      {editing && (
        <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex-1 py-3 rounded-xl text-sm font-bold bg-primary-600 text-white disabled:opacity-40 active:scale-[0.98] transition-all"
          >
            {saving ? (
              <><i className="ti ti-loader-2 animate-spin mr-1" aria-hidden="true" />Inahifadhi...</>
            ) : (
              <><i className="ti ti-check mr-1" aria-hidden="true" />Hifadhi Mabadiliko</>
            )}
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="px-4 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 disabled:opacity-40"
          >
            Ghairi
          </button>
          <button
            onClick={handleReset}
            disabled={saving}
            className="px-3 py-3 rounded-xl text-xs font-semibold text-red-500 border border-red-100 bg-red-50 disabled:opacity-40"
            title="Resets kwa bei za awali"
          >
            <i className="ti ti-refresh" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Impact notice */}
      {!editing && !loading && (
        <div className="px-5 py-3 border-t border-gray-50 bg-amber-50">
          <p className="text-[10px] text-amber-700 flex items-start gap-1.5">
            <i className="ti ti-info-circle flex-shrink-0 mt-0.5" aria-hidden="true" />
            Kubadilisha bei kunaathiri malipo mapya tu. Kubadilisha idadi ya listings kunaathiri uploads mpya — dalali walio na listings zaidi ya kikomo kipya hawataathirika retroactively.
          </p>
        </div>
      )}
    </div>
  )
}
