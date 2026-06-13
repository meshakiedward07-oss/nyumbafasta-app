'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Real-time pending conversation count badge
function PendingBadge() {
  const [count, setCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { count: c } = await supabase
        .from('whatsapp_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
      setCount(c ?? 0)
    }
    load()

    const channel = supabase
      .channel('wa-sessions-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_sessions' }, load)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      { href: '/admin',      label: 'Dashboard',    emoji: '📊', exact: true  },
      { href: '/admin/chat', label: 'Chat Monitor', emoji: '💬', exact: false },
    ],
  },
  {
    title: 'WhatsApp',
    items: [
      { href: '/admin/whatsapp',           label: 'Mazungumzo',  emoji: '📱', exact: false, badge: true },
      { href: '/admin/whatsapp/broadcast', label: 'Broadcast',   emoji: '📢', exact: false },
    ],
  },
  {
    title: 'Social Media',
    items: [
      { href: '/admin/social',            label: 'Dashboard',  emoji: '📊', exact: true  },
      { href: '/admin/social?tab=postnow',label: 'Chapisha',   emoji: '✍️', exact: false },
    ],
  },
  {
    title: 'Lead Hunting',
    items: [
      { href: '/admin/leads',               label: 'Leads Zote',  emoji: '🤖', exact: false },
      { href: '/admin/facebook-groups',     label: 'FB Groups',   emoji: '👥', exact: false },
      { href: '/admin/instagram-profiles',  label: 'IG Profiles', emoji: '📸', exact: false },
    ],
  },
  {
    title: 'CRM',
    items: [
      { href: '/admin/crm',               label: 'Pipeline',    emoji: '🎯', exact: true  },
      { href: '/admin/crm/assign',        label: 'Assignment',  emoji: '👨‍💼', exact: false },
      { href: '/admin/crm/analytics',     label: 'Analytics',   emoji: '📊', exact: false },
      { href: '/admin/crm/reports',       label: 'Reports',     emoji: '📈', exact: false },
      { href: '/admin/crm/commission',    label: 'Commission',  emoji: '💰', exact: false },
      { href: '/admin/crm/templates',     label: 'WA Templates',emoji: '💬', exact: false },
    ],
  },
  {
    title: 'Usimamizi',
    items: [
      { href: '/admin/users',         label: 'Watumiaji',    emoji: '👥', exact: false },
      { href: '/admin/listings',      label: 'Listings',     emoji: '🏠', exact: false },
      { href: '/admin/verifications', label: 'Verification', emoji: '✅', exact: false },
      { href: '/admin/subscriptions', label: 'Subscriptions',emoji: '💳', exact: false },
    ],
  },
]

const BOTTOM_NAV = [
  { href: '/admin',            emoji: '📊', label: 'Home',      exact: true  },
  { href: '/admin/whatsapp',   emoji: '📱', label: 'WhatsApp',  exact: false },
  { href: '/admin/leads',      emoji: '🤖', label: 'Leads',     exact: false },
  { href: '/admin/crm',        emoji: '🎯', label: 'CRM',       exact: false },
  { href: '/admin/facebook-groups', emoji: '👥', label: 'Groups', exact: false },
]

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
            <div className="w-9 h-9 bg-[#1D9E75] rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">NF</span>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">NyumbaFasta</p>
              <p className="text-xs text-gray-400">Admin Panel</p>
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
                      ? 'bg-[#1D9E75] text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}>
                    <span className="text-base w-5 text-center flex-shrink-0">{item.emoji}</span>
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
            <span>🌐</span><span>Rudi App</span>
          </div>
        </Link>
        <button onClick={onLogout} className="w-full text-left">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 text-sm">
            <span>🚪</span><span>Logout</span>
          </div>
        </button>
      </div>
    </div>
  )
}

// ── Main shell ─────────────────────────────────────────────────────────────
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* ── DESKTOP layout (lg+) ── */}
      <div className="hidden lg:flex h-screen overflow-hidden bg-gray-50">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-200 h-screen overflow-y-auto">
          <SidebarContent
            pathname={pathname}
            onLinkClick={() => {}}
            onLogout={handleLogout}
          />
        </aside>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* ── MOBILE layout ── */}
      <div className="lg:hidden">
        {/* Mobile top header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-40 flex items-center justify-between">
          <Link href="/admin">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#1D9E75] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">NF</span>
              </div>
              <span className="font-bold text-gray-900 text-sm">Admin</span>
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

        {/* Mobile page content */}
        <main className="pb-20">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 px-1 py-2">
          <div className="flex justify-around">
            {BOTTOM_NAV.map(item => (
              <Link key={item.href + item.label} href={item.href}>
                <div className={`flex flex-col items-center px-2 py-1 rounded-xl transition-all ${
                  isActive(item.href, item.exact) ? 'text-[#1D9E75]' : 'text-gray-400'
                }`}>
                  <span className="text-xl">{item.emoji}</span>
                  <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
                </div>
              </Link>
            ))}
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
              <SidebarContent
                pathname={pathname}
                onLinkClick={() => setDrawerOpen(false)}
                onLogout={handleLogout}
              />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
