import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import type { SubscriptionStatus } from '@/lib/types/property'

export const revalidate = 0

type Params = { params: Promise<{ id: string }> }

const STATUS_BADGE: Record<SubscriptionStatus, { cls: string; label: string }> = {
  trial:        { cls: 'bg-blue-100 text-blue-700',    label: 'Majaribio'       },
  active:       { cls: 'bg-green-100 text-green-700',  label: 'Hai'             },
  past_due:     { cls: 'bg-amber-100 text-amber-700',  label: 'Imechelewa'      },
  grace_period: { cls: 'bg-orange-100 text-orange-700',label: 'Neema'           },
  cancelled:    { cls: 'bg-gray-100 text-gray-500',    label: 'Ilisimamishwa'   },
  expired:      { cls: 'bg-red-100 text-red-500',      label: 'Imekwisha'       },
}

const INVOICE_STATUS: Record<string, { cls: string; label: string }> = {
  pending:        { cls: 'bg-amber-50 text-amber-700',  label: 'Inasubiri'       },
  proof_uploaded: { cls: 'bg-blue-50 text-blue-700',    label: 'Ushahidi Kupakiwa'},
  confirmed:      { cls: 'bg-green-50 text-green-700',  label: 'Imethibitishwa'  },
  void:           { cls: 'bg-gray-100 text-gray-400',   label: 'Imebatilishwa'   },
}

function dateFmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmt(n: number) {
  return `Tsh ${n.toLocaleString()}`
}

const ROLE_LABELS: Record<string, string> = {
  owner:                   'Mmiliki',
  branch_manager:          'Meneja Tawi',
  agent:                   'Wakala',
  maintenance_coordinator: 'Mratibu wa Matengenezo',
  accountant:              'Mhasibu',
}

export default async function AdminOrgDetailPage({ params }: Params) {
  const { id: orgId } = await params

  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff-login')

  const authResult = await requireAdminAuth()
  if (!authResult.ok) redirect('/admin')

  const admin = createAdminClient()

  // Parallel fetches
  const [orgRes, subRes, membersRes, listingsRes, invoicesRes] = await Promise.all([
    admin.from('organizations').select('*').eq('id', orgId).maybeSingle(),
    admin.from('organization_subscriptions')
      .select('*, plan:subscription_plans(id, name, price_tzs, billing_cycle)')
      .eq('org_id', orgId)
      .maybeSingle(),
    admin.from('organization_members')
      .select('id, role, joined_at, user:users(id, full_name, email, phone)')
      .eq('organization_id', orgId)
      .order('joined_at', { ascending: true }),
    admin.from('listings')
      .select('id, title, district, region, lifecycle_status, created_at', { count: 'exact' })
      .eq('managing_org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(5),
    admin.from('subscription_invoices')
      .select('id, amount_tzs, billing_cycle, status, created_at, due_date, plan:subscription_plans(name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const org = orgRes.data
  if (!org) redirect('/admin/subscriptions')

  const sub = subRes.data
  const members = membersRes.data ?? []
  const listings = listingsRes.data ?? []
  const listingCount = listingsRes.count ?? 0
  const invoices = invoicesRes.data ?? []

  const subStatus = sub?.status as SubscriptionStatus | null
  const subBadge  = subStatus ? STATUS_BADGE[subStatus] : null
  const plan = sub?.plan as { id: string; name: string; price_tzs: number; billing_cycle: string } | null

  const pendingInvoices = invoices.filter(i => i.status === 'pending' || i.status === 'proof_uploaded').length

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/subscriptions"
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-2">
            <i className="ti ti-arrow-left text-sm" aria-hidden="true" />
            Rudi kwenye Usajili
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{org.org_type}</span>
            {subBadge && (
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${subBadge.cls}`}>
                {subBadge.label}
              </span>
            )}
            {org.deactivated_at && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Imezimwa</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link href={`/admin/subscriptions?org=${orgId}`}
            className="px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50 transition">
            Simamia Usajili
          </Link>
          {pendingInvoices > 0 && (
            <Link href={`/admin/subscriptions?tab=invoices&org=${orgId}`}
              className="px-3 py-2 bg-amber-500 text-white rounded-xl text-xs font-semibold hover:bg-amber-600 transition flex items-center gap-1">
              <i className="ti ti-receipt" aria-hidden="true" />
              Ankara {pendingInvoices}
            </Link>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* ── Subscription card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <i className="ti ti-credit-card text-primary-500" aria-hidden="true" />
            Usajili wa Sasa
          </h2>
          {sub ? (
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-gray-900">{plan?.name ?? 'Bila Mpango'}</p>
                  {plan?.price_tzs != null && (
                    <p className="text-sm text-primary-600">{fmt(plan.price_tzs)} / {plan.billing_cycle === 'annual' ? 'mwaka' : plan.billing_cycle === 'quarterly' ? 'robo mwaka' : 'mwezi'}</p>
                  )}
                </div>
                {subBadge && (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${subBadge.cls}`}>{subBadge.label}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {subStatus === 'trial' && sub.trial_ends_at && (
                  <div className="bg-gray-50 rounded-xl p-2">
                    <p className="text-gray-400">Majaribio Yanaisha</p>
                    <p className="font-semibold text-gray-800">{dateFmt(sub.trial_ends_at)}</p>
                  </div>
                )}
                {sub.current_period_end && (
                  <div className="bg-gray-50 rounded-xl p-2">
                    <p className="text-gray-400">Kipindi Kinaisha</p>
                    <p className="font-semibold text-gray-800">{dateFmt(sub.current_period_end)}</p>
                  </div>
                )}
                {sub.cancelled_at && (
                  <div className="bg-red-50 rounded-xl p-2">
                    <p className="text-red-400">Imeghairiwa</p>
                    <p className="font-semibold text-red-700">{dateFmt(sub.cancelled_at)}</p>
                  </div>
                )}
                {sub.pending_plan_id && (
                  <div className="bg-blue-50 rounded-xl p-2">
                    <p className="text-blue-400">Mpango Pending</p>
                    <p className="font-semibold text-blue-700">{dateFmt(sub.pending_plan_starts_at)}</p>
                  </div>
                )}
              </div>
              {sub.cancellation_reason && (
                <p className="text-xs text-gray-400 italic">Sababu ya kughairi: {sub.cancellation_reason}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Hakuna usajili. Shirika hili halijapewa mpango bado.</p>
          )}
        </div>

        {/* ── Quick stats ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <i className="ti ti-chart-bar text-primary-500" aria-hidden="true" />
            Muhtasari
          </h2>
          <div className="space-y-3">
            {[
              { label: 'Wanachama', value: members.length,  icon: 'users'    },
              { label: 'Mali',      value: listingCount,    icon: 'building' },
              { label: 'Ankara',    value: invoices.length, icon: 'receipt'  },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className={`ti ti-${s.icon} text-gray-300 text-sm`} aria-hidden="true" />
                  <span className="text-sm text-gray-600">{s.label}</span>
                </div>
                <span className="text-sm font-bold text-gray-900 tabular-nums">{s.value}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Iliundwa</span>
                <span className="text-xs text-gray-600">{dateFmt(org.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Members ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <i className="ti ti-users text-primary-500" aria-hidden="true" />
          Wanachama ({members.length})
        </h2>
        {members.length === 0 ? (
          <p className="text-sm text-gray-400">Hakuna wanachama.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-50">
                  <th className="text-left pb-2 font-medium">Jina</th>
                  <th className="text-left pb-2 font-medium">Simu / Barua Pepe</th>
                  <th className="text-left pb-2 font-medium">Nafasi</th>
                  <th className="text-left pb-2 font-medium">Alijiunga</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {members.map(m => {
                  const u = m.user as unknown as { id: string; full_name: string; email: string; phone: string } | null
                  return (
                    <tr key={m.id}>
                      <td className="py-2.5 font-medium text-gray-900">{u?.full_name ?? '—'}</td>
                      <td className="py-2.5 text-gray-500">{u?.phone ?? u?.email ?? '—'}</td>
                      <td className="py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.role === 'owner' ? 'bg-primary-50 text-primary-700' : 'bg-gray-100 text-gray-600'}`}>
                          {ROLE_LABELS[m.role] ?? m.role}
                        </span>
                      </td>
                      <td className="py-2.5 text-gray-400 text-xs">{dateFmt(m.joined_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* ── Recent listings ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <i className="ti ti-building text-primary-500" aria-hidden="true" />
            Mali ({listingCount})
          </h2>
          {listings.length === 0 ? (
            <p className="text-sm text-gray-400">Hakuna mali zilizosajiliwa.</p>
          ) : (
            <div className="space-y-2">
              {listings.map((l: { id: string; title: string; district: string; region: string; lifecycle_status: string; created_at: string }) => (
                <div key={l.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{l.title}</p>
                    <p className="text-xs text-gray-400">{l.district}, {l.region}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ml-2 flex-shrink-0 font-medium ${
                    l.lifecycle_status === 'listed'         ? 'bg-green-50 text-green-700' :
                    l.lifecycle_status === 'leased_managed' ? 'bg-blue-50 text-blue-700'   :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {l.lifecycle_status === 'listed' ? 'Inatangazwa' : l.lifecycle_status === 'leased_managed' ? 'Imepangishwa' : l.lifecycle_status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Invoice history ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <i className="ti ti-receipt text-primary-500" aria-hidden="true" />
            Ankara ({invoices.length})
          </h2>
          {invoices.length === 0 ? (
            <p className="text-sm text-gray-400">Hakuna ankara.</p>
          ) : (
            <div className="space-y-2">
              {invoices.map(inv => {
                const invPlan = inv.plan as unknown as { name: string } | null
                const badge   = INVOICE_STATUS[inv.status] ?? { cls: 'bg-gray-100 text-gray-500', label: inv.status }
                return (
                  <div key={inv.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{fmt(inv.amount_tzs)}</p>
                      <p className="text-xs text-gray-400">{invPlan?.name ?? '—'} · {dateFmt(inv.created_at)}</p>
                    </div>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ml-2 flex-shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
