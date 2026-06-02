'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/dashboard',              icon: '📊', label: 'Dashboard' },
  { href: '/dashboard/listings',     icon: '🏠', label: 'Listings'  },
  { href: '/dashboard/listings/new', icon: '➕', label: 'Ongeza'    },
  { href: '/dashboard/reviews',      icon: '⭐', label: 'Maoni'     },
  { href: '/dashboard/profile',      icon: '👤', label: 'Akaunti'   },
]

export default function DalaliBottomNav() {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-2 z-40 tap-highlight-none">
      <div className="flex justify-around max-w-sm mx-auto">
        {ITEMS.map(({ href, icon, label }) => {
          const active =
            href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all duration-150
                ${active ? 'text-primary-600' : 'text-gray-400 active:scale-90'}`}
            >
              <span className={`text-xl transition-transform duration-150 ${active ? 'scale-110' : ''}`}>
                {icon}
              </span>
              <span className={`text-xs ${active ? 'font-semibold' : ''}`}>{label}</span>
              {active && (
                <span className="w-1 h-1 rounded-full bg-primary-500 mt-0.5" />
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
