'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/context'
import { UNIT_TYPE_LABELS, UNIT_STATUS_LABELS } from '@/lib/types/property'
import type { PropertyUnit, Lease } from '@/lib/types/property'
import BuildingSetupModal from '@/components/property/BuildingSetupModal'

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
  const { t } = useLanguage()
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

  // Building setup wizard
  const [showBuildingSetup, setShowBuildingSetup] = useState(false)
  // Which unit is expanded in the floor grid (null = none)
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null)

  // Edit unit form
  const [editUnit,    setEditUnit]    = useState<UnitWithLease | null>(null)
  const [editForm,    setEditForm]    = useState({ unit_number: '', unit_type: 'whole', monthly_rent: '', bedrooms: '', deposit_months: '1', description: '' })
  const [editSaving,  setEditSaving]  = useState(false)
  const [editError,   setEditError]   = useState<string | null>(null)

  // Edit property form
  const [showEditProp,  setShowEditProp]  = useState(false)
  const [propForm,      setPropForm]      = useState({ title: '', type: 'nyumba', district: '', region: '', price_monthly: '' })
  const [propSaving,    setPropSaving]    = useState(false)
  const [propError,     setPropError]     = useState<string | null>(null)

  // Add tenant form
  const [tenantUnit,   setTenantUnit]   = useState<UnitWithLease | null>(null)
  const [tPhone,       setTPhone]       = useState('')
  const [tRent,        setTRent]        = useState('')
  const [tDeposit,     setTDeposit]     = useState('')
  const [tStartDate,   setTStartDate]   = useState(new Date().toISOString().split('T')[0])
  const [tEndDate,     setTEndDate]     = useState('')
  const [tDepPaid,     setTDepPaid]     = useState(false)
  const [tNotes,       setTNotes]       = useState('')
  const [tDocUrl,      setTDocUrl]      = useState('')
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

  function openEditProperty() {
    if (!listing) return
    setPropForm({
      title:         listing.title,
      type:          listing.type,
      district:      listing.district,
      region:        listing.region,
      price_monthly: String(listing.price_monthly),
    })
    setPropError(null)
    setShowEditProp(true)
  }

  async function handleEditProperty() {
    if (!orgId || !listing || !propForm.title.trim() || !propForm.price_monthly) {
      setPropError(t('pr_err_required')); return
    }
    setPropSaving(true); setPropError(null)
    try {
      const res = await fetch(`/api/v1/organizations/${orgId}/mali/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:         propForm.title.trim(),
          type:          propForm.type,
          district:      propForm.district.trim(),
          region:        propForm.region.trim(),
          price_monthly: Number(propForm.price_monthly),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setPropError(data.error ?? t('pr_err_generic')); return }
      setListing(prev => prev ? { ...prev, ...data.listing } : prev)
      setShowEditProp(false)
    } catch {
      setPropError(t('pr_network_err'))
    } finally { setPropSaving(false) }
  }

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
        setTenantError(t('pr_tenant_not_found'))
      }
    } catch {
      setTenantError(t('pr_network_err'))
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
        setTenantError(t('pr_invite_already_exists'))
        setInviteMsg(null)
      } else if (!res.ok) {
        setTenantError(data.error ?? t('pr_invite_send_failed'))
        setInviteMsg(null)
      } else {
        setInviteMsg(data.message ?? t('pr_invite_sent_ok'))
        setTenantError(null)
      }
    } catch {
      setTenantError(t('pr_network_err'))
    } finally { setInviting(false) }
  }

  async function handleAddUnit() {
    if (!orgId || !uNumber.trim() || !uRent) { setUnitError(t('pr_err_required')); return }
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
      if (!res.ok) { setUnitError(data.error ?? t('pr_err_generic')); return }
      setUnits(prev => [data.unit, ...prev])
      setShowAddUnit(false); setUNumber(''); setUType('whole'); setURent(''); setUBedrooms(''); setUDesc('')
    } catch {
      setUnitError(t('pr_network_err'))
    } finally { setAddingUnit(false) }
  }

  async function handleAddTenant() {
    if (!orgId || !tenantUnit || !foundTenant || !tRent || !tStartDate) {
      setTenantError(t('pr_err_required')); return
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
          document_url:   tDocUrl.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setTenantError(data.error ?? t('pr_err_generic')); return }
      // Update unit status locally
      setUnits(prev => prev.map(u =>
        u.id === tenantUnit.id ? { ...u, status: 'occupied', active_lease: data.lease } : u
      ))
      setTenantUnit(null); setTPhone(''); setFoundTenant(null); setTRent(''); setTDeposit('')
      setTStartDate(new Date().toISOString().split('T')[0]); setTEndDate(''); setTNotes(''); setTDepPaid(false); setTDocUrl('')
    } catch {
      setTenantError(t('pr_network_err'))
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
      setEditError(t('pr_err_required')); return
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
      if (!res.ok) { setEditError(data.error ?? t('pr_err_generic')); return }
      setUnits(prev => prev.map(u => u.id === editUnit.id ? { ...u, ...data.unit } : u))
      setEditUnit(null)
    } catch {
      setEditError(t('pr_network_err'))
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
        {t('pr_nav_mali')}
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
            <div className="flex items-start justify-between gap-2">
              <h1 className="font-bold text-gray-900 text-lg leading-snug">{listing.title}</h1>
              {canManage && (
                <button onClick={openEditProperty}
                  className="flex-shrink-0 flex items-center gap-1 text-xs text-gray-500 hover:text-primary-600 border border-gray-200 hover:border-primary-300 rounded-lg px-2 py-1 transition">
                  <i className="ti ti-pencil text-sm" aria-hidden="true" />
                  {t('pr_mali_edit')}
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500">{listing.district}, {listing.region}</p>
            <p className="text-primary-600 font-bold mt-1">TZS {listing.price_monthly.toLocaleString()}{t('pr_per_month')}</p>
            <div className="flex gap-3 mt-2">
              <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                {occupiedCount} {t('pr_mali_leased_count')}
              </span>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                {vacantCount} {t('pr_mali_vacant_count')}
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
        <h2 className="font-bold text-gray-900">{t('pr_mali_units_heading')} ({units.length})</h2>
        {canManage && (
          <div className="flex items-center gap-2">
            {units.length === 0 ? (
              <button
                onClick={() => setShowBuildingSetup(true)}
                className="flex items-center gap-2 bg-primary-500 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition"
              >
                <i className="ti ti-building-community" aria-hidden="true" />
                Setup Jengo
              </button>
            ) : (
              <>
                <button
                  onClick={() => setShowBuildingSetup(true)}
                  className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-gray-50 transition"
                >
                  <i className="ti ti-building-community text-sm" aria-hidden="true" />
                  Ongeza Ghorofa
                </button>
                <button
                  onClick={() => setShowAddUnit(true)}
                  className="flex items-center gap-1.5 bg-primary-500 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-primary-600 transition"
                >
                  <i className="ti ti-plus" aria-hidden="true" />
                  {t('pr_mali_add_unit')}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Add unit form */}
      {showAddUnit && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">{t('pr_mali_new_unit')}</h3>
            <button onClick={() => { setShowAddUnit(false); setUnitError(null) }} className="text-gray-400 hover:text-gray-600">
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_unit_number_label')}</label>
              <input value={uNumber} onChange={e => setUNumber(e.target.value)} placeholder="mfano: A1, Unit 3"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_unit_type_label')}</label>
              <select value={uType} onChange={e => setUType(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                {Object.entries(UNIT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_unit_rent_label')}</label>
              <input type="number" value={uRent} onChange={e => setURent(e.target.value)} placeholder="0" min="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_unit_bedrooms_label')}</label>
              <input type="number" value={uBedrooms} onChange={e => setUBedrooms(e.target.value)} placeholder="—" min="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_unit_deposit_months_label')}</label>
              <input type="number" value={uDepMonths} onChange={e => setUDepMonths(e.target.value)} placeholder="1" min="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_unit_desc_label')}</label>
              <input value={uDesc} onChange={e => setUDesc(e.target.value)} placeholder="Maelezo ya ziada..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
          </div>
          {unitError && <p className="text-sm text-red-600 mt-2">{unitError}</p>}
          <div className="flex gap-2 mt-3">
            <button onClick={() => { setShowAddUnit(false); setUnitError(null) }}
              className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 py-2.5">
              {t('pr_cancel')}
            </button>
            <button onClick={handleAddUnit} disabled={addingUnit}
              className="flex-1 bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition disabled:opacity-40">
              {addingUnit ? t('pr_unit_adding') : t('pr_mali_add_unit')}
            </button>
          </div>
        </div>
      )}

      {/* Units — empty state with setup CTA */}
      {units.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-building-community text-3xl text-primary-400" aria-hidden="true" />
          </div>
          <p className="text-gray-700 font-semibold">{t('pr_units_empty_title')}</p>
          <p className="text-sm text-gray-400 mt-1 mb-5">{t('pr_units_empty_desc')}</p>
          {canManage && (
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                onClick={() => setShowBuildingSetup(true)}
                className="flex items-center justify-center gap-2 bg-primary-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-600 transition"
              >
                <i className="ti ti-building-community" aria-hidden="true" />
                Setup Muundo wa Jengo
              </button>
              <button
                onClick={() => setShowAddUnit(true)}
                className="flex items-center justify-center gap-2 border border-gray-200 text-gray-600 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition"
              >
                <i className="ti ti-plus" aria-hidden="true" />
                Ongeza Kitengo Kimoja
              </button>
            </div>
          )}
        </div>
      ) : (() => {
        // Group units by floor_number (null → floor 0 = "Bila Ghorofa")
        const byFloor = units.reduce<Record<number, UnitWithLease[]>>((acc, u) => {
          const f = (u as unknown as { floor_number: number | null }).floor_number ?? 0
          if (!acc[f]) acc[f] = []
          acc[f].push(u)
          return acc
        }, {})
        const floorNums = Object.keys(byFloor).map(Number).sort((a, b) => a - b)
        const hasFloors = floorNums.some(f => f > 0)

        return (
          <div className="space-y-5">
            {floorNums.map(floorNum => {
              const floorUnits = byFloor[floorNum]
              const floorOccupied = floorUnits.filter(u => u.status === 'occupied').length
              return (
                <div key={floorNum}>
                  {/* Floor header */}
                  {hasFloors && (
                    <div className="flex items-center gap-3 mb-2.5">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                        {floorNum === 0 ? 'Bila Ghorofa' : `Ghorofa ${floorNum}`}
                      </span>
                      <div className="flex-1 h-px bg-gray-100" />
                      <span className="text-[10px] text-gray-400 font-medium">
                        {floorOccupied}/{floorUnits.length} zimepangishwa
                      </span>
                    </div>
                  )}

                  {/* Unit cards grid */}
                  <div className="space-y-2.5">
                    {floorUnits.map(unit => {
                      const lease  = unit.active_lease
                      const tenant = lease?.tenant as unknown as { full_name: string | null; phone: string | null } | null
                      const isExp  = expandedUnit === unit.id
                      const unitAmenities = (unit as unknown as { amenities?: string[] }).amenities ?? []

                      return (
                        <div key={unit.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                          {/* Unit summary row (always visible) */}
                          <button
                            onClick={() => setExpandedUnit(isExp ? null : unit.id)}
                            className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition"
                          >
                            {/* Status dot */}
                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                              unit.status === 'occupied'    ? 'bg-blue-500' :
                              unit.status === 'vacant'      ? 'bg-green-500' :
                              unit.status === 'maintenance' ? 'bg-amber-500' : 'bg-purple-500'
                            }`} />

                            {/* Number + type */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-gray-900 text-sm">{unit.unit_number}</p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[unit.status] ?? 'bg-gray-100 text-gray-500'}`}>
                                  {UNIT_STATUS_LABELS[unit.status]}
                                </span>
                                {unit.bedrooms != null && unit.bedrooms > 0 && (
                                  <span className="text-[10px] text-gray-400">
                                    <i className="ti ti-bed" /> {unit.bedrooms}
                                  </span>
                                )}
                                {unitAmenities.length > 0 && (
                                  <span className="text-[10px] text-gray-400">
                                    {unitAmenities.slice(0, 3).map((a: string) => {
                                      const icons: Record<string, string> = { sebule: '🛋️', jiko: '🍳', laundry: '🫧', parking: '🚗', balcony: '🌿', wifi: '📶', generator: '⚡', security: '🛡️' }
                                      return icons[a] ?? ''
                                    }).join(' ')}
                                  </span>
                                )}
                              </div>
                              {unit.status === 'occupied' && tenant?.full_name && (
                                <p className="text-xs text-blue-600 mt-0.5 truncate">
                                  <i className="ti ti-user text-[10px] mr-0.5" />{tenant.full_name}
                                </p>
                              )}
                            </div>

                            {/* Rent + chevron */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <p className="text-xs font-bold text-primary-600">
                                {(unit.monthly_rent / 1000).toFixed(0)}k
                              </p>
                              <i className={`ti ti-chevron-${isExp ? 'up' : 'down'} text-gray-400 text-sm`} />
                            </div>
                          </button>

                          {/* Expanded detail panel */}
                          {isExp && (
                            <div className="border-t border-gray-100 p-4 space-y-3">
                              {/* Full rent + type */}
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-bold text-primary-600">
                                    TZS {unit.monthly_rent.toLocaleString()}{t('pr_per_month')}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {UNIT_TYPE_LABELS[unit.unit_type]}
                                    {unit.deposit_months > 0 && ` · amana miezi ${unit.deposit_months}`}
                                    {unit.bedrooms != null && ` · vyumba ${unit.bedrooms}`}
                                    {(unit as unknown as { bathrooms?: number }).bathrooms != null && ` · vyoo ${(unit as unknown as { bathrooms: number }).bathrooms}`}
                                  </p>
                                </div>
                              </div>

                              {/* Amenities chips */}
                              {unitAmenities.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {unitAmenities.map((a: string) => {
                                    const labels: Record<string, string> = { sebule: 'Sebule', jiko: 'Jiko', laundry: 'Laundry', parking: 'Parking', balcony: 'Balcony', wifi: 'WiFi', generator: 'Generator', security: 'Security' }
                                    const icons:  Record<string, string> = { sebule: 'sofa', jiko: 'tools-kitchen-2', laundry: 'washing-machine', parking: 'car', balcony: 'building-pavilion', wifi: 'wifi', generator: 'bolt', security: 'shield-check' }
                                    return (
                                      <span key={a} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-lg flex items-center gap-1">
                                        <i className={`ti ti-${icons[a] ?? 'check'} text-[9px]`} />{labels[a] ?? a}
                                      </span>
                                    )
                                  })}
                                </div>
                              )}

                              {/* Tenant info */}
                              {unit.status === 'occupied' && lease && (
                                <div className="bg-blue-50 rounded-xl p-3">
                                  <p className="text-xs font-semibold text-blue-800">
                                    <i className="ti ti-user mr-1" />{tenant?.full_name ?? 'Mpangaji'}
                                  </p>
                                  {tenant?.phone && (
                                    <a href={`tel:${tenant.phone}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                                      <i className="ti ti-phone" /> {tenant.phone}
                                    </a>
                                  )}
                                  <div className="flex gap-3 mt-1 text-[10px] text-blue-500">
                                    <span>{t('pr_kuanza_prefix')} {new Date(lease.start_date).toLocaleDateString('sw-TZ')}</span>
                                    {lease.end_date && <span>{t('pr_kumalizika_prefix')} {new Date(lease.end_date).toLocaleDateString('sw-TZ')}</span>}
                                  </div>
                                </div>
                              )}

                              {/* Actions */}
                              {canManage && (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => openEditUnit(unit)}
                                    className="text-xs border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
                                  >
                                    <i className="ti ti-pencil mr-1" />{t('pr_mali_edit')}
                                  </button>
                                  {unit.status === 'vacant' ? (
                                    <>
                                      <button
                                        onClick={() => { setTenantUnit(unit); setTRent(String(unit.monthly_rent)); setTenantError(null) }}
                                        className="text-xs bg-primary-500 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-primary-600 transition"
                                      >
                                        {t('pr_unit_add_tenant')}
                                      </button>
                                      <a
                                        href={`/property/brokerage/new?unit_id=${unit.id}`}
                                        className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1.5 rounded-lg font-medium hover:bg-amber-100 transition whitespace-nowrap"
                                      >
                                        🤝 NF Broker
                                      </a>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => handleEndLease(unit)}
                                      className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-medium hover:bg-red-100 transition"
                                    >
                                      {t('pr_lease_end_btn')}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Edit unit modal */}
      {editUnit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end lg:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{t('pr_edit_unit_heading')}: {editUnit.unit_number}</h3>
              <button onClick={() => setEditUnit(null)} className="text-gray-400 hover:text-gray-600">
                <i className="ti ti-x text-xl" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_unit_number_label')}</label>
                  <input value={editForm.unit_number} onChange={e => setEditForm(f => ({ ...f, unit_number: e.target.value }))} placeholder="A1"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_unit_type_label')}</label>
                  <select value={editForm.unit_type} onChange={e => setEditForm(f => ({ ...f, unit_type: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                    {Object.entries(UNIT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_unit_rent_label')}</label>
                  <input type="number" value={editForm.monthly_rent} onChange={e => setEditForm(f => ({ ...f, monthly_rent: e.target.value }))} min="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_unit_bedrooms_label')}</label>
                  <input type="number" value={editForm.bedrooms} onChange={e => setEditForm(f => ({ ...f, bedrooms: e.target.value }))} placeholder="—" min="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_unit_deposit_months_label')}</label>
                  <input type="number" value={editForm.deposit_months} onChange={e => setEditForm(f => ({ ...f, deposit_months: e.target.value }))} min="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_unit_desc_label')}</label>
                  <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
              </div>
              {editError && <p className="text-sm text-red-600">{editError}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditUnit(null)}
                  className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 py-2.5">
                  {t('pr_cancel')}
                </button>
                <button onClick={handleEditUnit} disabled={editSaving}
                  className="flex-1 bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition disabled:opacity-40">
                  {editSaving ? t('pr_saving') : t('pr_save_changes')}
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
                  <h3 className="font-bold text-gray-900">{t('pr_wapangaji_add')}</h3>
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
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_tenant_phone_label')}</label>
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
                      {lookingUp ? '...' : t('pr_search_btn')}
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
                          {inviting ? t('pr_team_sending') : `${tPhone} — ${t('pr_invite_cta')}`}
                        </button>
                      )}
                    </div>
                  )}
                  {inviteMsg && (
                    <div className="mt-2 flex items-start gap-2 bg-green-50 border border-green-100 rounded-xl p-2.5">
                      <i className="ti ti-circle-check text-green-500 text-lg flex-shrink-0" aria-hidden="true" />
                      <p className="text-xs text-green-700">{inviteMsg} {t('pr_invite_follow_up')}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_tenant_rent_label')}</label>
                    <input type="number" value={tRent} onChange={e => setTRent(e.target.value)} placeholder="0" min="0"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_tenant_deposit_label')}</label>
                    <input type="number" value={tDeposit} onChange={e => setTDeposit(e.target.value)} placeholder="0" min="0"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_lease_start_label')}</label>
                    <input type="date" value={tStartDate} onChange={e => setTStartDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_lease_end_label')}</label>
                    <input type="date" value={tEndDate} onChange={e => setTEndDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={tDepPaid} onChange={e => setTDepPaid(e.target.checked)} className="rounded" />
                  <span className="text-sm text-gray-600">{t('pr_deposit_paid_label')}</span>
                </label>

                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_notes_label')}</label>
                  <textarea value={tNotes} onChange={e => setTNotes(e.target.value)} rows={2} placeholder="Maelezo..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_doc_url_label')}</label>
                  <input type="url" value={tDocUrl} onChange={e => setTDocUrl(e.target.value)} placeholder="https://..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setTenantUnit(null); setFoundTenant(null); setTenantError(null); setInviteMsg(null) }}
                    className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 py-2.5">
                    {t('pr_cancel')}
                  </button>
                  <button
                    onClick={handleAddTenant}
                    disabled={addingTenant || !foundTenant || !tRent || !tStartDate}
                    className="flex-1 bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition disabled:opacity-40"
                  >
                    {addingTenant ? t('pr_creating_lease') : t('pr_create_lease')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Building setup wizard */}
      {showBuildingSetup && orgId && (
        <BuildingSetupModal
          listingId={id}
          orgId={orgId}
          onDone={(newUnits) => {
            setUnits(prev => [...(newUnits as UnitWithLease[]), ...prev])
            setShowBuildingSetup(false)
          }}
          onClose={() => setShowBuildingSetup(false)}
        />
      )}

      {/* Edit property modal */}
      {showEditProp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end lg:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-900">{t('pr_mali_edit_heading')}</h3>
                <button onClick={() => setShowEditProp(false)} className="text-gray-400 hover:text-gray-600">
                  <i className="ti ti-x text-xl" aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_mali_title_label')}</label>
                  <input value={propForm.title} onChange={e => setPropForm(f => ({ ...f, title: e.target.value }))} placeholder="Mfano: Nyumba ya Mikocheni A"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_type_label')}</label>
                  <select value={propForm.type} onChange={e => setPropForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
                    <option value="nyumba">Nyumba</option>
                    <option value="apartment">Apartment</option>
                    <option value="chumba">Chumba</option>
                    <option value="studio">Studio</option>
                    <option value="duka">Duka</option>
                    <option value="godown">Godown</option>
                    <option value="ofisi">Ofisi</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_region_label')}</label>
                    <input value={propForm.region} onChange={e => setPropForm(f => ({ ...f, region: e.target.value }))} placeholder="Dar es Salaam"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_district_label')}</label>
                    <input value={propForm.district} onChange={e => setPropForm(f => ({ ...f, district: e.target.value }))} placeholder="Kinondoni"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('pr_price_monthly_label')}</label>
                  <input type="number" value={propForm.price_monthly} onChange={e => setPropForm(f => ({ ...f, price_monthly: e.target.value }))} placeholder="0" min="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
              </div>

              {propError && <p className="text-sm text-red-600 mt-3">{propError}</p>}

              <div className="flex gap-2 pt-4">
                <button onClick={() => setShowEditProp(false)}
                  className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 py-2.5">
                  {t('pr_cancel')}
                </button>
                <button onClick={handleEditProperty} disabled={propSaving}
                  className="flex-1 bg-primary-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition disabled:opacity-40">
                  {propSaving ? t('pr_saving') : t('pr_save_changes')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
