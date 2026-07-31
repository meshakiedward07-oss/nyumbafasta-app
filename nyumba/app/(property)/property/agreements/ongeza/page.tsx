'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const SCOPE_OPTIONS = [
  { value: 'full_management',           label: 'Usimamizi Kamili',        desc: 'Usimamizi wa kila kitu — wapangaji, kodi, matengenezo' },
  { value: 'maintenance_only',          label: 'Matengenezo Tu',          desc: 'Tunahusika na matengenezo na ukarabati tu' },
  { value: 'staff_assisted_listing',    label: 'Usaidizi wa Matangazo',   desc: 'Tunasaidia kutangaza mali na kupata wapangaji' },
]
const COMMISSION_TYPES = [
  { value: 'percent_monthly', label: '% ya Kodi ya Kila Mwezi' },
  { value: 'percent_first_month', label: '% ya Kodi ya Mwezi wa Kwanza' },
  { value: 'flat_fee', label: 'Ada Isiyobadilika (TZS)' },
]

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300'

export default function AgreementsOngezaPage() {
  const router = useRouter()

  const [orgId, setOrgId] = useState<string | null>(null)
  const [listings, setListings] = useState<{ id: string; title: string; district: string }[]>([])
  const [loading, setLoading] = useState(true)

  // Landlord lookup
  const [landlordPhone, setLandlordPhone] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  const [landlord, setLandlord] = useState<{ id: string; full_name: string | null; phone: string | null } | null>(null)
  const [landlordError, setLandlordError] = useState<string | null>(null)

  // Form fields
  const [listingId, setListingId] = useState('')
  const [scope, setScope] = useState('full_management')
  const [commissionType, setCommissionType] = useState('percent_monthly')
  const [commissionValue, setCommissionValue] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      try {
        const orgRes  = await fetch('/api/v1/organizations')
        const orgData = await orgRes.json()
        const orgs    = orgData.organizations ?? []
        const primary = orgs.find((o: { role: string }) => o.role === 'owner') ?? orgs[0]
        if (!primary) { router.push('/property/setup'); return }
        const id = primary.organization.id as string
        setOrgId(id)

        const lRes  = await fetch(`/api/v1/organizations/${id}/mali`)
        const lData = await lRes.json()
        setListings(lData.listings ?? [])
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function lookupLandlord() {
    if (!landlordPhone.trim()) return
    setLookingUp(true); setLandlord(null); setLandlordError(null)
    try {
      const res  = await fetch(`/api/v1/users/search?phone=${encodeURIComponent(landlordPhone.trim())}`)
      const data = await res.json()
      if (data.user) {
        setLandlord(data.user)
      } else {
        setLandlordError('Mtumiaji hajapatikana. Lazima awe na akaunti ya NyumbaFasta.')
      }
    } catch { setLandlordError('Hitilafu ya mtandao.') }
    finally { setLookingUp(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId || !landlord) return
    setSaving(true); setSaveError(null)
    try {
      const res = await fetch(`/api/v1/organizations/${orgId}/agreements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          landlord_id:      landlord.id,
          listing_id:       listingId || null,
          scope,
          commission_type:  commissionValue ? commissionType : null,
          commission_value: commissionValue ? Number(commissionValue) : null,
          start_date:       startDate || null,
          end_date:         endDate || null,
          notes:            notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error ?? 'Kuna tatizo'); return }
      router.push('/property/agreements')
    } catch {
      setSaveError('Haikuweza kuunganika. Jaribu tena.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 max-w-2xl mx-auto space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-2xl" />)}
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="mb-5">
        <button onClick={() => router.push('/property/agreements')} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-3">
          <i className="ti ti-arrow-left" /> Makubaliano
        </button>
        <h1 className="text-xl font-bold text-gray-900">Unda Makubaliano Mapya</h1>
        <p className="text-sm text-gray-500 mt-0.5">Sajili mmiliki wa mali na shirika lako</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Landlord lookup */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            <i className="ti ti-user text-primary-500 mr-1" /> Mmiliki wa Mali
          </h2>
          <div className="flex gap-2">
            <input
              type="tel"
              value={landlordPhone}
              onChange={e => { setLandlordPhone(e.target.value); setLandlord(null); setLandlordError(null) }}
              placeholder="+255 7XX XXX XXX"
              className={inputCls}
            />
            <button
              type="button"
              onClick={lookupLandlord}
              disabled={lookingUp || !landlordPhone.trim()}
              className="px-3 bg-gray-100 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-200 transition disabled:opacity-40 flex-shrink-0"
            >
              {lookingUp ? '...' : 'Tafuta'}
            </button>
          </div>
          {landlord && (
            <div className="mt-2 flex items-center gap-2 bg-green-50 rounded-xl p-2.5">
              <i className="ti ti-circle-check text-green-500 text-lg" />
              <div>
                <p className="text-sm font-semibold text-green-800">{landlord.full_name ?? 'Mtumiaji'}</p>
                <p className="text-xs text-green-600">{landlord.phone}</p>
              </div>
            </div>
          )}
          {landlordError && <p className="text-xs text-red-600 mt-2">{landlordError}</p>}
        </div>

        {/* Property (optional) */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            <i className="ti ti-building text-primary-500 mr-1" /> Mali (Hiari)
          </h2>
          <select value={listingId} onChange={e => setListingId(e.target.value)} className={`${inputCls} bg-white`}>
            <option value="">— Hakuna mali maalum —</option>
            {listings.map(l => (
              <option key={l.id} value={l.id}>{l.title} ({l.district})</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">Unaweza kuhusisha mali baadaye</p>
        </div>

        {/* Scope */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            <i className="ti ti-file-certificate text-primary-500 mr-1" /> Aina ya Makubaliano
          </h2>
          <div className="space-y-2">
            {SCOPE_OPTIONS.map(o => (
              <label key={o.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${scope === o.value ? 'border-primary-300 bg-primary-50' : 'border-gray-100 hover:border-gray-200'}`}>
                <input type="radio" name="scope" value={o.value} checked={scope === o.value} onChange={() => setScope(o.value)} className="mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{o.label}</p>
                  <p className="text-xs text-gray-500">{o.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Commission */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            <i className="ti ti-coin text-primary-500 mr-1" /> Kamisheni (Hiari)
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Aina ya Kamisheni</label>
              <select value={commissionType} onChange={e => setCommissionType(e.target.value)} className={`${inputCls} bg-white`}>
                {COMMISSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                {commissionType === 'flat_fee' ? 'Ada (TZS)' : 'Asilimia (%)'}
              </label>
              <input
                type="number"
                value={commissionValue}
                onChange={e => setCommissionValue(e.target.value)}
                placeholder={commissionType === 'flat_fee' ? '50000' : '10'}
                min="0"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            <i className="ti ti-calendar text-primary-500 mr-1" /> Kipindi
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Tarehe ya Kuanza</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Tarehe ya Kumalizika (hiari)</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            <i className="ti ti-notes text-primary-500 mr-1" /> Maelezo ya Ziada (Hiari)
          </h2>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Masharti maalum, makubaliano ya ziada..."
            className={inputCls}
          />
        </div>

        {saveError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {saveError}
          </div>
        )}

        <div className="flex gap-3 pb-6">
          <button
            type="button"
            onClick={() => router.push('/property/agreements')}
            className="px-5 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
          >
            Ghairi
          </button>
          <button
            type="submit"
            disabled={saving || !landlord}
            className="flex-1 bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 transition disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving
              ? <><i className="ti ti-loader-2 animate-spin" /> Inaunda...</>
              : <><i className="ti ti-circle-check" /> Unda Makubaliano</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}
