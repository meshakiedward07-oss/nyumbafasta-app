'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import NotificationBell from '@/components/shared/NotificationBell'

type Role = 'client' | 'dalali' | 'admin' | string

const NAV_ICONS: Record<string, { active: string; inactive: string }> = {
  search:    { active: 'ti-search',     inactive: 'ti-search'     },
  heart:     { active: 'ti-heart-filled',inactive: 'ti-heart'     },
  shield:    { active: 'ti-shield-filled',inactive:'ti-shield'    },
  'chart-bar':{ active:'ti-chart-bar',   inactive: 'ti-chart-bar' },
  user:      { active: 'ti-user-filled', inactive: 'ti-user'      },
}

function getItems(role: Role) {
  const mid =
    role === 'admin'  ? { href: '/admin',        icon: 'shield',    label: 'Msimamizi' } :
    role === 'dalali' ? { href: '/dashboard',     icon: 'chart-bar', label: 'Dashibodi' } :
                        { href: '/notifications', icon: null,        label: 'Arifa'     }
  return [
    { href: '/',        icon: 'search', label: 'Tafuta'         },
    { href: '/saved',   icon: 'heart',  label: 'Zilizohifadhiwa'},
    mid,
    { href: '/account', icon: 'user',   label: 'Akaunti'        },
  ]
}

export default function BottomNav({ role = 'client' }: { role?: Role }) {
  const pathname = usePathname()
  const items    = getItems(role)

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 tap-highlight-none"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      {/* Glass blur backdrop */}
      <div className="absolute inset-0 bg-white/90 backdrop-blur-md border-t border-gray-100/80" />

      <div className="relative flex justify-around max-w-sm mx-auto px-2 pt-1">
        {items.map(({ href, icon, label }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          const iconKey = icon ?? 'search'
          const iconClass = active
            ? (NAV_ICONS[iconKey]?.active ?? `ti-${iconKey}`)
            : (NAV_ICONS[iconKey]?.inactive ?? `ti-${iconKey}`)

          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 py-1 px-1 min-h-[52px] min-w-[52px] justify-center transition-all duration-150 active:scale-90"
            >
              {/* Icon bubble */}
              <div className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all duration-200
                ${active
                  ? 'bg-primary-500 shadow-[0_4px_12px_rgba(29,158,117,0.35)] scale-105'
                  : 'bg-transparent'
                }`}
              >
                {icon === null ? (
                  <NotificationBell
                    asLink={false}
                    className={`transition-colors duration-150 ${active ? 'text-white' : 'text-gray-400'}`}
                  />
                ) : (
                  <i
                    aria-hidden="true"
                    className={`ti ${iconClass} text-xl transition-colors duration-150
                      ${active ? 'text-white' : 'text-gray-400'}`}
                  />
                )}
              </div>

              {/* Label */}
              <span className={`text-[10px] font-medium leading-none transition-colors duration-150
                ${active ? 'text-primary-600' : 'text-gray-400'}`}
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
