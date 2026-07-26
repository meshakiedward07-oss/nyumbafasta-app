import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { ORG_TYPE_LABELS } from '@/lib/types/property'
import type { Organization } from '@/lib/types/property'

export const metadata = { title: 'Usimamizi wa Mali — Admin' }
export const revalidate = 30

export default async function PropertyManagementAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff-login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!['admin', 'staff'].includes(profile?.role ?? '')) redirect('/admin/no-access')

  const admin = createAdminClient()

  // All key data in parallel
  const [orgsRes, agreementsRes, serviceReqRes, kycRes, commissionRes, conflictRes, workloadRes] = await Promise.all([
    admin.from('organizations').select('*, member_count:organization_members(count)', { count: 'exact' }).order('created_at', { ascending: false }).limit(20),
    admin.from('management_agreements').select('id, status, scope, created_at, landlord:users!landlord_id(full_name, phone), organization:organizations(name, org_type)', { count: 'exact' }).order('created_at', { ascending: false }).limit(10),
    admin.from('service_requests').select('id, status, request_type, conflict_flag, created_at, landlord:users!landlord_id(full_name, phone)', { count: 'exact' }).order('created_at', { ascending: false }).limit(10),
    admin.from('kyc_submissions').select('id, status, submitted_at', { count: 'exact' }).eq('status', 'pending').limit(5),
    admin.from('brokerage_commissions').select('calculated_amount, collection_status').limit(200),
    admin.from('conflict_flags').select('id, flag_type, created_at, listing:listings(title, district)', { count: 'exact' }).eq('resolved', false).order('created_at', { ascending: false }).limit(10),
    admin.from('staff_workload').select('*, staff:users(id, full_name, role)').order('active_managed_properties', { ascending: false }).limit(10),
  ])

  const orgs         = (orgsRes.data ?? []) as unknown as (Organization & { member_count: [{ count: number }] })[]
  const orgCount     = orgsRes.count ?? 0
  const agreementCount = agreementsRes.count ?? 0
  const serviceReqs  = serviceReqRes.data ?? []
  const serviceReqCount = serviceReqRes.count ?? 0
  const pendingKyc   = kycRes.count ?? 0
  const commissions  = commissionRes.data ?? []
  const conflicts    = conflictRes.data ?? []
  const conflictCount = conflictRes.count ?? 0
  const workload     = workloadRes.data ?? []

  const pendingReqs  = serviceReqs.filter((r: { status: string }) => r.status === 'pending').length
  const conflictReqs = serviceReqs.filter((r: { conflict_flag: boolean }) => r.conflict_flag).length

  const totalCommission  = commissions.reduce((s: number, c: { calculated_amount: number | null }) => s + (c.calculated_amount ?? 0), 0)
  const collectedAmount  = commissions.filter((c: { collection_status: string }) => c.collection_status === 'collected').reduce((s: number, c: { calculated_amount: number | null }) => s + (c.calculated_amount ?? 0), 0)

  // Source split: dalali vs nyumbafasta_managed
  const { data: sourceSplit } = await admin.from('listings').select('listing_source').limit(1000)
  const totalListings   = sourceSplit?.length ?? 0
  const managedListings = sourceSplit?.filter((l: { listing_source: string }) => l.listing_source === 'nyumbafasta_managed').length ?? 0
  const dalaliListings  = totalListings - managedListings
  const managedPct      = totalListings > 0 ? Math.round((managedListings / totalListings) * 100) : 0

  const summaryCards = [
    { label: 'Mashirika',          value: orgCount,       icon: 'building',    color: 'bg-blue-50 text-blue-600'    },
    { label: 'Makubaliano',        value: agreementCount, icon: 'file-text',   color: 'bg-green-50 text-green-600'  },
    { label: 'Maombi ya Huduma',   value: serviceReqCount,icon: 'clipboard',   color: 'bg-amber-50 text-amber-600'  },
    { label: 'KYC Zinazosubiri',   value: pendingKyc,     icon: 'id',          color: 'bg-purple-50 text-purple-600'},
    { label: 'Migogoro Wazi',      value: conflictCount,  icon: 'alert-circle',color: 'bg-red-50 text-red-600'      },
    { label: 'Mapato ya Kamisheni',value: `TZS ${(totalCommission / 1000).toFixed(0)}K`, icon: 'coin', color: 'bg-emerald-50 text-emerald-600' },
  ]

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Usimamizi wa Mali</h1>
        <p className="text-sm text-gray-500">Muhtasari wa mfumo wa brokerage na property management</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {summaryCards.map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className={`w-9 h-9 ${c.color} rounded-xl flex items-center justify-center mb-2`}>
              <i className={`ti ti-${c.icon} text-base`} aria-hidden="true" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            <p className="text-xs text-gray-500">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Strategic ratio warning */}
      {totalListings > 0 && (
        <div className={`rounded-2xl border p-4 mb-6 ${managedPct >= 30 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center gap-3">
            <i className={`ti ti-chart-pie text-2xl ${managedPct >= 30 ? 'text-amber-500' : 'text-gray-400'}`} aria-hidden="true" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <p className={`font-semibold text-sm ${managedPct >= 30 ? 'text-amber-800' : 'text-gray-700'}`}>
                  Uwiano wa Dalali dhidi ya NyumbaFasta-Managed
                </p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${managedPct >= 30 ? 'bg-amber-200 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
                  {managedPct}% managed
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${managedPct >= 30 ? 'bg-amber-400' : 'bg-primary-500'}`} style={{ width: `${managedPct}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {dalaliListings} kutoka kwa madalali · {managedListings} zinazoshughulikiwa na wafanyakazi
                {managedPct >= 30 && ' ⚠️ Ishara ya tahadhari: Angalia uhusiano na madalali'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Organizations list */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Mashirika ({orgCount})</h2>
            <Link href="/api/v1/admin/organizations" className="text-xs text-primary-600 hover:underline">API</Link>
          </div>
          {orgs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Hakuna mashirika bado</p>
          ) : (
            <div className="space-y-2">
              {orgs.slice(0, 10).map(org => {
                const memberCount = (org as unknown as { member_count: [{ count: number }] }).member_count?.[0]?.count ?? 0
                return (
                  <div key={org.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                    <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <i className="ti ti-building text-primary-500 text-base" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{org.name}</p>
                      <p className="text-xs text-gray-400">
                        {ORG_TYPE_LABELS[org.org_type]} · {memberCount} wanachama
                        {org.region && ` · ${org.region}`}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      org.status === 'active' ? 'bg-green-50 text-green-700' :
                      org.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
                    }`}>
                      {org.status === 'active' ? 'Hai' : org.status === 'pending' ? 'Inasubiri' : 'Imezuiwa'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Conflict flags */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h2 className="font-bold text-gray-900 mb-3">
              Migogoro Inayosubiri
              {conflictCount > 0 && <span className="ml-2 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">{conflictCount}</span>}
            </h2>
            {conflicts.length === 0 ? (
              <div className="text-center py-4">
                <i className="ti ti-circle-check text-3xl text-green-200" aria-hidden="true" />
                <p className="text-xs text-gray-400 mt-1">Hakuna migogoro inayosubiri</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(conflicts as unknown as Array<{ id: string; flag_type: string; created_at: string; listing: { title: string; district: string } | null }>).map(f => (
                  <div key={f.id} className="p-2 bg-red-50 rounded-xl">
                    <p className="text-xs font-medium text-red-700">
                      {f.flag_type === 'existing_dalali_listing' ? 'Dalali tayari ana listing hii' : 'Ombi mara mbili'}
                    </p>
                    <p className="text-xs text-red-500 mt-0.5">
                      {f.listing?.title ?? 'Mali isiyojulikana'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Staff workload */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h2 className="font-bold text-gray-900 mb-3">Mzigo wa Wafanyakazi</h2>
            {workload.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">Hakuna data bado</p>
            ) : (
              <div className="space-y-2">
                {workload.map((w: { staff_id: string; active_managed_properties: number; max_capacity: number; staff: { full_name: string | null } | null }) => {
                  const pct = w.max_capacity > 0 ? Math.round((w.active_managed_properties / w.max_capacity) * 100) : 0
                  return (
                    <div key={w.staff_id}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-700 font-medium">{(w.staff as { full_name: string | null } | null)?.full_name ?? 'Mfanyakazi'}</span>
                        <span className={pct >= 90 ? 'text-red-500' : pct >= 70 ? 'text-amber-500' : 'text-gray-400'}>
                          {w.active_managed_properties}/{w.max_capacity}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-primary-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Commission summary */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h2 className="font-bold text-gray-900 mb-3">Muhtasari wa Kamisheni</h2>
            <div className="space-y-2">
              {[
                { label: 'Jumla Inayodaiwa',   value: totalCommission,             color: 'text-gray-700' },
                { label: 'Imekusanywa',         value: collectedAmount,             color: 'text-green-600'},
                { label: 'Bado Haikukusanywa',  value: totalCommission - collectedAmount, color: 'text-amber-600' },
              ].map(c => (
                <div key={c.label} className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">{c.label}</span>
                  <span className={`text-sm font-bold ${c.color}`}>
                    TZS {c.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            <Link href="/api/v1/admin/commission-rules">
              <button className="w-full mt-3 text-xs border border-gray-200 text-gray-600 py-2 rounded-xl hover:bg-gray-50 transition">
                Badilisha Sheria za Kamisheni
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent service requests */}
      {serviceReqs.length > 0 && (
        <div className="mt-4 bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Maombi ya Huduma</h2>
            <div className="flex gap-2">
              {pendingReqs > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{pendingReqs} zinazosubiri</span>}
              {conflictReqs > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{conflictReqs} zenye mgogoro</span>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Mmiliki</th>
                  <th className="text-left pb-2 font-medium">Aina</th>
                  <th className="text-left pb-2 font-medium">Hali</th>
                  <th className="text-left pb-2 font-medium">Tarehe</th>
                  <th className="text-left pb-2 font-medium">Mgogoro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(serviceReqs as unknown as Array<{ id: string; request_type: string; status: string; conflict_flag: boolean; created_at: string; landlord: { full_name: string; phone: string } | null }>).map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="py-2 font-medium text-gray-900">{r.landlord?.full_name ?? '—'}</td>
                    <td className="py-2 text-gray-500 text-xs">
                      {r.request_type === 'staff_assisted_listing' ? 'Kutangaza kwa Msaada' :
                       r.request_type === 'kyc_only' ? 'KYC Tu' : 'Usimamizi'}
                    </td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.status === 'pending'     ? 'bg-amber-50 text-amber-700' :
                        r.status === 'assigned'    ? 'bg-blue-50 text-blue-700'   :
                        r.status === 'in_progress' ? 'bg-purple-50 text-purple-700':
                        r.status === 'completed'   ? 'bg-green-50 text-green-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {r.status === 'pending' ? 'Inasubiri' : r.status === 'assigned' ? 'Imepewa' : r.status === 'in_progress' ? 'Inaendelea' : r.status === 'completed' ? 'Imekamilika' : r.status}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('sw-TZ')}</td>
                    <td className="py-2">
                      {r.conflict_flag && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">Mgogoro</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
