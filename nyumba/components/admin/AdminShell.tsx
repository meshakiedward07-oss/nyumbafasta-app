'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { STAFF_PERMISSIONS, ADMIN_TASK_PERMISSIONS } from '@/lib/staff/permissions'
import type { PermissionKey } from '@/lib/staff/permissions'
import { PlatformLogo } from '@/components/shared/PlatformLogo'

const BRAND_PLATFORMS = new Set(['whatsapp', 'instagram', 'facebook', 'tiktok'])

// Polls every 30s — avoids Supabase realtime channel conflicts across mounts
function PendingBadge() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const supabase = createClient()
        const { count: c } = await supabase
          .from('whatsapp_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
        if (!cancelled) setCount(c ?? 0)
      } catch {
        // table may not exist yet — fail silently
      }
    }

    load()
    const timer = setInterval(load, 30_000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  if (count === 0) return null
  return (
    <span className="ml-auto min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 flex items-center justify-center">
      {count > 99 ? '99+' : count}
    </span>
  )
}

const NAV_SECTIONS = [
  {
    title: 'Muhtasari',
    items: [
      { href: '/admin', label: 'Dashibodi', icon: 'chart-bar', exact: true },
    ],
  },
  {
    title: 'WhatsApp',
    items: [
      { href: '/admin/whatsapp',           label: 'Mazungumzo',  icon: 'brand-whatsapp', exact: false, badge: true },
      { href: '/admin/whatsapp/broadcast', label: 'Tuma Ujumbe', icon: 'speakerphone', exact: false },
    ],
  },
  {
    title: 'Mitandao ya Jamii',
    items: [
      { href: '/admin/social',            label: 'Muhtasari',  icon: 'chart-bar', exact: true  },
      { href: '/admin/social?tab=postnow',label: 'Chapisha',   icon: 'pencil', exact: false },
    ],
  },
  {
    title: 'Utafutaji wa Wateja',
    items: [
      { href: '/admin/leads',               label: 'Leads Zote',    icon: 'robot', exact: false },
      { href: '/admin/facebook-groups',     label: 'Vikundi FB',    icon: 'users', exact: false },
      { href: '/admin/instagram-profiles',  label: 'Wasifu IG',     icon: 'brand-instagram', exact: false },
    ],
  },
  {
    title: 'CRM',
    items: [
      { href: '/admin/crm',               label: 'Mchakato',         icon: 'target', exact: true  },
      { href: '/admin/crm/assign',        label: 'Mgawanyo',         icon: 'user-tie', exact: false },
      { href: '/admin/crm/analytics',     label: 'Takwimu',          icon: 'chart-bar', exact: false },
      { href: '/admin/crm/reports',       label: 'Ripoti',           icon: 'trending-up', exact: false },
      { href: '/admin/crm/commission',    label: 'Kamisheni',        icon: 'coin', exact: false },
      { href: '/admin/crm/templates',     label: 'Violezo WA',       icon: 'message-circle', exact: false },
    ],
  },
  {
    title: 'Usimamizi',
    items: [
      { href: '/admin/staff',         label: 'Wafanyakazi',      icon: 'user-tie', exact: false },
      { href: '/admin/staff-leads',   label: 'Leads za Wafanyakazi', icon: 'target', exact: false },
      { href: '/admin/users',         label: 'Watumiaji',        icon: 'users', exact: false },
      { href: '/admin/listings',      label: 'Matangazo',        icon: 'home', exact: false },
      { href: '/admin/verifications', label: 'Uthibitisho',      icon: 'check', exact: false },
      { href: '/admin/subscriptions', label: 'Usajili',          icon: 'credit-card', exact: false },
    ],
  },
  {
    title: 'Matangazo ya Biashara',
    items: [
      { href: '/admin/adverts',        label: 'Kampeni',       icon: 'speakerphone', exact: false },
      { href: '/admin/adverts/plans',  label: 'Mipango',       icon: 'list',         exact: false },
    ],
  },
  {
    title: 'Fedha',
    items: [
      { href: '/admin/accounting', label: 'Hesabu', icon: 'coin', exact: false },
    ],
  },
  {
    title: 'Kisheria',
    items: [
      { href: '/admin/legal', label: 'Makubaliano & Malalamiko', icon: 'scale', exact: false },
    ],
  },
]

const BOTTOM_NAV = [
  { href: '/admin',            icon: 'chart-bar', label: 'Nyumbani',  exact: true  },
  { href: '/admin/whatsapp',   icon: 'brand-whatsapp', label: 'WhatsApp',  exact: false },
  { href: '/admin/leads',      icon: 'robot', label: 'Leads',     exact: false },
  { href: '/admin/crm',        icon: 'target', label: 'CRM',       exact: false },
  { href: '/admin/accounting', icon: 'coin', label: 'Hesabu',    exact: false },
]

const STAFF_BOTTOM_NAV = [
  { href: '/admin/staff-dashboard', icon: 'layout-dashboard', label: 'Dashboard', exact: false },
  { href: '/admin/staff-leads',     icon: 'target',           label: 'Leads',     exact: false },
]

// ── Staff dynamic sidebar ──────────────────────────────────────────────────
function StaffSidebar({
  pathname,
  onLinkClick,
  onLogout,
}: {
  pathname: string
  onLinkClick: () => void
  onLogout: () => void
}) {
  const [granted, setGranted] = useState<PermissionKey[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/staff/me/permissions')
      .then(r => r.json())
      .then(d => setGranted(d.granted ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-gray-100">
        <Link href="/admin/staff-dashboard" onClick={onLinkClick}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">NF</span>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">NyumbaFasta</p>
              <p className="text-xs text-gray-400">Jopo la Wafanyakazi</p>
            </div>
          </div>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1.5">
          Vipengele Vyangu
        </p>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-xl mb-1" />
          ))
        ) : granted.length === 0 ? (
          <p className="text-xs text-gray-400 px-3 py-2">
            Huna ruhusa bado. Wasiliana na admin.
          </p>
        ) : (
          <>
            {/* Staff Dashboard — shown once if any admin-task permission is granted */}
            {granted.some(k => ADMIN_TASK_PERMISSIONS.includes(k)) && (
              <Link href="/admin/staff-dashboard" onClick={onLinkClick}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${
                  isActive('/admin/staff-dashboard')
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}>
                  <i className="ti ti-layout-dashboard text-base w-5 text-center flex-shrink-0" aria-hidden="true" />
                  <span>Dashboard Yangu</span>
                  {isActive('/admin/staff-dashboard') && (
                    <span className="ml-auto w-1.5 h-1.5 bg-white/70 rounded-full" />
                  )}
                </div>
              </Link>
            )}
            {/* Individual non-admin-task permissions */}
            {granted
              .filter(k => !ADMIN_TASK_PERMISSIONS.includes(k))
              .map(key => {
                const perm = STAFF_PERMISSIONS[key]
                if (!perm) return null
                return (
                  <Link key={key} href={perm.adminPath} onClick={onLinkClick}>
                    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${
                      isActive(perm.adminPath)
                        ? 'bg-primary-500 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}>
                      <i className={`ti ti-${perm.icon} text-base w-5 text-center flex-shrink-0`} aria-hidden="true" />
                      <span>{perm.label}</span>
                      {isActive(perm.adminPath) && (
                        <span className="ml-auto w-1.5 h-1.5 bg-white/70 rounded-full" />
                      )}
                    </div>
                  </Link>
                )
              })}
          </>
        )}
      </nav>
      <div className="px-3 pb-4 border-t border-gray-100 pt-3 space-y-0.5">
        <button onClick={onLogout} className="w-full text-left">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 text-sm">
<i className="ti ti-door-exit" aria-hidden="true" /><span>Toka</span>
          </div>
        </button>
      </div>
    </div>
  )
}

// ── Sidebar content extracted as standalone component ──────────────────────
type SidebarProps = {
  pathname: string
  onLinkClick: () => void
  onLogout: () => void
}

function SidebarContent({ pathname, onLinkClick, onLogout }: SidebarProps) {
  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <Link href="/admin" onClick={onLinkClick}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">NF</span>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">NyumbaFasta</p>
              <p className="text-xs text-gray-400">Jopo la Msimamizi</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map(section => (
          <div key={section.title} className="mb-5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1.5">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  onClick={onLinkClick}
                >
                  <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
                    isActive(item.href, item.exact)
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}>
{item.icon.startsWith('brand-') && BRAND_PLATFORMS.has(item.icon.replace('brand-', ''))
                      ? <PlatformLogo platform={item.icon.replace('brand-', '')} size={16} className="flex-shrink-0" />
                      : <i className={`ti ti-${item.icon} text-base w-5 text-center flex-shrink-0`} aria-hidden="true" />}
                    <span>{item.label}</span>
                    {('badge' in item && item.badge) && !isActive(item.href, item.exact) && (
                      <PendingBadge />
                    )}
                    {isActive(item.href, item.exact) && (
                      <span className="ml-auto w-1.5 h-1.5 bg-white/70 rounded-full" />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom links */}
      <div className="px-3 pb-4 border-t border-gray-100 pt-3 space-y-0.5">
        <Link href="/" onClick={onLinkClick}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 hover:bg-gray-100 text-sm">
<i className="ti ti-world" aria-hidden="true" /><span>Rudi Kwenye App</span>
          </div>
        </Link>
        <button onClick={onLogout} className="w-full text-left">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 text-sm">
<i className="ti ti-door-exit" aria-hidden="true" /><span>Toka</span>
          </div>
        </button>
      </div>
    </div>
  )
}

// ── Main shell ─────────────────────────────────────────────────────────────
export default function AdminShell({
  children,
  initialRole = 'admin',
}: {
  children: React.ReactNode
  initialRole?: string
}) {
  const pathname = usePathname()
  const router   = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [userRole,   setUserRole]   = useState<string>(initialRole)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('users').select('role').eq('id', user.id).single()
        .then(({ data }) => setUserRole(data?.role ?? initialRole))
    })
  }, [initialRole])

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isStaff = userRole === 'staff'

  // Social dashboard: fixed full-viewport overlay — hides everything (sidebar, footer, body scroll)
  if (pathname.startsWith('/admin/social')) {
    return <div className="fixed inset-0 overflow-hidden bg-[#f4f4f0] z-10">{children}</div>
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* ── Desktop sidebar (lg+) ── */}
      <aside className="hidden lg:flex lg:w-64 flex-shrink-0 flex-col bg-white border-r border-gray-200 h-full overflow-y-auto">
        {isStaff ? (
          <StaffSidebar pathname={pathname} onLinkClick={() => {}} onLogout={handleLogout} />
        ) : (
          <SidebarContent pathname={pathname} onLinkClick={() => {}} onLogout={handleLogout} />
        )}
      </aside>

      {/* ── Right column: mobile header + content ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Mobile top header */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 z-40 flex items-center justify-between flex-shrink-0">
          <Link href={isStaff ? '/admin/staff-dashboard' : '/admin'}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">NF</span>
              </div>
              <span className="font-bold text-gray-900 text-sm">{isStaff ? 'Dashboard' : 'Admin'}</span>
            </div>
          </Link>
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 rounded-xl bg-gray-100"
            aria-label="Open menu"
          >
            <div className="space-y-1">
              <div className="w-5 h-0.5 bg-gray-600 rounded" />
              <div className="w-5 h-0.5 bg-gray-600 rounded" />
              <div className="w-5 h-0.5 bg-gray-600 rounded" />
            </div>
          </button>
        </header>

        {/* Page content — extra bottom padding so content clears the fixed bottom nav */}
        <main className="flex-1 overflow-y-auto lg:pb-0 pb-20">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom nav (fixed) ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-gray-200"
           style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-stretch h-16">
          {isStaff ? (
            // Staff-specific bottom nav
            STAFF_BOTTOM_NAV.map(item => {
              const active = isActive(item.href, item.exact)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 relative group"
                >
                  {active && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-500 rounded-b-full" />
                  )}
                  <i className={`ti ti-${item.icon} text-[22px] transition-colors ${
                    active ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-600'
                  }`} aria-hidden="true" />
                  <span className={`text-[10px] font-semibold tracking-wide transition-colors ${
                    active ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-600'
                  }`}>
                    {item.label}
                  </span>
                </Link>
              )
            })
          ) : (
            // Admin bottom nav
            BOTTOM_NAV.map(item => {
              const active = isActive(item.href, item.exact)
              return (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 relative group"
                >
                  {active && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-500 rounded-b-full" />
                  )}
                  <div className="relative">
                    {item.icon.startsWith('brand-') && BRAND_PLATFORMS.has(item.icon.replace('brand-', ''))
                      ? (
                        <span className={`transition-opacity ${active ? 'opacity-100' : 'opacity-40 group-hover:opacity-60'}`}>
                          <PlatformLogo platform={item.icon.replace('brand-', '')} size={22} />
                        </span>
                      )
                      : (
                        <i className={`ti ti-${item.icon} text-[22px] transition-colors ${
                          active ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-600'
                        }`} aria-hidden="true" />
                      )}
                    {item.href === '/admin/whatsapp' && (
                      <span className="absolute -top-1 -right-2 scale-75 origin-top-right">
                        <PendingBadge />
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold tracking-wide transition-colors ${
                    active ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-600'
                  }`}>
                    {item.label}
                  </span>
                </Link>
              )
            })
          )}
        </div>
      </nav>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl overflow-y-auto">
            {isStaff ? (
              <StaffSidebar pathname={pathname} onLinkClick={() => setDrawerOpen(false)} onLogout={handleLogout} />
            ) : (
              <SidebarContent pathname={pathname} onLinkClick={() => setDrawerOpen(false)} onLogout={handleLogout} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
