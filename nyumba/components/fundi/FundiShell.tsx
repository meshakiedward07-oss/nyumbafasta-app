'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/fundi/dashboard',    icon: 'layout-dashboard', label: 'Kazi Zangu'  },
  { href: '/fundi/messages',     icon: 'message',          label: 'Ujumbe'      },
  { href: '/fundi/profile',      icon: 'user-circle',      label: 'Wasifu'      },
  { href: '/fundi/kyc',          icon: 'id',               label: 'Hati / KYC'  },
  { href: '/fundi/subscription', icon: 'star',             label: 'Usajili'     },
]

type Props = { children: React.ReactNode; fundiName: string | null }

export default function FundiShell({ children, fundiName }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [msgUnread,  setMsgUnread]  = useState(0)

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const res  = await fetch('/api/v1/conversations?unread=1')
        const json = await res.json()
        if (!cancelled) setMsgUnread(json.unread_count ?? 0)
      } catch { /* non-fatal */ }
    }
    poll()
    const id = setInterval(poll, 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  function isActive(href: string) { return pathname.startsWith(href) }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/fundi/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 flex-col bg-white border-r border-gray-200 h-full flex-shrink-0">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="ti ti-tools text-white text-base" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-gray-900 text-sm truncate">{fundiName ?? 'Fundi'}</p>
              <p className="text-[10px] text-gray-400">NyumbaFasta Fundi</p>
            </div>
          </div>
        </div>
        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const active = isActive(item.href)
            const badge  = item.href === '/fundi/messages' && msgUnread > 0 ? msgUnread : 0
            return (
              <Link key={item.href} href={item.href}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}>
                  <i className={`ti ti-${item.icon} text-base w-5 text-center flex-shrink-0`} aria-hidden="true" />
                  <span>{item.label}</span>
                  {badge > 0 && !active && (
                    <span className="ml-auto min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full px-1 flex items-center justify-center">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                  {active && <span className="ml-auto w-1.5 h-1.5 bg-white/70 rounded-full" />}
                </div>
              </Link>
            )
          })}
        </nav>
        {/* Bottom */}
        <div className="px-3 pb-4 border-t border-gray-100 pt-3">
          <button onClick={handleLogout} className="w-full text-left">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 text-sm">
              <i className="ti ti-door-exit" aria-hidden="true" />
              <span>Toka</span>
            </div>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0 z-40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <i className="ti ti-tools text-white text-sm" aria-hidden="true" />
            </div>
            <span className="font-bold text-gray-900 text-sm truncate max-w-[140px]">
              {fundiName ?? 'Fundi'}
            </span>
          </div>
          <button onClick={() => setMenuOpen(v => !v)} className="p-2 rounded-xl bg-gray-100">
            <i className={`ti ti-${menuOpen ? 'x' : 'menu-2'} text-xl text-gray-600`} aria-hidden="true" />
          </button>
        </header>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="lg:hidden absolute top-14 right-0 left-0 bg-white border-b border-gray-200 z-50 px-4 py-3 space-y-1 shadow-lg">
            {NAV_ITEMS.map(item => {
              const active = isActive(item.href)
              const badge  = item.href === '/fundi/messages' && msgUnread > 0 ? msgUnread : 0
              return (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                  <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
                    active ? 'bg-primary-500 text-white' : 'text-gray-700 hover:bg-gray-50'
                  }`}>
                    <i className={`ti ti-${item.icon} text-base`} aria-hidden="true" />
                    <span>{item.label}</span>
                    {badge > 0 && !active && (
                      <span className="ml-auto min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full px-1 flex items-center justify-center">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
            <button onClick={handleLogout} className="w-full text-left">
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 text-sm">
                <i className="ti ti-door-exit" aria-hidden="true" /> Toka
              </div>
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-gray-200"
           style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-stretch h-16">
          {NAV_ITEMS.map(item => {
            const active = isActive(item.href)
            const badge  = item.href === '/fundi/messages' && msgUnread > 0 ? msgUnread : 0
            return (
              <Link key={item.href} href={item.href} className="flex-1 flex flex-col items-center justify-center gap-0.5 relative">
                {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-500 rounded-b-full" />}
                <div className="relative">
                  <i className={`ti ti-${item.icon} text-[22px] ${active ? 'text-primary-500' : 'text-gray-400'}`} aria-hidden="true" />
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-0.5 leading-none">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-semibold ${active ? 'text-primary-500' : 'text-gray-400'}`}>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
