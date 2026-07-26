import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { ORG_TYPE_LABELS, ORG_ROLE_LABELS } from '@/lib/types/property'
import type { Organization, ManagementAgreement } from '@/lib/types/property'

export const metadata = { title: 'Dashibodi — NyumbaFasta Mali' }
export const revalidate = 60

export default async function PropertyDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/property/dashboard')

  const admin = createAdminClient()

  // Get memberships
  const { data: memberships } = await admin
    .from('organization_members')
    .select('role, organization:organizations(*)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(10)

  if (!memberships || memberships.length === 0) redirect('/property/setup')

  const ownerM    = memberships.find(m => m.role === 'owner')
  const primary   = ownerM ?? memberships[0]
  const org       = primary.organization as unknown as Organization
  const orgRole   = primary.role
  const orgId     = org.id

  // Stats in parallel
  const [membersRes, agreementsRes, listingsRes] = await Promise.all([
    admin.from('organization_members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
    admin.from('management_agreements').select('id, status, scope, landlord:users!landlord_id(full_name, phone), listing:listings(id, title, district)').eq('managing_org_id', orgId).order('created_at', { ascending: false }).limit(5),
    admin.from('listings').select('id, title, district, region, status, lifecycle_status, listing_source', { count: 'exact' }).eq('managing_org_id', orgId).limit(5),
  ])

  const memberCount     = membersRes.count ?? 0
  const agreements      = (agreementsRes.data ?? []) as unknown as ManagementAgreement[]
  const listings        = listingsRes.data ?? []
  const listingCount    = listingsRes.count ?? 0
  const activeAgreements = agreements.filter(a => a.status === 'active').length

  const userProfile = await admin.from('users').select('full_name').eq('id', user.id).single()
  const firstName = (userProfile.data?.full_name as string | null)?.split(' ')[0] ?? 'Karibu'

  const stats = [
    { label: 'Mali Zilizosajiliwa',  value: listingCount,      icon: 'building',    color: 'bg-blue-50 text-blue-600'   },
    { label: 'Makubaliano Hai',      value: activeAgreements,  icon: 'file-check',  color: 'bg-green-50 text-green-600' },
    { label: 'Wanachama wa Timu',    value: memberCount,       icon: 'users',       color: 'bg-purple-50 text-purple-600'},
    { label: 'Wapangaji',            value: 0,                 icon: 'home-heart',  color: 'bg-amber-50 text-amber-600'  },
  ]

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-gray-500">Habari, {firstName} 👋</p>
        <div className="flex items-center gap-3 mt-1">
          <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="ti ti-building text-white text-lg" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{org.name}</h1>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-primary-50 text-primary-700 font-medium px-2 py-0.5 rounded-full">
                {ORG_TYPE_LABELS[org.org_type]}
              </span>
              <span className="text-xs text-gray-400">
                {ORG_ROLE_LABELS[orgRole as keyof typeof ORG_ROLE_LABELS]}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className={`w-9 h-9 ${s.color} rounded-xl flex items-center justify-center mb-2`}>
              <i className={`ti ti-${s.icon} text-base`} aria-hidden="true" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { href: '/property/mali/ongeza',  icon: 'building-plus',  label: 'Ongeza Mali',      color: 'bg-primary-500 text-white' },
          { href: '/property/agreements/ongeza', icon: 'file-plus', label: 'Unda Mkataba',    color: 'bg-blue-500 text-white'    },
          { href: '/property/team',          icon: 'user-plus',      label: 'Alika Mwanachama', color: 'bg-purple-500 text-white'  },
          { href: '/property/wapangaji',     icon: 'users',          label: 'Angalia Wapangaji', color: 'bg-amber-500 text-white'  },
        ].map(a => (
          <Link key={a.href} href={a.href}>
            <div className={`${a.color} rounded-xl p-4 flex flex-col items-center gap-2 text-center hover:opacity-90 transition`}>
              <i className={`ti ti-${a.icon} text-2xl`} aria-hidden="true" />
              <span className="text-xs font-semibold">{a.label}</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recent listings */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Mali Zilizosajiliwa</h2>
            <Link href="/property/mali" className="text-xs text-primary-600 hover:underline">Angalia Zote</Link>
          </div>
          {listings.length === 0 ? (
            <div className="text-center py-8">
              <i className="ti ti-building text-4xl text-gray-200" aria-hidden="true" />
              <p className="text-sm text-gray-400 mt-2">Huna mali zilizosajiliwa bado.</p>
              <Link href="/property/mali/ongeza">
                <button className="mt-3 text-xs bg-primary-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-primary-600 transition">
                  Ongeza Mali ya Kwanza
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {listings.map((l: { id: string; title: string; district: string; region: string; status: string; lifecycle_status: string; listing_source: string }) => (
                <div key={l.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className="ti ti-home text-gray-400 text-sm" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{l.title}</p>
                    <p className="text-xs text-gray-400">{l.district}, {l.region}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    l.lifecycle_status === 'listed' ? 'bg-green-50 text-green-700' :
                    l.lifecycle_status === 'leased_managed' ? 'bg-blue-50 text-blue-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {l.lifecycle_status === 'listed' ? 'Inatangazwa' :
                     l.lifecycle_status === 'leased_managed' ? 'Imepangishwa' :
                     l.lifecycle_status === 'ended' ? 'Imekwisha' : l.lifecycle_status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent agreements */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Makubaliano ya Hivi Karibuni</h2>
            <Link href="/property/agreements" className="text-xs text-primary-600 hover:underline">Angalia Zote</Link>
          </div>
          {agreements.length === 0 ? (
            <div className="text-center py-8">
              <i className="ti ti-file-text text-4xl text-gray-200" aria-hidden="true" />
              <p className="text-sm text-gray-400 mt-2">Hakuna makubaliano bado.</p>
              <Link href="/property/agreements/ongeza">
                <button className="mt-3 text-xs bg-primary-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-primary-600 transition">
                  Unda Mkataba
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {agreements.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className="ti ti-file-text text-blue-500 text-sm" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {(a.landlord as unknown as { full_name: string })?.full_name ?? 'Mmiliki'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {a.scope === 'maintenance_only' ? 'Matengenezo Tu' :
                       a.scope === 'full_management'  ? 'Usimamizi Kamili' : 'Usaidizi wa Kutangaza'}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    a.status === 'active'  ? 'bg-green-50 text-green-700' :
                    a.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {a.status === 'active' ? 'Inaendelea' : a.status === 'pending' ? 'Inasubiri' : a.status === 'ended' ? 'Imekwisha' : 'Imefutwa'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Phase coming soon banners */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
        {[
          { icon: 'users', title: 'Wapangaji & Mikataba ya Upangaji', desc: 'Fuatilia wapangaji, mikataba, na malipo ya kumbukumbu.', phase: 2 },
          { icon: 'tool',  title: 'Matengenezo ya Nyumba',            desc: 'Pokea maombi ya matengenezo na wapeleke mafundi sahihi.', phase: 4 },
          { icon: 'chart-bar', title: 'Taarifa za Mapato',            desc: 'Angalia mwenendo wa mapato na matumizi ya mali zako.',  phase: 9 },
        ].map(f => (
          <div key={f.title} className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center flex-shrink-0 border border-gray-200">
                <i className={`ti ti-${f.icon} text-gray-400 text-base`} aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">{f.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{f.desc}</p>
                <span className="inline-block mt-1.5 text-[10px] bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                  Inakuja — Awamu {f.phase}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
