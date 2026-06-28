'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import NotificationBell from '@/components/shared/NotificationBell'

type Role = 'client' | 'dalali' | 'admin' | string

// 3rd tab varies by role
function getItems(role: Role) {
  const mid =
    role === 'admin'  ? { href: '/admin',     icon: 'shield', label: 'Msimamizi' } :
    role === 'dalali' ? { href: '/dashboard', icon: 'chart-bar', label: 'Dashibodi' } :
                        { href: '/notifications', icon: null, label: 'Arifa' }
  return [
    { href: '/',        icon: 'search', label: 'Tafuta'  },
    { href: '/saved',   icon: 'heart',  label: 'Zilizohifadhiwa' },
    mid,
    { href: '/account', icon: 'user', label: 'Akaunti' },
  ]
}

export default function BottomNav({ role = 'client' }: { role?: Role }) {
  const pathname = usePathname()
  const items    = getItems(role)

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 pt-2 z-40 tap-highlight-none"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      <div className="flex justify-around max-w-sm mx-auto">
        {items.map(({ href, icon, label }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 min-h-[48px] min-w-[48px] justify-center rounded-xl transition-all duration-150
                ${active ? 'text-primary-600' : 'text-gray-400 active:scale-90 md:hover:text-primary-600 md:hover:bg-primary-50'}`}
            >
              {icon === null ? (
                <NotificationBell asLink={false} className={`transition-transform duration-150 ${active ? 'scale-110' : ''}`} />
              ) : (
                <i aria-hidden="true" className={`ti ti-${icon} text-xl transition-transform duration-150 ${active ? 'scale-110' : ''}`} />
              )}
              <span className={`text-xs ${active ? 'font-semibold' : ''}`}>{label}</span>
              {active && <span className="w-1 h-1 rounded-full bg-primary-500 mt-0.5" />}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
