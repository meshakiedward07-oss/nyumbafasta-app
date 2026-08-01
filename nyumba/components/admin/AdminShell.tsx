'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { STAFF_PERMISSIONS, ADMIN_TASK_PERMISSIONS } from '@/lib/staff/permissions'
import type { PermissionKey } from '@/lib/staff/permissions'
import { PlatformLogo } from '@/components/shared/PlatformLogo'
import { useLanguage } from '@/lib/i18n/context'
import type { TKey } from '@/lib/i18n/translations'

const BRAND_PLATFORMS = new Set(['whatsapp', 'instagram', 'facebook', 'tiktok'])

type NavItem = {
  href: string
  labelKey: TKey
  icon: string
  exact: boolean
  badge?: true | 'inbox' | 'social' | 'messages'
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
      { href: '/admin/executive', labelKey: 'admin_nav_executive',  icon: 'presentation', exact: false },
    ],
  },
  {
    titleKey: 'admin_nav_sec_whatsapp',
    items: [
      { href: '/admin/whatsapp',           labelKey: 'admin_nav_conversations', icon: 'brand-whatsapp', exact: false, badge: true },
      { href: '/admin/whatsapp/broadcast', labelKey: 'admin_nav_broadcast',     icon: 'speakerphone',   exact: false },
    ],
  },
  {
    titleKey: 'admin_nav_sec_social',
    items: [
      { href: '/admin/social',             labelKey: 'admin_nav_social_overview', icon: 'chart-bar',    exact: true  },
      { href: '/admin/social?tab=postnow', labelKey: 'admin_nav_publish',         icon: 'pencil',       exact: false },
      { href: '/admin/social-inbox',       labelKey: 'admin_nav_social_inbox',    icon: 'message-dots', exact: false, badge: 'social' as const },
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
      { href: '/admin/email',         labelKey: 'admin_nav_email',             icon: 'mail',         exact: false },
      { href: '/admin/inbox',         labelKey: 'admin_nav_inbox',             icon: 'inbox',        exact: false, badge: 'inbox' as const },
      { href: '/admin/messages',      labelKey: 'admin_nav_messages',          icon: 'messages',     exact: false, badge: 'messages' as const },
      { href: '/admin/notifications', labelKey: 'admin_nav_notify_broadcast',  icon: 'bell',         exact: false },
      { href: '/admin/knowledge',     labelKey: 'admin_nav_knowledge',         icon: 'academic-cap', exact: false },
    ],
  },
  {
    titleKey: 'admin_nav_sec_management',
    items: [
      { href: '/admin/staff',                  labelKey: 'admin_nav_staff',             icon: 'user-tie',       exact: false },
      { href: '/admin/users',                  labelKey: 'admin_nav_users',             icon: 'users',          exact: false },
      { href: '/admin/listings',               labelKey: 'admin_nav_listings',          icon: 'home',           exact: false },
      { href: '/admin/verifications',          labelKey: 'admin_nav_verifications',     icon: 'check',          exact: false },
      { href: '/admin/dalali-subscriptions',   labelKey: 'admin_nav_dalali_subs',       icon: 'id-badge',       exact: false },
      { href: '/admin/unlocks',                labelKey: 'admin_nav_unlocks',           icon: 'lock-open',      exact: false },
      { href: '/admin/boosts',                 labelKey: 'admin_nav_boosts',            icon: 'rocket',         exact: false },
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
  { href: '/admin',          icon: 'chart-bar',      labelKey: 'admin_nav_home',        exact: true  },
  { href: '/admin/whatsapp', icon: 'brand-whatsapp', labelKey: 'admin_nav_conversations', exact: false },
  { href: '/admin/email',    icon: 'mail',           labelKey: 'admin_nav_email_short', exact: false },
  { href: '/admin/leads',    icon: 'users',          labelKey: 'admin_nav_leads_mgmt',  exact: false },
]

type StaffNavItem = { href: string; icon: string; labelKey: TKey; exact: boolean; permission: 'leads' | null }

const STAFF_BOTTOM_NAV_BASE: StaffNavItem[] = [
  { href: '/admin/staff-dashboard', icon: 'layout-dashboard', labelKey: 'admin_my_dashboard', exact: false, permission: null },
  { href: '/admin/email',           icon: 'mail',             labelKey: 'admin_nav_email',    exact: false, permission: null },
  { href: '/admin/staff-leads',     icon: 'target',           labelKey: 'admin_nav_leads_mgmt', exact: false, permission: 'leads' as const },
]

function LangToggle() {
  const { lang, setLang } = useLanguage()
  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
      {(['sw', 'en'] as const).map(l => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`flex-1 py-1.5 font-semibold transition-colors ${lang === l ? 'bg-primary-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          {l === 'sw' ? '🇹🇿 SW' : '🇬🇧 EN'}
        </button>
      ))}
    </div>
  )
}

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

function SocialPendingBadge() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/v1/social/sessions?status=pending')
        if (!res.ok) return
        const d = await res.json()
        if (!cancelled) setCount((d.sessions ?? []).length)
      } catch { /* silent */ }
    }
    load()
    const timer = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  if (count === 0) return null
  return (
    <span className="ml-auto min-w-[20px] h-5 bg-pink-500 text-white text-[10px] font-bold rounded-full px-1.5 flex items-center justify-center">
      {count > 99 ? '99+' : count}
    </span>
  )
}

function InboxBadge() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/v1/inbox/stats')
        if (!res.ok) return
        const d = await res.json()
        if (!cancelled) setCount(d.flagged ?? 0)
      } catch { /* silent */ }
    }
    load()
    const timer = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  if (count === 0) return null
  return (
    <span className="ml-auto min-w-[20px] h-5 bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 flex items-center justify-center">
      {count > 99 ? '99+' : count}
    </span>
  )
}

function MessagesBadge() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/v1/conversations?unread=1')
        if (!res.ok) return
        const d = await res.json()
        if (!cancelled) setCount(d.unread_count ?? 0)
      } catch { /* silent */ }
    }
    load()
    const timer = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  if (count === 0) return null
  return (
    <span className="ml-auto min-w-[20px] h-5 bg-primary-500 text-white text-[10px] font-bold rounded-full px-1.5 flex items-center justify-center">
      {count > 99 ? '99+' : count}
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
                      item.badge === 'inbox'     ? <InboxBadge /> :
                      item.badge === 'social'    ? <SocialPendingBadge /> :
                      item.badge === 'messages'  ? <MessagesBadge /> :
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
  if (pathname.startsWith('/admin/social') || pathname === '/admin/property-management') {
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
            BOTTOM_NAV.map(item => {
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
                    {item.href === '/admin/whatsapp' && (
                      <span className="absolute -top-1 -right-2 scale-75 origin-top-right">
                        <PendingBadge />
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold tracking-wide transition-colors ${
                    active ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-600'
                  }`}>
                    {t(item.labelKey)}
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
