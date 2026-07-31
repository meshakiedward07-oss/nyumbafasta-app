import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { AGREEMENT_SCOPE_LABELS, AGREEMENT_STATUS_LABELS } from '@/lib/types/property'
import type { ManagementAgreement } from '@/lib/types/property'
import { ConfirmAgreementButton } from '@/components/property/ConfirmAgreementButton'

export const metadata = { title: 'Makubaliano — NyumbaFasta Mali' }
export const revalidate = 60

export default async function AgreementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: memberships } = await admin
    .from('organization_members')
    .select('role, organization_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)

  if (!memberships?.length) redirect('/property/setup')
  const orgId = memberships[0].organization_id
  const orgRole = memberships[0].role

  const { data: agreements } = await admin
    .from('management_agreements')
    .select(`
      *,
      landlord:users!landlord_id(id, full_name, phone),
      listing:listings(id, title, district, region, images)
    `)
    .eq('managing_org_id', orgId)
    .order('created_at', { ascending: false })

  const items = (agreements ?? []) as unknown as ManagementAgreement[]

  const canCreate = ['owner', 'branch_manager'].includes(orgRole)

  const statusColor: Record<string, string> = {
    pending:   'bg-amber-50 text-amber-700',
    active:    'bg-green-50 text-green-700',
    ended:     'bg-gray-100 text-gray-500',
    cancelled: 'bg-red-50 text-red-600',
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Makubaliano ya Usimamizi</h1>
          <p className="text-sm text-gray-500">{items.length} makubaliano yote</p>
        </div>
        {canCreate && (
          <Link href="/property/agreements/ongeza">
            <button className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
              <i className="ti ti-plus" aria-hidden="true" />
              <span>Unda Mkataba</span>
            </button>
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <i className="ti ti-file-text text-5xl text-gray-200" aria-hidden="true" />
          <p className="text-gray-500 font-medium mt-3">Hakuna makubaliano bado</p>
          <p className="text-sm text-gray-400 mt-1">Makubaliano yanaunganisha shirika lako na wamiliki wa mali.</p>
          {canCreate && (
            <Link href="/property/agreements/ongeza">
              <button className="mt-4 bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
                Unda Mkataba wa Kwanza
              </button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(a => {
            const landlord = a.landlord as unknown as { full_name: string; phone: string }
            const listing  = a.listing  as unknown as { title: string; district: string; region: string } | null
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-sm transition">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i className="ti ti-file-text text-blue-500 text-lg" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{landlord?.full_name ?? 'Mmiliki'}</p>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusColor[a.status]}`}>
                        {AGREEMENT_STATUS_LABELS[a.status]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {AGREEMENT_SCOPE_LABELS[a.scope]}
                      {listing && ` · ${listing.title} (${listing.district})`}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      {landlord?.phone && (
                        <a href={`tel:${landlord.phone}`} className="flex items-center gap-1 hover:text-primary-600">
                          <i className="ti ti-phone" /> {landlord.phone}
                        </a>
                      )}
                      {a.start_date && (
                        <span className="flex items-center gap-1">
                          <i className="ti ti-calendar" />
                          {new Date(a.start_date).toLocaleDateString('sw-TZ')}
                          {a.end_date && ` – ${new Date(a.end_date).toLocaleDateString('sw-TZ')}`}
                        </span>
                      )}
                      {a.commission_value && (
                        <span className="flex items-center gap-1 text-primary-600 font-medium">
                          <i className="ti ti-coin" />
                          {a.commission_type === 'flat_fee' ? `TZS ${a.commission_value.toLocaleString()}` :
                           a.commission_type === 'percent_first_month' ? `${a.commission_value}% ya kodi ya kwanza` :
                           `${a.commission_value}% ya kodi ya mwaka`}
                        </span>
                      )}
                    </div>
                  </div>

                  {canCreate && a.status === 'pending' && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <ConfirmAgreementButton agreementId={a.id} orgId={orgId} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
