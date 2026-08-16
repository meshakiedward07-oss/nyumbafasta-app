'use client'
import { useState, useEffect, createContext, useContext } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { STAFF_PERMISSIONS, ADMIN_TASK_PERMISSIONS } from '@/lib/staff/permissions'
import type { PermissionKey } from '@/lib/staff/permissions'
import { PlatformLogo } from '@/components/shared/PlatformLogo'
import { useLanguage } from '@/lib/i18n/context'
import type { TKey } from '@/lib/i18n/translations'
import LangToggle from '@/components/shared/LangToggle'

const BRAND_PLATFORMS = new Set(['whatsapp', 'instagram', 'facebook', 'tiktok'])

type NavItem = {
  href: string
  labelKey: TKey
  icon: string
  exact: boolean
  badge?: true | 'social' | 'messages'
}

type NavSection = {
  titleKey: TKey
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: 'admin_nav_sec_overview',
    items: [
      { href: '/admin',           labelKey: 'admin_nav_dashboard',  icon: 'chart-bar',   exact: true  },
      { href: '/admin/executive', labelKey: 'admin_nav_executive',  icon: 'presentation',   exact: false },
      { href: '/admin/biashara', labelKey: 'admin_nav_biashara',   icon: 'brain',          exact: false },
      { href: '/admin/alerts',      labelKey: 'admin_nav_alerts',      icon: 'alert-triangle',   exact: false },
      { href: '/admin/reports',     labelKey: 'admin_nav_reports',     icon: 'report-analytics', exact: false },
      { href: '/admin/scorecards',  labelKey: 'admin_nav_scorecards',  icon: 'layout-grid',      exact: false },
    ],
  },
  {
    titleKey: 'admin_nav_sec_social',
    items: [
      { href: '/admin/social', labelKey: 'admin_nav_social_overview', icon: 'camera', exact: false },
    ],
  },
  {
    titleKey: 'admin_nav_sec_leads',
    items: [
      { href: '/admin/leads', labelKey: 'admin_nav_leads_mgmt', icon: 'users', exact: false },
    ],
  },
  {
    titleKey: 'admin_nav_sec_comms',
    items: [
      { href: '/admin/communications', labelKey: 'admin_nav_sec_comms', icon: 'messages', exact: false, badge: true },
    ],
  },
  {
    titleKey: 'admin_nav_sec_management',
    items: [
      { href: '/admin/staff',                  labelKey: 'admin_nav_staff',             icon: 'user-tie',       exact: false },
      { href: '/admin/users',                  labelKey: 'admin_nav_users',             icon: 'users',          exact: false },
      { href: '/admin/listings',               labelKey: 'admin_nav_listings',          icon: 'home',           exact: false },
      { href: '/admin/verifications',          labelKey: 'admin_nav_verifications',     icon: 'check',          exact: false },

      { href: '/admin/reviews',                labelKey: 'admin_nav_reviews',           icon: 'star',           exact: false },
      { href: '/admin/accounting',             labelKey: 'admin_nav_accounting',        icon: 'credit-card',    exact: false },
      { href: '/admin/fraud',                  labelKey: 'admin_nav_fraud',             icon: 'shield-lock',    exact: false },
    ],
  },
  {
    titleKey: 'admin_nav_sec_advertising',
    items: [
      { href: '/admin/adverts',              labelKey: 'admin_nav_campaigns',        icon: 'speakerphone', exact: true  },
      { href: '/admin/adverts/advertisers',  labelKey: 'admin_nav_advertisers',      icon: 'briefcase',    exact: false },
      { href: '/admin/adverts/plans',        labelKey: 'admin_nav_plans',            icon: 'list',         exact: false },
      { href: '/admin/adverts/analytics',    labelKey: 'admin_nav_advert_analytics', icon: 'chart-bar',    exact: false },
    ],
  },
  {
    titleKey: 'admin_nav_sec_legal',
    items: [
      { href: '/admin/legal', labelKey: 'admin_nav_legal_agreements', icon: 'scale', exact: false },
    ],
  },
  {
    titleKey: 'admin_nav_sec_property',
    items: [
      { href: '/admin/property-management', labelKey: 'admin_nav_property_dash',  icon: 'building',     exact: true  },
      { href: '/admin/organizations',       labelKey: 'admin_nav_organizations',  icon: 'sitemap',      exact: false },
      { href: '/admin/fundi',               labelKey: 'admin_nav_fundi_accounts', icon: 'tools',        exact: false },
      { href: '/admin/subscriptions',       labelKey: 'admin_nav_org_subs',       icon: 'credit-card',  exact: false },
    ],
  },
  {
    titleKey: 'admin_nav_sec_platform',
    items: [
      { href: '/admin/settings', labelKey: 'admin_nav_settings', icon: 'settings', exact: false },
      { href: '/admin/crons',    labelKey: 'admin_nav_crons',    icon: 'terminal', exact: false },
    ],
  },
]

type BottomNavItem = { href: string; icon: string; labelKey: TKey; exact: boolean }

const BOTTOM_NAV: BottomNavItem[] = [
  { href: '/admin',                icon: 'chart-bar', labelKey: 'admin_nav_home',            exact: true  },
  { href: '/admin/communications', icon: 'messages',  labelKey: 'admin_nav_sec_comms',        exact: false },
  { href: '/admin/social',         icon: 'camera',    labelKey: 'admin_nav_social_overview',  exact: false },
  { href: '/admin/accounting',     icon: 'coins',     labelKey: 'admin_nav_accounting',       exact: false },
]

type StaffNavItem = { href: string; icon: string; labelKey: TKey; exact: boolean; permission: 'leads' | null }

const STAFF_BOTTOM_NAV_BASE: StaffNavItem[] = [
  { href: '/admin/staff-dashboard', icon: 'layout-dashboard', labelKey: 'admin_my_dashboard',  exact: false, permission: null },
  { href: '/admin/email',           icon: 'mail',             labelKey: 'admin_nav_email',      exact: false, permission: null },
  { href: '/admin/staff-leads',     icon: 'target',           labelKey: 'admin_nav_leads_mgmt', exact: false, permission: 'leads' as const },
]


type BadgeCounts = { pending: number; social: number; messages: number }
const BadgesCtx = createContext<BadgeCounts>({ pending: 0, social: 0, messages: 0 })

function PendingBadge() {
  const { pending } = useContext(BadgesCtx)
  if (pending === 0) return null
  return (
    <span className="ml-auto min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 flex items-center justify-center">
      {pending > 99 ? '99+' : pending}
    </span>
  )
}

function SocialPendingBadge() {
  const { social } = useContext(BadgesCtx)
  if (social === 0) return null
  return (
    <span className="ml-auto min-w-[20px] h-5 bg-pink-500 text-white text-[10px] font-bold rounded-full px-1.5 flex items-center justify-center">
      {social > 99 ? '99+' : social}
    </span>
  )
}

function MessagesBadge() {
  const { messages } = useContext(BadgesCtx)
  if (messages === 0) return null
  return (
    <span className="ml-auto min-w-[20px] h-5 bg-blue-500 text-white text-[10px] font-bold rounded-full px-1.5 flex items-center justify-center">
      {messages > 99 ? '99+' : messages}
    </span>
  )
}

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
  const { t } = useLanguage()
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
              <p className="text-xs text-gray-400">{t('admin_staff_panel')}</p>
            </div>
          </div>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1.5">
          {t('admin_my_features')}
        </p>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-xl mb-1" />
          ))
        ) : granted.length === 0 ? (
          <p className="text-xs text-gray-400 px-3 py-2">
            {t('admin_no_permission')}
          </p>
        ) : (
          <>
            {granted.some(k => ADMIN_TASK_PERMISSIONS.includes(k)) && (
              <Link href="/admin/staff-dashboard" onClick={onLinkClick}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${
                  isActive('/admin/staff-dashboard')
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}>
                  <i className="ti ti-layout-dashboard text-base w-5 text-center flex-shrink-0" aria-hidden="true" />
                  <span>{t('admin_my_dashboard')}</span>
                  {isActive('/admin/staff-dashboard') && (
                    <span className="ml-auto w-1.5 h-1.5 bg-white/70 rounded-full" />
                  )}
                </div>
              </Link>
            )}
            <Link href="/admin/messages" onClick={onLinkClick}>
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${
                isActive('/admin/messages')
                  ? 'bg-primary-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}>
                <i className="ti ti-message-2 text-base w-5 text-center flex-shrink-0" aria-hidden="true" />
                <span>{t('admin_nav_messages')}</span>
                {!isActive('/admin/messages') && <MessagesBadge />}
                {isActive('/admin/messages') && (
                  <span className="ml-auto w-1.5 h-1.5 bg-white/70 rounded-full" />
                )}
              </div>
            </Link>
            <Link href="/admin/email" onClick={onLinkClick}>
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${
                isActive('/admin/email')
                  ? 'bg-primary-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}>
                <i className="ti ti-mail text-base w-5 text-center flex-shrink-0" aria-hidden="true" />
                <span>{t('admin_nav_email')}</span>
                {isActive('/admin/email') && (
                  <span className="ml-auto w-1.5 h-1.5 bg-white/70 rounded-full" />
                )}
              </div>
            </Link>
            {(() => {
              const seen = new Set<string>()
              return granted
                .filter(k => !ADMIN_TASK_PERMISSIONS.includes(k))
                .map(key => {
                  const perm = STAFF_PERMISSIONS[key]
                  if (!perm || seen.has(perm.adminPath)) return null
                  seen.add(perm.adminPath)
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
                })
            })()}
          </>
        )}
      </nav>
      <div className="px-3 pb-4 border-t border-gray-100 pt-3 space-y-1.5">
        <LangToggle />
        <button onClick={onLogout} className="w-full text-left">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 text-sm">
            <i className="ti ti-door-exit" aria-hidden="true" /><span>{t('admin_logout')}</span>
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
  const { t } = useLanguage()
  const searchParams = useSearchParams()

  function isActive(href: string, exact: boolean) {
    const qIdx = href.indexOf('?')
    if (qIdx !== -1) {
      const hrefPath = href.slice(0, qIdx)
      const hrefQ    = new URLSearchParams(href.slice(qIdx + 1))
      const pathOk   = exact ? pathname === hrefPath : pathname.startsWith(hrefPath)
      if (!pathOk) return false
      for (const [k, v] of hrefQ.entries()) {
        if (searchParams.get(k) !== v) return false
      }
      return true
    }
    const pathMatch = exact ? pathname === href : pathname.startsWith(href)
    if (!pathMatch) return false
    // When exact and a sibling nav item owns the current tab, don't claim active
    if (exact) {
      const tab = searchParams.get('tab')
      if (tab) {
        const siblingOwnsTab = NAV_SECTIONS.some(s =>
          s.items.some(i => {
            const qi = i.href.indexOf('?')
            if (qi === -1) return false
            const sp = new URLSearchParams(i.href.slice(qi + 1))
            return i.href.slice(0, qi) === href && sp.get('tab') === tab
          })
        )
        if (siblingOwnsTab) return false
      }
    }
    return true
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
              <p className="text-xs text-gray-400">{t('admin_panel_label')}</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className="mb-5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1.5">
              {t(section.titleKey)}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => (
                <Link
                  key={item.href + item.labelKey}
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
                    <span>{t(item.labelKey)}</span>
                    {item.badge && !isActive(item.href, item.exact) && (
                      item.badge === 'social' ? <SocialPendingBadge /> :
                      item.badge === 'messages' ? <MessagesBadge /> :
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
      <div className="px-3 pb-4 border-t border-gray-100 pt-3 space-y-1.5">
        <LangToggle />
        <Link href="/" onClick={onLinkClick}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 hover:bg-gray-100 text-sm">
            <i className="ti ti-world" aria-hidden="true" /><span>{t('admin_return_app')}</span>
          </div>
        </Link>
        <button onClick={onLogout} className="w-full text-left">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 text-sm">
            <i className="ti ti-door-exit" aria-hidden="true" /><span>{t('admin_logout')}</span>
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
  const { t }    = useLanguage()
  const [drawerOpen,       setDrawerOpen]       = useState(false)
  const [userRole,         setUserRole]         = useState<string>(initialRole)
  const [staffPermissions, setStaffPermissions] = useState<string[]>([])
  const [badges,           setBadges]           = useState<BadgeCounts>({ pending: 0, social: 0, messages: 0 })

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('users').select('role').eq('id', user.id).single()
        .then(({ data }) => {
          const role = data?.role ?? initialRole
          setUserRole(role)
          if (role === 'staff') {
            fetch('/api/v1/staff/me/permissions')
              .then(r => r.json())
              .then(d => setStaffPermissions(d.granted ?? []))
              .catch(() => {})
          }
        })
    })
  }, [initialRole])

  // Single poll replaces 3 independent badge polls (WhatsApp + social + messages)
  useEffect(() => {
    let cancelled = false
    async function loadBadges() {
      try {
        const res = await fetch('/api/v1/admin/badges')
        if (!res.ok) return
        const d = await res.json()
        if (!cancelled) setBadges({ pending: d.pending ?? 0, social: d.social ?? 0, messages: d.messages ?? 0 })
      } catch { /* non-critical */ }
    }
    loadBadges()
    const timer = setInterval(loadBadges, 30_000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

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

  // Full-viewport overlays — hides sidebar, footer, body scroll
  if (
    pathname.startsWith('/admin/social') ||
    pathname === '/admin/property-management' ||
    pathname.startsWith('/admin/messages') ||
    pathname.startsWith('/admin/communications') ||
    pathname.startsWith('/admin/accounting')
  ) {
    return <div className="fixed inset-0 overflow-hidden bg-[#f4f4f0] z-10">{children}</div>
  }

  return (
    <BadgesCtx.Provider value={badges}>
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* ── Desktop sidebar (lg+) ── */}
      <aside className="hidden lg:flex lg:w-64 flex-shrink-0 flex-col bg-white border-r border-gray-200 h-full overflow-hidden">
        {isStaff ? (
          <StaffSidebar pathname={pathname} onLinkClick={() => {}} onLogout={handleLogout} />
        ) : (
          <SidebarContent pathname={pathname} onLinkClick={() => {}} onLogout={handleLogout} />
        )}
      </aside>

      {/* ── Right column: mobile header + content ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Mobile top header */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 z-40 flex items-center justify-between gap-3 flex-shrink-0">
          <Link href={isStaff ? '/admin/staff-dashboard' : '/admin'}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">NF</span>
              </div>
              <span className="font-bold text-gray-900 text-sm">{isStaff ? 'Dashboard' : 'Admin'}</span>
            </div>
          </Link>
          <div className="w-24 flex-shrink-0">
            <LangToggle size="sm" />
          </div>
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
            STAFF_BOTTOM_NAV_BASE
              .filter(item => !item.permission || staffPermissions.includes(item.permission))
              .map(item => {
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
                    {t(item.labelKey)}
                  </span>
                </Link>
              )
            })
          ) : (
            <>
              {BOTTOM_NAV.map(item => {
                const active = isActive(item.href, item.exact)
                return (
                  <Link
                    key={item.href + item.labelKey}
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
                    </div>
                    <span className={`text-[10px] font-semibold tracking-wide transition-colors ${
                      active ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-600'
                    }`}>
                      {t(item.labelKey)}
                    </span>
                  </Link>
                )
              })}
            </>
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
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl flex flex-col overflow-hidden">
            {isStaff ? (
              <StaffSidebar pathname={pathname} onLinkClick={() => setDrawerOpen(false)} onLogout={handleLogout} />
            ) : (
              <SidebarContent pathname={pathname} onLinkClick={() => setDrawerOpen(false)} onLogout={handleLogout} />
            )}
          </div>
        </div>
      )}
    </div>
    </BadgesCtx.Provider>
  )
}
