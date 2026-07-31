'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { UNIT_TYPE_LABELS, UNIT_STATUS_LABELS } from '@/lib/types/property'
import type { PropertyUnit, Lease } from '@/lib/types/property'

type UnitWithLease = PropertyUnit & { active_lease: Lease | null }

interface ListingInfo {
  id: string; title: string; type: string; district: string; region: string
  price_monthly: number; images: string[]; lifecycle_status: string
}

const STATUS_COLORS: Record<string, string> = {
  vacant:      'bg-green-50 text-green-700',
  occupied:    'bg-blue-50 text-blue-700',
  maintenance: 'bg-amber-50 text-amber-700',
  reserved:    'bg-purple-50 text-purple-700',
}

export default function MaliDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [listing, setListing]   = useState<ListingInfo | null>(null)
  const [units,   setUnits]     = useState<UnitWithLease[]>([])
  const [orgId,   setOrgId]     = useState<string | null>(null)
  const [orgRole, setOrgRole]   = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)

  // Add unit form
  const [showAddUnit,  setShowAddUnit]  = useState(false)
  const [uNumber,      setUNumber]      = useState('')
  const [uType,        setUType]        = useState('whole')
  const [uRent,        setURent]        = useState('')
  const [uBedrooms,    setUBedrooms]    = useState('')
  const [uDepMonths,   setUDepMonths]   = useState('1')
  const [uDesc,        setUDesc]        = useState('')
  const [addingUnit,   setAddingUnit]   = useState(false)
  const [unitError,    setUnitError]    = useState<string | null>(null)

  // Edit unit form
  const [editUnit,    setEditUnit]    = useState<UnitWithLease | null>(null)
  const [editForm,    setEditForm]    = useState({ unit_number: '', unit_type: 'whole', monthly_rent: '', bedrooms: '', deposit_months: '1', description: '' })
  const [editSaving,  setEditSaving]  = useState(false)
  const [editError,   setEditError]   = useState<string | null>(null)

  // Add tenant form
  const [tenantUnit,   setTenantUnit]   = useState<UnitWithLease | null>(null)
  const [tPhone,       setTPhone]       = useState('')
  const [tRent,        setTRent]        = useState('')
  const [tDeposit,     setTDeposit]     = useState('')
  const [tStartDate,   setTStartDate]   = useState(new Date().toISOString().split('T')[0])
  const [tEndDate,     setTEndDate]     = useState('')
  const [tDepPaid,     setTDepPaid]     = useState(false)
  const [tNotes,       setTNotes]       = useState('')
  const [addingTenant, setAddingTenant] = useState(false)
  const [tenantError,  setTenantError]  = useState<string | null>(null)
  const [foundTenant,  setFoundTenant]  = useState<{ id: string; full_name: string | null; phone: string | null } | null>(null)
  const [lookingUp,    setLookingUp]    = useState(false)
  const [inviting,     setInviting]     = useState(false)
  const [inviteMsg,    setInviteMsg]    = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const orgRes  = await fetch('/api/v1/organizations')
        const orgData = await orgRes.json()
        const orgs    = orgData.organizations ?? []
        const primary = orgs.find((o: { role: string }) => o.role === 'owner') ?? orgs[0]
        if (!primary) { router.push('/property/setup'); return }
        const oId   = primary.organization.id
        const oRole = primary.role
        setOrgId(oId)
        setOrgRole(oRole)

        // Get listing info
        const lRes  = await fetch(`/api/v1/listings/${id}`)
        const lData = await lRes.json()
        if (lData.listing) setListing(lData.listing)

        // Get units
        const uRes  = await fetch(`/api/v1/organizations/${oId}/units`)
        const uData = await uRes.json()
        const filtered = (uData.units ?? []).filter((u: PropertyUnit) => u.listing_id === id)
        setUnits(filtered)
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [id, router])

  const canManage = ['owner', 'branch_manager', 'agent'].includes(orgRole ?? '')

  async function lookupTenant() {
    if (!tPhone.trim()) return
    setLookingUp(true); setFoundTenant(null); setTenantError(null)
    try {
      const res  = await fetch(`/api/v1/users/search?phone=${encodeURIComponent(tPhone.trim())}`)
      const data = await res.json()
      if (data.user) {
        setFoundTenant(data.user)
        if (tenantUnit) setTRent(String(tenantUnit.monthly_rent))
      } else {
        setTenantError('Mpangaji hajapatikana. Lazima awe na akaunti ya NyumbaFasta.')
      }
    } catch {
      setTenantError('Hitilafu ya mtandao. Jaribu tena.')
    } finally { setLookingUp(false) }
  }

  async function handleInviteTenant() {
    if (!orgId || !tPhone.trim()) return
    setInviting(true); setInviteMsg(null)
    try {
      const res  = await fetch(`/api/v1/organizations/${orgId}/invite-tenant`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone: tPhone.trim() }),
      })
      const data = await res.json()
      if (res.status === 409 && data.already_registered) {
        setTenantError('Nambari hii tayari ina akaunti. Jaribu tena kupata mpangaji.')
        setInviteMsg(null)
      } else if (!res.ok) {
        setTenantError(data.error ?? 'Imeshindwa kutuma mwaliko.')
        setInviteMsg(null)
      } else {
        setInviteMsg(data.message ?? 'Mwaliko umetumwa kwa mafanikio.')
        setTenantError(null)
      }
    } catch {
      setTenantError('Hitilafu ya mtandao. Jaribu tena.')
    } finally { setInviting(false) }
  }

  async function handleAddUnit() {
    if (!orgId || !uNumber.trim() || !uRent) { setUnitError('Jaza sehemu zote zinazohitajika'); return }
    setAddingUnit(true); setUnitError(null)
    try {
      const res  = await fetch(`/api/v1/organizations/${orgId}/units`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id:     id,
          unit_number:    uNumber.trim(),
          unit_type:      uType,
          monthly_rent:   Number(uRent),
          bedrooms:       uBedrooms ? Number(uBedrooms) : null,
          deposit_months: Number(uDepMonths) || 1,
          description:    uDesc.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setUnitError(data.error ?? 'Kuna tatizo'); return }
      setUnits(prev => [data.unit, ...prev])
      setShowAddUnit(false); setUNumber(''); setUType('whole'); setURent(''); setUBedrooms(''); setUDesc('')
    } catch {
      setUnitError('Haikuweza kuunganika. Jaribu tena.')
    } finally { setAddingUnit(false) }
  }

  async function handleAddTenant() {
    if (!orgId || !tenantUnit || !foundTenant || !tRent || !tStartDate) {
      setTenantError('Jaza sehemu zote zinazohitajika'); return
    }
    setAddingTenant(true); setTenantError(null)
    try {
      const res  = await fetch(`/api/v1/organizations/${orgId}/leases`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id:        tenantUnit.id,
          tenant_phone:   tPhone.trim(),
          monthly_rent:   Number(tRent),
          deposit_amount: tDeposit ? Number(tDeposit) : null,
          deposit_paid:   tDepPaid,
          start_date:     tStartDate,
          end_date:       tEndDate || null,
          notes:          tNotes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setTenantError(data.error ?? 'Kuna tatizo'); return }
      // Update unit status locally
      setUnits(prev => prev.map(u =>
        u.id === tenantUnit.id ? { ...u, status: 'occupied', active_lease: data.lease } : u
      ))
      setTenantUnit(null); setTPhone(''); setFoundTenant(null); setTRent(''); setTDeposit('')
      setTStartDate(new Date().toISOString().split('T')[0]); setTEndDate(''); setTNotes(''); setTDepPaid(false)
    } catch {
      setTenantError('Haikuweza kuunganika. Jaribu tena.')
    } finally { setAddingTenant(false) }
  }

  function openEditUnit(unit: UnitWithLease) {
    setEditUnit(unit)
    setEditForm({
      unit_number:    unit.unit_number,
      unit_type:      unit.unit_type,
      monthly_rent:   String(unit.monthly_rent),
      bedrooms:       unit.bedrooms != null ? String(unit.bedrooms) : '',
      deposit_months: String(unit.deposit_months),
      description:    unit.description ?? '',
    })
    setEditError(null)
  }

  async function handleEditUnit() {
    if (!orgId || !editUnit || !editForm.unit_number.trim() || !editForm.monthly_rent) {
      setEditError('Jaza sehemu zinazohitajika'); return
    }
    setEditSaving(true); setEditError(null)
    try {
      const res = await fetch(`/api/v1/organizations/${orgId}/units/${editUnit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_number:    editForm.unit_number.trim(),
          unit_type:      editForm.unit_type,
          monthly_rent:   Number(editForm.monthly_rent),
          bedrooms:       editForm.bedrooms ? Number(editForm.bedrooms) : null,
          deposit_months: Number(editForm.deposit_months) || 1,
          description:    editForm.description.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setEditError(data.error ?? 'Kuna tatizo'); return }
      setUnits(prev => prev.map(u => u.id === editUnit.id ? { ...u, ...data.unit } : u))
      setEditUnit(null)
    } catch {
      setEditError('Haikuweza kuunganika. Jaribu tena.')
    } finally { setEditSaving(false) }
  }

  async function handleEndLease(unit: UnitWithLease) {
    if (!orgId || !unit.active_lease) return
    if (!confirm(`Una uhakika unataka kusimamisha mkataba wa ${(unit.active_lease.tenant as unknown as { full_name: string } | null)?.full_name ?? 'mpangaji huyu'}?`)) return
    await fetch(`/api/v1/organizations/${orgId}/leases/${unit.active_lease.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'terminated' }),
    })
    setUnits(prev => prev.map(u =>
      u.id === unit.id ? { ...u, status: 'vacant', active_lease: null } : u
    ))
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto">
        <div className="h-32 bg-gray-100 animate-pulse rounded-2xl mb-4" />
        <div className="grid gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-2xl" />)}
        </div>
      </div>
    )
  }

  const totalMonthlyIncome = units.filter(u => u.status === 'occupied').reduce((s, u) => s + (u.active_lease?.monthly_rent ?? u.monthly_rent), 0)
  const vacantCount        = units.filter(u => u.status === 'vacant').length
  const occupiedCount      = units.filter(u => u.status === 'occupied').length

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      {/* Back */}
      <button onClick={() => router.push('/property/mali')} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-4">
        <i className="ti ti-arrow-left" aria-hidden="true" />
        Mali Zangu
      </button>

      {/* Property header */}
      {listing && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex gap-4">
          <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
            {listing.images?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <i className="ti ti-building text-3xl text-gray-300" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 text-lg leading-snug">{listing.title}</h1>
            <p className="text-sm text-gray-500">{listing.district}, {listing.region}</p>
            <p className="text-primary-600 font-bold mt-1">TZS {listing.price_monthly.toLocaleString()}/mwezi</p>
            <div className="flex gap-3 mt-2">
              <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                {occupiedCount} imepangishwa
              </span>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                {vacantCount} iko wazi
              </span>
              {totalMonthlyIncome > 0 && (
                <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                  TZS {totalMonthlyIncome.toLocaleString()}/mwezi
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Units header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-gray-900">Vitengo ({units.length})</h2>
        {canManage && (
          <button
            onClick={() => setShowAddUnit(true)}
            className="flex items-center gap-2 bg-primary-500 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition"
          >
            <i className="ti ti-plus" aria-hidden="true" />
            Ongeza Kitengo
          </button>
        )}
      </div>

      {/* Add unit form */}
      {showAddUnit && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">Kitengo Kipya</h3>
            <button onClick={() => { setShowAddUnit(false); setUnitError(null) }} className="text-gray-400 hover:text-gray-600">
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Nambari ya Kitengo *</label>
              <input value={uNumber} onChange={e => setUNumber(e.target.value)} placeholder="mfano: A1, Unit 3"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Aina</label>
              <select value={uType} onChange={e => setUType(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                {Object.entries(UNIT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Kodi (TZS/mwezi) *</label>
              <input type="number" value={uRent} onChange={e => setURent(e.target.value)} placeholder="0" min="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Vyumba vya Kulala</label>
              <input type="number" value={uBedrooms} onChange={e => setUBedrooms(e.target.value)} placeholder="—" min="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Amana (miezi)</label>
              <input type="number" value={uDepMonths} onChange={e => setUDepMonths(e.target.value)} placeholder="1" min="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Maelezo (hiari)</label>
              <input value={uDesc} onChange={e => setUDesc(e.target.value)} placeholder="Maelezo ya ziada..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
          </div>
          {unitError && <p className="text-sm text-red-600 mt-2">{unitError}</p>}
          <div className="flex gap-2 mt-3">
            <button onClick={() => { setShowAddUnit(false); setUnitError(null) }}
              className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 py-2.5">
              Ghairi
            </button>
            <button onClick={handleAddUnit} disabled={addingUnit}
              className="flex-1 bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition disabled:opacity-40">
              {addingUnit ? 'Inaongeza...' : 'Ongeza Kitengo'}
            </button>
          </div>
        </div>
      )}

      {/* Units list */}
      {units.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <i className="ti ti-door text-4xl text-gray-200" aria-hidden="true" />
          <p className="text-gray-500 font-medium mt-3">Hakuna vitengo bado</p>
          <p className="text-sm text-gray-400 mt-1">Ongeza vitengo vya kukodisha kwenye mali hii.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {units.map(unit => {
            const lease = unit.active_lease
            const tenant = lease?.tenant as unknown as { full_name: string | null; phone: string | null } | null
            return (
              <div key={unit.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    unit.status === 'occupied' ? 'bg-blue-50' : unit.status === 'vacant' ? 'bg-green-50' : 'bg-amber-50'
                  }`}>
                    <i className={`ti ti-door text-base ${
                      unit.status === 'occupied' ? 'text-blue-500' : unit.status === 'vacant' ? 'text-green-500' : 'text-amber-500'
                    }`} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{unit.unit_number}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[unit.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {UNIT_STATUS_LABELS[unit.status]}
                      </span>
                      <span className="text-xs text-gray-400">{UNIT_TYPE_LABELS[unit.unit_type]}</span>
                    </div>
                    <p className="text-sm font-bold text-primary-600 mt-0.5">
                      TZS {unit.monthly_rent.toLocaleString()}/mwezi
                      {unit.deposit_months > 0 && (
                        <span className="text-xs text-gray-400 font-normal ml-2">
                          · Amana: miezi {unit.deposit_months}
                        </span>
                      )}
                    </p>

                    {/* Tenant info if occupied */}
                    {unit.status === 'occupied' && lease && (
                      <div className="mt-2 bg-blue-50 rounded-xl p-2.5">
                        <p className="text-xs font-semibold text-blue-800">
                          <i className="ti ti-user mr-1" aria-hidden="true" />
                          {tenant?.full_name ?? 'Mpangaji'}
                        </p>
                        {tenant?.phone && (
                          <a href={`tel:${tenant.phone}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                            <i className="ti ti-phone" /> {tenant.phone}
                          </a>
                        )}
                        <div className="flex gap-3 mt-1 text-[10px] text-blue-500">
                          <span>Kuanza: {new Date(lease.start_date).toLocaleDateString('sw-TZ')}</span>
                          {lease.end_date && <span>Kumalizika: {new Date(lease.end_date).toLocaleDateString('sw-TZ')}</span>}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {canManage && (
                    <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                      <button
                        onClick={() => openEditUnit(unit)}
                        className="text-xs border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
                      >
                        <i className="ti ti-pencil mr-1" />Hariri
                      </button>
                      {unit.status === 'vacant' ? (
                        <>
                          <button
                            onClick={() => { setTenantUnit(unit); setTRent(String(unit.monthly_rent)); setTenantError(null) }}
                            className="text-xs bg-primary-500 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-primary-600 transition"
                          >
                            + Mpangaji
                          </button>
                          <a
                            href={`/property/brokerage/new?unit_id=${unit.id}`}
                            className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1.5 rounded-lg font-medium hover:bg-amber-100 transition whitespace-nowrap"
                            title="Omba NyumbaFasta kupata mpangaji kwa niaba yako"
                          >
                            🤝 NF Broker
                          </a>
                        </>
                      ) : (
                        <button
                          onClick={() => handleEndLease(unit)}
                          className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-medium hover:bg-red-100 transition"
                        >
                          Simamisha
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit unit modal */}
      {editUnit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end lg:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Hariri Kitengo: {editUnit.unit_number}</h3>
              <button onClick={() => setEditUnit(null)} className="text-gray-400 hover:text-gray-600">
                <i className="ti ti-x text-xl" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Nambari ya Kitengo *</label>
                  <input value={editForm.unit_number} onChange={e => setEditForm(f => ({ ...f, unit_number: e.target.value }))} placeholder="A1"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Aina</label>
                  <select value={editForm.unit_type} onChange={e => setEditForm(f => ({ ...f, unit_type: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                    {Object.entries(UNIT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Kodi (TZS/mwezi) *</label>
                  <input type="number" value={editForm.monthly_rent} onChange={e => setEditForm(f => ({ ...f, monthly_rent: e.target.value }))} min="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Vyumba vya Kulala</label>
                  <input type="number" value={editForm.bedrooms} onChange={e => setEditForm(f => ({ ...f, bedrooms: e.target.value }))} placeholder="—" min="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Amana (miezi)</label>
                  <input type="number" value={editForm.deposit_months} onChange={e => setEditForm(f => ({ ...f, deposit_months: e.target.value }))} min="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Maelezo (hiari)</label>
                  <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
              </div>
              {editError && <p className="text-sm text-red-600">{editError}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditUnit(null)}
                  className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 py-2.5">
                  Ghairi
                </button>
                <button onClick={handleEditUnit} disabled={editSaving}
                  className="flex-1 bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition disabled:opacity-40">
                  {editSaving ? 'Inahifadhi...' : 'Hifadhi Mabadiliko'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add tenant modal */}
      {tenantUnit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end lg:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-5">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">Ongeza Mpangaji</h3>
                  <p className="text-xs text-gray-400">Kitengo: {tenantUnit.unit_number}</p>
                </div>
                <button onClick={() => { setTenantUnit(null); setFoundTenant(null); setTenantError(null); setInviteMsg(null) }}
                  className="text-gray-400 hover:text-gray-600">
                  <i className="ti ti-x text-xl" aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-3">
                {/* Phone lookup */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Nambari ya Simu ya Mpangaji *</label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={tPhone}
                      onChange={e => { setTPhone(e.target.value); setFoundTenant(null); setTenantError(null); setInviteMsg(null) }}
                      placeholder="+255 7XX XXX XXX"
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                    <button
                      onClick={lookupTenant}
                      disabled={lookingUp || !tPhone.trim()}
                      className="px-3 bg-gray-100 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-200 transition disabled:opacity-40"
                    >
                      {lookingUp ? '...' : 'Tafuta'}
                    </button>
                  </div>
                  {foundTenant && (
                    <div className="mt-2 flex items-center gap-2 bg-green-50 rounded-xl p-2.5">
                      <i className="ti ti-circle-check text-green-500 text-lg" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-semibold text-green-800">{foundTenant.full_name ?? 'Mtumiaji'}</p>
                        <p className="text-xs text-green-600">{foundTenant.phone}</p>
                      </div>
                    </div>
                  )}
                  {tenantError && (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-red-600">{tenantError}</p>
                      {tenantError.includes('hajapatikana') && tPhone.trim() && (
                        <button
                          onClick={handleInviteTenant}
                          disabled={inviting}
                          className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg px-3 py-2 transition disabled:opacity-50"
                        >
                          <i className={`ti ti-${inviting ? 'loader-2 animate-spin' : 'brand-whatsapp'}`} aria-hidden="true" />
                          {inviting ? 'Inatuma...' : `Mtumie ${tPhone} mwaliko wa kujisajili`}
                        </button>
                      )}
                    </div>
                  )}
                  {inviteMsg && (
                    <div className="mt-2 flex items-start gap-2 bg-green-50 border border-green-100 rounded-xl p-2.5">
                      <i className="ti ti-circle-check text-green-500 text-lg flex-shrink-0" aria-hidden="true" />
                      <p className="text-xs text-green-700">{inviteMsg} Mpangaji atakapojisajili, unaweza kumuongeza hapa.</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Kodi ya Mwezi (TZS) *</label>
                    <input type="number" value={tRent} onChange={e => setTRent(e.target.value)} placeholder="0" min="0"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Amana (TZS)</label>
                    <input type="number" value={tDeposit} onChange={e => setTDeposit(e.target.value)} placeholder="0" min="0"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Tarehe ya Kuanza *</label>
                    <input type="date" value={tStartDate} onChange={e => setTStartDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Tarehe ya Kumalizika</label>
                    <input type="date" value={tEndDate} onChange={e => setTEndDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={tDepPaid} onChange={e => setTDepPaid(e.target.checked)} className="rounded" />
                  <span className="text-sm text-gray-600">Amana imelipwa tayari</span>
                </label>

                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Maelezo ya ziada (hiari)</label>
                  <textarea value={tNotes} onChange={e => setTNotes(e.target.value)} rows={2} placeholder="Maelezo..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setTenantUnit(null); setFoundTenant(null); setTenantError(null); setInviteMsg(null) }}
                    className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 py-2.5">
                    Ghairi
                  </button>
                  <button
                    onClick={handleAddTenant}
                    disabled={addingTenant || !foundTenant || !tRent || !tStartDate}
                    className="flex-1 bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition disabled:opacity-40"
                  >
                    {addingTenant ? 'Inaunda Mkataba...' : 'Unda Mkataba'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
