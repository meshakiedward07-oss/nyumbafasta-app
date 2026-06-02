'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import NotificationBell from '@/components/shared/NotificationBell'

type Role = 'client' | 'dalali' | 'admin' | string

// 3rd tab varies by role
function getItems(role: Role) {
  const mid =
    role === 'admin'  ? { href: '/admin',     icon: '🛡️', label: 'Admin'     } :
    role === 'dalali' ? { href: '/dashboard', icon: '📊', label: 'Dashboard' } :
                        { href: '/notifications', icon: null, label: 'Arifa' }
  return [
    { href: '/',        icon: '🔍', label: 'Tafuta'  },
    { href: '/saved',   icon: '❤️',  label: 'Saved'   },
    mid,
    { href: '/account', icon: '👤', label: 'Akaunti' },
  ]
}

export default function BottomNav({ role = 'client' }: { role?: Role }) {
  const pathname = usePathname()
  const items    = getItems(role)

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-2 z-40 tap-highlight-none">
      <div className="flex justify-around max-w-sm mx-auto">
        {items.map(({ href, icon, label }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all duration-150
                ${active ? 'text-primary-600' : 'text-gray-400 active:scale-90'}`}
            >
              {icon === null ? (
                <NotificationBell asLink={false} className={`transition-transform duration-150 ${active ? 'scale-110' : ''}`} />
              ) : (
                <span className={`text-xl transition-transform duration-150 ${active ? 'scale-110' : ''}`}>
                  {icon}
                </span>
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
