'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import NotificationBell from '@/components/shared/NotificationBell'
import { useLanguage } from '@/lib/i18n/context'

type Role = 'client' | 'dalali' | 'admin' | string

const ACTIVE_ICONS: Record<string, string> = {
  search: 'search',
  heart:  'heart-filled',
  shield: 'shield-filled',
  'chart-bar': 'chart-bar',
  user:   'user-filled',
}

export default function BottomNav({ role = 'client' }: { role?: Role }) {
  const pathname  = usePathname()
  const { t }     = useLanguage()

  const mid =
    role === 'admin'  ? { href: '/admin',        icon: 'shield',         label: t('nav_admin')         } :
    role === 'dalali' ? { href: '/dashboard',     icon: 'chart-bar',      label: t('nav_dashboard')     } :
                        { href: '/notifications', icon: null,             label: t('nav_notifications') }

  const items = [
    { href: '/',          icon: 'search',         label: t('nav_search')    },
    { href: '/saved',     icon: 'heart',          label: t('nav_saved')     },
    mid,
    { href: '/directory', icon: 'building-store', label: t('nav_directory') },
    { href: '/account',   icon: 'user',           label: t('nav_account')   },
  ]

  return (
    <nav
      aria-label="Urambazaji mkuu"
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Frosted glass backdrop with upward shadow */}
      <div className="absolute inset-0 bg-white/95 backdrop-blur-xl border-t border-gray-100/80 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]" />

      <div className="relative flex justify-around max-w-lg mx-auto px-2 py-2">
        {items.map(({ href, icon, label }) => {
          const active  = pathname === href || (href !== '/' && pathname.startsWith(href))
          const iconKey = icon ?? 'search'

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center gap-1 py-1 px-3 min-w-[56px] justify-center transition-all duration-200 active:scale-90 tap-highlight-none"
            >
              {/* Pill indicator + icon */}
              <div className={`w-12 h-8 flex items-center justify-center rounded-full transition-all duration-200 ${
                active ? 'bg-primary-500 shadow-[0_2px_10px_rgba(29,158,117,0.35)]' : ''
              }`}>
                {icon === null ? (
                  <NotificationBell
                    asLink={false}
                    className={`transition-colors duration-150 ${active ? 'text-white' : 'text-gray-400'}`}
                  />
                ) : (
                  <i
                    aria-hidden="true"
                    className={`ti ti-${active ? (ACTIVE_ICONS[iconKey] ?? iconKey) : iconKey} text-xl transition-colors duration-150 ${
                      active ? 'text-white' : 'text-gray-400'
                    }`}
                  />
                )}
              </div>

              {/* Label */}
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
