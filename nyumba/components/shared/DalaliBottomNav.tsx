'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/dashboard',              icon: 'layout-dashboard', iconActive: 'layout-dashboard', label: 'Nyumbani',  isAdd: false },
  { href: '/dashboard/listings',     icon: 'home',             iconActive: 'home-filled',      label: 'Matangazo', isAdd: false },
  { href: '/dashboard/listings/new', icon: 'plus',             iconActive: 'plus',             label: 'Ongeza',    isAdd: true  },
  { href: '/dashboard/hesabu',       icon: 'coins',            iconActive: 'coins',            label: 'Hesabu',    isAdd: false },
  { href: '/dashboard/profile',      icon: 'user',             iconActive: 'user-filled',      label: 'Akaunti',   isAdd: false },
]

export default function DalaliBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Urambazaji mkuu"
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Frosted glass backdrop with upward shadow */}
      <div className="absolute inset-0 bg-white/95 backdrop-blur-xl border-t border-gray-100/80 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]" />

      <div className="relative flex justify-around items-end max-w-lg mx-auto px-1 py-2">
        {ITEMS.map(({ href, icon, iconActive, label, isAdd }) => {
          const active =
            href === '/dashboard'
              ? pathname === '/dashboard'
              : href === '/dashboard/listings'
              ? pathname === '/dashboard/listings' ||
                (pathname.startsWith('/dashboard/listings/') && !pathname.startsWith('/dashboard/listings/new'))
              : pathname === href || pathname.startsWith(href + '/')

          /* ── FAB-style centre "Add" button ── */
          if (isAdd) {
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-1 -mt-6 px-2 tap-highlight-none active:scale-90 transition-transform duration-150"
              >
                <div className="w-14 h-14 flex items-center justify-center rounded-full
                  bg-gradient-to-br from-primary-400 to-primary-600
                  shadow-[0_4px_20px_rgba(29,158,117,0.50)]
                  border-4 border-white transition-transform duration-150">
                  <i className="ti ti-plus text-2xl text-white font-bold" aria-hidden="true" />
                </div>
                <span className="text-[10px] font-semibold text-primary-600 leading-none">{label}</span>
              </Link>
            )
          }

          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 py-1 px-3 min-w-[52px] justify-center transition-all duration-200 active:scale-90 tap-highlight-none"
            >
              <div className={`w-12 h-8 flex items-center justify-center rounded-full transition-all duration-200 ${
                active ? 'bg-primary-500 shadow-[0_2px_10px_rgba(29,158,117,0.35)]' : ''
              }`}>
                <i
                  aria-hidden="true"
                  className={`ti ti-${active ? iconActive : icon} text-xl transition-colors duration-150 ${
                    active ? 'text-white' : 'text-gray-400'
                  }`}
                />
              </div>
              <span className={`text-[10px] leading-none transition-colors duration-150 ${
                active ? 'text-primary-600 font-semibold' : 'text-gray-400 font-medium'
              }`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
