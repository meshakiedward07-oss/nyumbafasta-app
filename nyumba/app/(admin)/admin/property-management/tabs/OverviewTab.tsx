'use client'
import { useEffect, useState } from 'react'

type Tab = 'overview' | 'organizations' | 'kyc' | 'vendors' | 'commissions' | 'rent' | 'maintenance' | 'workload' | 'subscription_plans'

interface OverviewData {
  orgs:         { total: number; active: number; pending: number }
  kyc:          { pending: number; needs_more_info: number }
  maintenance:  { open: number; in_progress: number }
  rent:         { pending: number; overdue: number; total_due: number; total_paid: number }
  commissions:  { pending_count: number; total_pending: number; overdue_count: number }
  workload:     { overloaded: number; pending_requests: number }
  vendors:      { pending: number }
}

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `Tsh ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `Tsh ${(n / 1_000).toFixed(0)}K`
  return `Tsh ${n.toLocaleString()}`
}

export default function OverviewTab({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const [data,    setData]    = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [orgsRes, kycRes, maintRes, rentRes, commRes, workRes, vendRes] = await Promise.allSettled([
          fetch('/api/v1/admin/organizations?limit=1'),
          fetch('/api/v1/admin/kyc?status=pending&limit=1'),
          fetch('/api/v1/admin/maintenance?limit=1'),
          fetch('/api/v1/admin/rent-payments?limit=1'),
          fetch('/api/v1/admin/brokerage-commissions?limit=1'),
          fetch('/api/v1/admin/workload'),
          fetch('/api/v1/admin/vendors?status=pending&limit=1'),
        ])

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [orgs, kyc, maint, rent, comm, work, vend] = (await Promise.all([
          orgsRes.status  === 'fulfilled' ? orgsRes.value.json().catch(() => ({}))  : {},
          kycRes.status   === 'fulfilled' ? kycRes.value.json().catch(() => ({}))   : {},
          maintRes.status === 'fulfilled' ? maintRes.value.json().catch(() => ({})) : {},
          rentRes.status  === 'fulfilled' ? rentRes.value.json().catch(() => ({}))  : {},
          commRes.status  === 'fulfilled' ? commRes.value.json().catch(() => ({}))  : {},
          workRes.status  === 'fulfilled' ? workRes.value.json().catch(() => ({}))  : {},
          vendRes.status  === 'fulfilled' ? vendRes.value.json().catch(() => ({}))  : {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ])) as Record<string, any>[]

        setData({
          orgs: {
            total:   orgs.summary?.total   ?? 0,
            active:  orgs.summary?.active  ?? 0,
            pending: orgs.summary?.pending ?? 0,
          },
          kyc: {
            pending:        kyc.summary?.pending        ?? 0,
            needs_more_info: kyc.summary?.needs_more_info ?? 0,
          },
          maintenance: {
            open:        maint.summary?.open        ?? 0,
            in_progress: maint.summary?.in_progress ?? 0,
          },
          rent: {
            pending:    rent.summary?.pending    ?? 0,
            overdue:    rent.summary?.overdue    ?? 0,
            total_due:  rent.summary?.total_due  ?? 0,
            total_paid: rent.summary?.total_paid ?? 0,
          },
          commissions: {
            pending_count: comm.summary?.pending_count  ?? 0,
            total_pending: comm.summary?.total_pending  ?? 0,
            overdue_count: comm.summary?.overdue_count  ?? 0,
          },
          workload: {
            overloaded:       work.summary?.overloaded       ?? 0,
            pending_requests: work.summary?.pending_requests ?? 0,
          },
          vendors: {
            pending: vend.vendors?.length ?? 0,
          },
        })
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const collectRate = data && data.rent.total_due > 0
    ? Math.round((data.rent.total_paid / data.rent.total_due) * 100)
    : 0

  const statCards = data ? [
    { label: 'Mashirika',           value: data.orgs.total,              icon: 'building',      bg: '#e6f1fb', color: '#185fa5', tab: 'organizations' as Tab },
    { label: 'Mashirika Hai',       value: data.orgs.active,             icon: 'building-check',bg: '#eaf3de', color: '#3b6d11', tab: 'organizations' as Tab },
    { label: 'KYC Inasubiri',       value: data.kyc.pending + data.kyc.needs_more_info, icon: 'id', bg: '#faeeda', color: '#854f0b', tab: 'kyc' as Tab },
    { label: 'Mawakala Wapya',      value: data.vendors.pending,         icon: 'address-book',  bg: '#eeedfe', color: '#534ab7', tab: 'vendors' as Tab },
    { label: 'Matengenezo Wazi',    value: data.maintenance.open,        icon: 'tool',          bg: '#fcebeb', color: '#a32d2d', tab: 'maintenance' as Tab },
    { label: 'Mat. Inaendelea',     value: data.maintenance.in_progress, icon: 'clock',         bg: '#faeeda', color: '#854f0b', tab: 'maintenance' as Tab },
    { label: 'Kodi Inasubiri',      value: data.rent.pending,            icon: 'receipt',       bg: '#faeeda', color: '#854f0b', tab: 'rent' as Tab },
    { label: 'Kodi Imechelewa',     value: data.rent.overdue,            icon: 'alert-triangle',bg: '#fcebeb', color: '#a32d2d', tab: 'rent' as Tab },
    { label: 'Kamisheni Inasubiri', value: data.commissions.pending_count, icon: 'coin',        bg: '#e6f1fb', color: '#185fa5', tab: 'commissions' as Tab },
    { label: 'Wafanyakazi Wazidi',  value: data.workload.overloaded,     icon: 'users',         bg: '#fcebeb', color: '#a32d2d', tab: 'workload' as Tab },
  ] : []

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-xl animate-pulse" style={{ border: '1px solid #e5e5e0' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map(c => (
          <button
            key={c.label}
            onClick={() => onNavigate(c.tab)}
            className="bg-white rounded-xl p-4 text-left transition-all hover:shadow-sm hover:-translate-y-px"
            style={{ border: '1px solid #e5e5e0' }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center mb-2.5"
              style={{ background: c.bg }}
            >
              <i className={`ti ti-${c.icon} text-base`} style={{ color: c.color }} aria-hidden="true" />
            </div>
            <p className="text-2xl font-bold" style={{ color: '#1a1a18' }}>{c.value}</p>
            <p className="text-[11px] mt-0.5" style={{ color: '#999992' }}>{c.label}</p>
          </button>
        ))}
      </div>

      {/* Rent collection progress */}
      {data && (
        <div className="bg-white rounded-xl p-5" style={{ border: '1px solid #e5e5e0' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm" style={{ color: '#1a1a18' }}>Ukusanyaji wa Kodi</h3>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                background: collectRate >= 80 ? '#eaf3de' : collectRate >= 60 ? '#faeeda' : '#fcebeb',
                color:      collectRate >= 80 ? '#3b6d11' : collectRate >= 60 ? '#854f0b' : '#a32d2d',
              }}
            >
              {collectRate}% imekusanywa
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <p className="text-xs" style={{ color: '#999992' }}>Jumla Inayostahili</p>
              <p className="text-lg font-bold" style={{ color: '#1a1a18' }}>{fmtMoney(data.rent.total_due)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: '#999992' }}>Jumla Iliyolipwa</p>
              <p className="text-lg font-bold" style={{ color: '#3b6d11' }}>{fmtMoney(data.rent.total_paid)}</p>
            </div>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f4f4f0' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(collectRate, 100)}%`,
                background: collectRate >= 80 ? '#3b6d11' : collectRate >= 60 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
          <p className="text-xs mt-1.5" style={{ color: '#999992' }}>
            Deni bado: {fmtMoney(Math.max(0, data.rent.total_due - data.rent.total_paid))}
          </p>
        </div>
      )}

      {/* Quick nav cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          {
            tab: 'organizations' as Tab,
            title: 'Mashirika',
            desc: 'Simamia mashirika yaliyosajiliwa',
            icon: 'building',
            bg: '#e6f1fb',
            color: '#185fa5',
            badge: data ? `${data.orgs.pending} zinasubiri` : null,
            badgeBg: '#faeeda',
            badgeColor: '#854f0b',
          },
          {
            tab: 'kyc' as Tab,
            title: 'Uthibitisho KYC',
            desc: 'Kagua hati za wamiliki wa mali',
            icon: 'id',
            bg: '#faeeda',
            color: '#854f0b',
            badge: data ? `${data.kyc.pending} zinasubiri` : null,
            badgeBg: '#fcebeb',
            badgeColor: '#a32d2d',
          },
          {
            tab: 'vendors' as Tab,
            title: 'Mawakala',
            desc: 'Thibitisha mawakala wa matengenezo',
            icon: 'address-book',
            bg: '#eeedfe',
            color: '#534ab7',
            badge: data ? `${data.vendors.pending} wapya` : null,
            badgeBg: '#eeedfe',
            badgeColor: '#534ab7',
          },
          {
            tab: 'commissions' as Tab,
            title: 'Kamisheni',
            desc: 'Fuatilia mapato ya brokerage',
            icon: 'coin',
            bg: '#eaf3de',
            color: '#3b6d11',
            badge: data ? fmtMoney(data.commissions.total_pending) + ' inasubiri' : null,
            badgeBg: '#faeeda',
            badgeColor: '#854f0b',
          },
          {
            tab: 'maintenance' as Tab,
            title: 'Matengenezo',
            desc: 'Maombi yote ya matengenezo',
            icon: 'tool',
            bg: '#fcebeb',
            color: '#a32d2d',
            badge: data ? `${data.maintenance.open} wazi` : null,
            badgeBg: '#fcebeb',
            badgeColor: '#a32d2d',
          },
          {
            tab: 'subscription_plans' as Tab,
            title: 'Mipango ya Usajili',
            desc: 'Simamia mipango na bei',
            icon: 'list-details',
            bg: '#f4f4f0',
            color: '#666660',
            badge: null,
            badgeBg: '',
            badgeColor: '',
          },
        ].map(c => (
          <button
            key={c.tab}
            onClick={() => onNavigate(c.tab)}
            className="bg-white rounded-xl p-4 text-left transition-all hover:shadow-sm hover:-translate-y-px"
            style={{ border: '1px solid #e5e5e0' }}
          >
            <div className="flex items-start justify-between gap-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: c.bg }}
              >
                <i className={`ti ti-${c.icon} text-lg`} style={{ color: c.color }} aria-hidden="true" />
              </div>
              {c.badge && (
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: c.badgeBg, color: c.badgeColor }}
                >
                  {c.badge}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold mt-2.5" style={{ color: '#1a1a18' }}>{c.title}</p>
            <p className="text-xs mt-0.5" style={{ color: '#999992' }}>{c.desc}</p>
            <div className="flex items-center gap-1 mt-3" style={{ color: '#1D9E75' }}>
              <span className="text-xs font-medium">Fungua</span>
              <i className="ti ti-arrow-right text-xs" aria-hidden="true" />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
