'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Organization } from '@/lib/types/property'
import NotificationBell from '@/components/shared/NotificationBell'

function UnreadBadge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="ml-auto min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full px-1 flex items-center justify-center">
      {count > 9 ? '9+' : count}
    </span>
  )
}

function UnreadBadgeBottom({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="absolute -top-1 -right-2 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-0.5 leading-none">
      {count > 9 ? '9+' : count}
    </span>
  )
}


const NAV_ITEMS = [
  { href: '/property/dashboard',    icon: 'layout-dashboard', label: 'Muhtasari',      exact: true  },
  { href: '/property/mali',         icon: 'building',          label: 'Mali Zangu',     exact: false },
  { href: '/property/wapangaji',    icon: 'users',             label: 'Wapangaji',      exact: false },
  { href: '/property/kodi',         icon: 'cash',              label: 'Malipo ya Kodi', exact: false },
  { href: '/property/mazungumzo',   icon: 'message-circle',    label: 'Mazungumzo',     exact: false },
  { href: '/property/maintenance',  icon: 'tool',              label: 'Matengenezo',    exact: false },
  { href: '/property/vendors',      icon: 'address-book',      label: 'Mafundi',        exact: false },
  { href: '/property/brokerage',    icon: 'building-store',    label: 'NF Brokerage',   exact: false },
  { href: '/property/agreements',   icon: 'file-text',         label: 'Makubaliano',    exact: false },
  { href: '/property/team',         icon: 'user-plus',         label: 'Timu Yangu',     exact: false },
  { href: '/property/usajili',      icon: 'credit-card',       label: 'Usajili',        exact: false },
  { href: '/property/matumizi',     icon: 'receipt',           label: 'Matumizi',       exact: false },
  { href: '/property/hati',         icon: 'folder',            label: 'Hati',           exact: false },
  { href: '/property/taarifa',      icon: 'chart-bar',         label: 'Taarifa',        exact: false },
  { href: '/property/kyc',          icon: 'id-badge',          label: 'KYC & Benki',    exact: false },
]

const BOTTOM_NAV = [
  { href: '/property/dashboard',   icon: 'layout-dashboard', label: 'Muhtasari',  exact: true  },
  { href: '/property/mali',        icon: 'building',          label: 'Mali',       exact: false },
  { href: '/property/wapangaji',   icon: 'users',             label: 'Wapangaji',  exact: false },
  { href: '/property/mazungumzo',  icon: 'message-circle',    label: 'Ujumbe',     exact: false },
]

type Props = {
  children: React.ReactNode
  org: Organization | null
  orgRole: string | null
}

export default function PropertyShell({ children, org, orgRole }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function loadUnread() {
      try {
        const res = await fetch('/api/v1/conversations?unread=1')
        if (!res.ok) return
        const d = await res.json()
        if (!cancelled) setUnreadCount(d.unread_count ?? 0)
      } catch { /* silent */ }
    }
    loadUnread()
    const t = setInterval(loadUnread, 30_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const canManageTeam = orgRole === 'owner' || orgRole === 'branch_manager'

  const visibleNav = NAV_ITEMS.filter(item => {
    if (item.href === '/property/team' && !canManageTeam) return false
    return true
  })

  function SidebarContent({ onClose }: { onClose: () => void }) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-5 py-4 border-b border-gray-100">
          <Link href="/property/dashboard" onClick={onClose}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className="ti ti-building text-white text-base" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-gray-900 text-sm truncate">
                  {org?.name ?? 'Usimamizi wa Mali'}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {org ? (orgRole === 'owner' ? 'Mwenye Shirika' : orgRole ?? '') : 'NyumbaFasta'}
                </p>
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
            Menyu Kuu
          </p>
          <div className="space-y-0.5">
            {visibleNav.map(item => (
              <Link key={item.href} href={item.href} onClick={onClose}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive(item.href, item.exact)
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}>
                  <i className={`ti ti-${item.icon} text-base w-5 text-center flex-shrink-0`} aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.href === '/property/mazungumzo' && !isActive(item.href, item.exact)
                    ? <UnreadBadge count={unreadCount} />
                    : isActive(item.href, item.exact) && (
                        <span className="ml-auto w-1.5 h-1.5 bg-white/70 rounded-full" />
                      )
                  }
                </div>
              </Link>
            ))}
          </div>
        </nav>

        <div className="px-3 pb-4 border-t border-gray-100 pt-3 space-y-0.5">
          <Link href="/" onClick={onClose}>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 hover:bg-gray-100 text-sm">
              <i className="ti ti-world" aria-hidden="true" />
              <span>Rudi Kwenye App</span>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/property/mipangilio" onClick={onClose} className="flex-1">
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 hover:bg-gray-100 text-sm">
                <i className="ti ti-settings" aria-hidden="true" />
                <span>Mipangilio ya Shirika</span>
              </div>
            </Link>
            <NotificationBell href="/notifications" className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-500" />
          </div>
          <button onClick={handleLogout} className="w-full text-left">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 text-sm">
              <i className="ti ti-door-exit" aria-hidden="true" />
              <span>Toka</span>
            </div>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 flex-shrink-0 flex-col bg-white border-r border-gray-200 h-full">
        <SidebarContent onClose={() => {}} />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 z-40 flex items-center justify-between flex-shrink-0">
          <Link href="/property/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <i className="ti ti-building text-white text-sm" aria-hidden="true" />
            </div>
            <span className="font-bold text-gray-900 text-sm truncate max-w-[140px]">
              {org?.name ?? 'Mali'}
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell href="/notifications" className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-500" />
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 rounded-xl bg-gray-100"
              aria-label="Fungua menyu"
            >
              <div className="space-y-1">
                <div className="w-5 h-0.5 bg-gray-600 rounded" />
                <div className="w-5 h-0.5 bg-gray-600 rounded" />
                <div className="w-5 h-0.5 bg-gray-600 rounded" />
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-gray-200"
           style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-stretch h-16">
          {BOTTOM_NAV.map(item => {
            const active = isActive(item.href, item.exact)
            return (
              <Link key={item.href} href={item.href}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 relative group">
                {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-500 rounded-b-full" />}
                <div className="relative">
                  <i className={`ti ti-${item.icon} text-[22px] transition-colors ${active ? 'text-primary-500' : 'text-gray-400'}`} aria-hidden="true" />
                  {item.href === '/property/mazungumzo' && !active && <UnreadBadgeBottom count={unreadCount} />}
                </div>
                <span className={`text-[10px] font-semibold ${active ? 'text-primary-500' : 'text-gray-400'}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl overflow-y-auto">
            <SidebarContent onClose={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
