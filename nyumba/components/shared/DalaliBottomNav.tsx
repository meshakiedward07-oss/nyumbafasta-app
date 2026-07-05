'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/dashboard',              icon: 'layout-dashboard', iconActive: 'layout-dashboard', label: 'Nyumbani'  },
  { href: '/dashboard/listings',     icon: 'home',             iconActive: 'home-filled',      label: 'Matangazo' },
  { href: '/dashboard/listings/new', icon: 'plus',             iconActive: 'plus',             label: 'Ongeza'    },
  { href: '/dashboard/hesabu',       icon: 'coins',            iconActive: 'coins',            label: 'Hesabu'    },
  { href: '/dashboard/profile',      icon: 'user',             iconActive: 'user-filled',      label: 'Akaunti'   },
]

export default function DalaliBottomNav() {
  const pathname = usePathname()

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 tap-highlight-none"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      {/* Glass blur backdrop */}
      <div className="absolute inset-0 bg-white/90 backdrop-blur-md border-t border-gray-100/80" />

      <div className="relative flex justify-around max-w-lg mx-auto px-1 pt-1">
        {ITEMS.map(({ href, icon, iconActive, label }) => {
          const active =
            href === '/dashboard'
              ? pathname === '/dashboard'
              : href === '/dashboard/listings'
              ? pathname === '/dashboard/listings' || (pathname.startsWith('/dashboard/listings/') && !pathname.startsWith('/dashboard/listings/new'))
              : pathname === href || pathname.startsWith(href + '/')

          const isAdd = href === '/dashboard/listings/new'

          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 py-1 px-0.5 min-h-[52px] min-w-0 flex-1 justify-center transition-all duration-150 active:scale-90"
            >
              {/* Icon bubble — special treatment for the Add button */}
              {isAdd ? (
                <div className="w-11 h-11 flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 shadow-[0_4px_16px_rgba(29,158,117,0.4)] -mt-3 transition-transform duration-150 active:scale-95">
                  <i className="ti ti-plus text-xl font-bold text-white" aria-hidden="true" />
                </div>
              ) : (
                <div className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all duration-200
                  ${active
                    ? 'bg-primary-500 shadow-[0_4px_12px_rgba(29,158,117,0.35)] scale-105'
                    : 'bg-transparent'
                  }`}
                >
                  <i
                    aria-hidden="true"
                    className={`ti ti-${active ? iconActive : icon} text-xl transition-colors duration-150
                      ${active ? 'text-white' : 'text-gray-400'}`}
                  />
                </div>
              )}

              {/* Label */}
              <span className={`text-[11px] font-medium leading-none transition-colors duration-150
                ${active ? 'text-primary-600' : isAdd ? 'text-primary-500' : 'text-gray-400'}`}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
