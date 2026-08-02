'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Listing } from '@/lib/types/database'
import NotificationBell from '@/components/shared/NotificationBell'
import { PLAN_BADGES, getListingLimit, getPlan } from '@/lib/config/subscription-plans'
import { STATUS_LABELS } from '@/lib/config/listing-status'
import { ListingDeadlineBanner } from '@/components/dalali/ListingDeadlineBanner'
import { useLanguage } from '@/lib/i18n/context'

type DalaliProfile = {
  whatsapp_number: string | null
  bio: string | null
  rating_avg: number
  rating_count: number
  is_premium_verified: boolean
  verification_status?: string
  verification_rejected_reason?: string | null
} | null

type Subscription = {
  plan: string
  status: string
  expires_at: string
  grace_period_until?: string | null
  is_trial?: boolean | null
  trial_ends_at?: string | null
} | null

type Stats = {
  totalViews: number
  totalLeads: number
  activeCount: number
  pendingCount: number
  totalListings: number
}

type Props = {
  dalaliName: string
  username: string | null
  profile: DalaliProfile
  subscription: Subscription
  listings: Listing[]
  stats: Stats
}

const typeLabel: Record<string, string> = {
  chumba: 'Chumba', apartment: 'Apartment', nyumba: 'Nyumba', studio: 'Studio', duka: 'Duka',
}


function formatPrice(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}k`
  return `${amount}`
}

export default function DashboardClient({ dalaliName, profile, subscription, listings, stats }: Omit<Props, 'username'> & { username?: string | null }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const [basicPrice, setBasicPrice] = useState(10_000)
  useEffect(() => {
    fetch('/api/v1/pricing').then(r => r.json()).then(p => setBasicPrice(p?.subscription?.basic ?? 10_000)).catch(() => {})
  }, [])

  const [welcomeDismissed, setWelcomeDismissed] = useState(false)
  const showWelcome = searchParams.get('welcome') === 'true' && !welcomeDismissed

  function dismissWelcome() {
    setWelcomeDismissed(true)
    router.replace('/dashboard')
  }

  const supabase = createClient()
  const [loggingOut,       setLoggingOut]       = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [activeTab,         setActiveTab]         = useState<'active' | 'pending' | 'all'>('active')
  const [mounted,           setMounted]           = useState(false)
  const [openMenu,          setOpenMenu]          = useState<string | null>(null)
  const [deleteDialog,      setDeleteDialog]      = useState<{ id: string; title: string } | null>(null)
  const [localListings,     setLocalListings]     = useState(listings)

  // Avoid hydration mismatch — date calculations run client-only
  useEffect(() => { setMounted(true) }, [])

  // Close menu when clicking outside
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!openMenu) return
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [openMenu])

  const deleteListing = useCallback(async (id: string) => {
    setDeleteDialog(null)
    setLocalListings(prev => prev.filter(l => l.id !== id))
    await fetch(`/api/v1/listings/${id}`, { method: 'DELETE' })
  }, [])

  async function handleLogout() {
    setLoggingOut(true)
    setShowLogoutConfirm(false)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const filteredListings = localListings.filter(l => {
    if (activeTab === 'active') return l.status === 'active'
    if (activeTab === 'pending') return l.status === 'pending'
    return true
  })

  const subExpiry = mounted && subscription?.expires_at
    ? new Date(subscription.expires_at).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const daysLeft = mounted && subscription?.expires_at
    ? Math.round((new Date(subscription.expires_at).getTime() - Date.now()) / 86_400_000)
    : null

  return (
    <div className="min-h-screen bg-gray-50 pb-24 animate-fadeIn">

      {/* ── Header ── */}
      <div className="relative px-4 pb-6 overflow-hidden gradient-primary" style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top))' }}>
        {/* Decorative circles for depth */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/[0.06] pointer-events-none" />
        <div className="absolute top-4 right-16 w-20 h-20 rounded-full bg-white/[0.05] pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-black/[0.05] pointer-events-none" />

        <div className="relative flex justify-between items-start mb-5">
          <div>
            <p className="text-green-100 text-xs mb-0.5 opacity-80">{t('dash_welcome_greeting')}</p>
            <h1 className="text-white text-xl font-bold drop-shadow-sm">{dalaliName}</h1>
            {(() => {
              const plan = subscription?.plan ?? 'free'
              const PLAN_ICONS: Record<string, string> = { free: 'home', basic: 'star', premium: 'crown', enterprise: 'building' }
              const PLAN_LABELS: Record<string, string> = { free: 'FREE', basic: 'BASIC', premium: 'PREMIUM', enterprise: 'ENTERPRISE' }
              return (
                <span className="inline-flex items-center gap-1 bg-white/20 text-white text-xs px-2.5 py-0.5 rounded-full mt-1.5 border border-white/20 backdrop-blur-sm">
                  <i className={`ti ti-${PLAN_ICONS[plan] ?? 'home'}`} aria-hidden="true" />
                  {PLAN_LABELS[plan] ?? 'FREE'}
                </span>
              )
            })()}
            {profile?.whatsapp_number ? (
              <p className="text-green-100/70 text-xs mt-1.5 flex items-center gap-1">
                <i className="ti ti-phone-filled text-xs" aria-hidden="true" />
                +255 ••• •••{profile.whatsapp_number.slice(-3)}
              </p>
            ) : (
              <a href="/dashboard/profile" className="text-amber-200 text-xs mt-1.5 inline-flex items-center gap-1 underline">
                <i className="ti ti-plus text-xs" aria-hidden="true" /> {t('dash_add_whatsapp')}
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell className="text-white/80 hover:text-white transition-colors" />
            <button
              onClick={() => setShowLogoutConfirm(true)}
              disabled={loggingOut}
              className="bg-white/15 hover:bg-white/25 text-white/80 hover:text-white text-xs transition-all flex items-center gap-1.5 disabled:opacity-50 min-h-[44px] px-3 py-1.5 rounded-xl border border-white/10 backdrop-blur-sm"
            >
              {loggingOut && (
                <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
              )}
              <i className="ti ti-logout text-sm" aria-hidden="true" />
              {loggingOut ? t('dash_logging_out') : t('dash_logout_btn')}
            </button>
          </div>
        </div>

        {/* Stats row — individual colored glass cards */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: t('dash_stat_listings'), value: stats.totalListings, icon: 'ti-home-2',       accent: 'bg-white/10'       },
            { label: t('dash_stat_active'),   value: stats.activeCount,   icon: 'ti-circle-check', accent: 'bg-emerald-400/25' },
            { label: t('dash_stat_views'),    value: stats.totalViews,    icon: 'ti-eye',          accent: 'bg-blue-400/20'    },
            { label: t('dash_stat_leads'),    value: stats.totalLeads,    icon: 'ti-users',        accent: 'bg-amber-400/20'   },
          ].map(s => (
            <div key={s.label} className={`${s.accent} rounded-2xl p-3 border border-white/15 backdrop-blur-sm`}>
              <i className={`ti ${s.icon} text-white/70 text-sm`} aria-hidden="true" />
              <p className="text-white font-bold text-xl leading-none mt-0.5">{s.value.toLocaleString('sw-TZ')}</p>
              <p className="text-green-100/70 text-[10px] mt-0.5 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ── Listing deadline warning (0 listings ever) ── */}
        {stats.totalListings === 0 && <ListingDeadlineBanner />}

        {/* ── No active listing reminder (has listings but none is live) ── */}
        {stats.totalListings > 0 && stats.activeCount === 0 && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <i className="ti ti-eye-off text-amber-600 text-lg" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-amber-800 text-sm">{t('dash_no_active_title')}</p>
              <p className="text-xs text-amber-700 mt-0.5 leading-snug">{t('dash_no_active_sub')}</p>
            </div>
            <Link
              href="/dashboard/listings/new"
              className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 active:scale-[0.97] text-white text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap transition-all"
            >
              {t('dash_add_listing')}
            </Link>
          </div>
        )}

        {/* ── Subscription / Trial banner ── */}
        {(() => {
          // ── Trial active ──────────────────────────────
          if (subscription?.is_trial && subscription.status === 'active') {
            const trialDaysLeft = mounted && subscription.trial_ends_at
              ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86_400_000))
              : 0
            const trialPct = Math.max(0, Math.min(100, (trialDaysLeft / 14) * 100))

            return (
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-2xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="font-bold text-base flex items-center gap-1.5"><i className="ti ti-confetti" aria-hidden="true" /> {t('dash_trial_title')}</p>
                    <p className="text-green-100 text-xs">
                      {trialDaysLeft > 0 ? `${t('dash_trial_days')} ${trialDaysLeft} ${t('dash_trial_days_of')}` : t('dash_trial_today_last')}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${trialDaysLeft <= 3 ? 'text-red-200' : ''}`}>
                      {trialDaysLeft}
                    </div>
                    <div className="text-green-100 text-xs">{t('dash_trial_days')}</div>
                  </div>
                </div>
                <div className="bg-white/20 rounded-full h-1.5 my-3 overflow-hidden">
                  <div
                    className="bg-white rounded-full h-full transition-all"
                    style={{ width: `${trialPct}%` }}
                  />
                </div>
                {trialDaysLeft <= 7 && (
                  <p className="text-yellow-200 text-xs mb-2 text-center">
                    {trialDaysLeft <= 3
                      ? <><i className="ti ti-alert-octagon" aria-hidden="true" /> {t('dash_trial_hurry')}</>
                      : <><i className="ti ti-clock" aria-hidden="true" /> {t('dash_trial_pay_before')}</>}
                  </p>
                )}
                <Link
                  href="/dashboard/subscription"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                             bg-white text-primary-600 font-bold text-sm active:scale-[0.97] transition-all"
                >
                  <i className="ti ti-credit-card" aria-hidden="true" /> {t('dash_continue_sub')} — Tsh {basicPrice.toLocaleString()}/mwezi
                </Link>
              </div>
            )
          }

          // ── Trial expired ─────────────────────────────
          if (subscription?.status === 'trial_expired') {
            return (
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                <p className="font-bold text-red-700 text-base mb-1 flex items-center gap-1.5"><i className="ti ti-circle-x" aria-hidden="true" /> {t('dash_trial_expired_title')}</p>
                <p className="text-red-600 text-xs mb-4">{t('dash_trial_expired_sub')}</p>
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/dashboard/subscription"
                    className="flex flex-col items-center py-3 rounded-xl border-2 border-primary-400 bg-white
                               text-primary-700 font-bold text-xs active:scale-[0.97] transition-all text-center">
                    <span className="font-semibold">Basic</span>
                    <span className="text-lg font-bold">Tsh 10k</span>
                    <span className="text-xs text-gray-400">{t('dash_per_month')}</span>
                  </Link>
                  <Link href="/dashboard/subscription?plan=premium"
                    className="flex flex-col items-center py-3 rounded-xl bg-amber-500 text-white
                               font-bold text-xs active:scale-[0.97] transition-all text-center">
                    <span className="font-semibold flex items-center gap-1"><i className="ti ti-star-filled" aria-hidden="true" /> Premium</span>
                    <span className="text-lg font-bold">Tsh 25k</span>
                    <span className="text-xs text-amber-100">{t('dash_per_month')}</span>
                  </Link>
                </div>
              </div>
            )
          }

          // ── Grace period ──────────────────────────────
          if (subscription?.status === 'grace_period') {
            return (
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-4">
                <p className="text-sm font-bold text-yellow-800 mb-1 flex items-center gap-1.5"><i className="ti ti-alert-triangle" aria-hidden="true" /> {t('dash_grace_title')}</p>
                {subscription.grace_period_until && (
                  <p className="text-xs text-yellow-700 mb-1">
                    {t('dash_grace_days_left')} {mounted ? Math.max(0, Math.ceil((new Date(subscription.grace_period_until).getTime() - Date.now()) / 86_400_000)) : '...'} {t('dash_grace_days_unit')}
                  </p>
                )}
                <p className="text-xs text-yellow-600 mb-3">{t('dash_grace_still_visible')}</p>
                <Link href="/dashboard/subscription"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-yellow-500 text-white text-sm font-bold">
                  <i className="ti ti-refresh" aria-hidden="true" /> {t('dash_renew_now')}
                </Link>
              </div>
            )
          }

          // ── Active paid subscription ──────────────────
          if (subscription) {
            const planData = getPlan(subscription.plan)
            const badge    = PLAN_BADGES[subscription.plan] ?? PLAN_BADGES['free']
            const isFree   = subscription.plan === 'free'
            return (
              <div className="rounded-2xl p-4 border" style={{
                backgroundColor: planData.bgColor,
                borderColor: planData.borderColor,
              }}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: badge.color }}>
                        <i className={`ti ti-${planData.icon}`} aria-hidden="true" /> {badge.label}
                      </span>
                      {!isFree && (
                        <span className={`text-xs font-medium ${
                          daysLeft !== null && daysLeft <= 3 ? 'text-red-600' :
                          daysLeft !== null && daysLeft <= 7 ? 'text-amber-600' : 'text-gray-400'
                        }`}>
                          {daysLeft !== null && daysLeft > 0
                            ? `${t('dash_siku')} ${daysLeft} ${t('dash_days_left_label')}`
                            : t('dash_expired_label')}
                        </span>
                      )}
                      {isFree && daysLeft !== null && (
                        <span className={`text-xs font-medium ${
                          daysLeft <= 7 ? 'text-red-500' : daysLeft <= 14 ? 'text-amber-500' : 'text-gray-400'
                        }`}>
                          {t('dash_siku')} {Math.max(0, daysLeft)} {t('dash_days_left_label')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{t('dash_expires')} {subExpiry}</p>
                  </div>
                  <Link href="/dashboard/subscription"
                    className="text-xs font-medium px-3 py-1.5 rounded-full text-white"
                    style={{ backgroundColor: badge.color }}>
                    {isFree ? t('dash_upgrade') : t('dash_manage')}
                  </Link>
                </div>
                {isFree && daysLeft !== null && daysLeft <= 14 && daysLeft > 0 && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs text-amber-700 font-semibold mb-2">
                      {daysLeft <= 3
                        ? <><i className="ti ti-alert-octagon" aria-hidden="true" /> {t('dash_few_days_left')}</>
                        : <><i className="ti ti-alert-triangle" aria-hidden="true" /> {t('dash_ending_soon')}</>}
                    </p>
                    <Link href="/dashboard/subscription"
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-bold">
                      <i className="ti ti-rocket" aria-hidden="true" /> {t('dash_upgrade_now')} — Tsh {basicPrice.toLocaleString()}/mwezi
                    </Link>
                  </div>
                )}
                {!isFree && daysLeft !== null && daysLeft <= 7 && daysLeft > 0 && (
                  <div className="mt-3">
                    <Link href="/dashboard/subscription"
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 text-white text-xs font-bold">
                      <i className="ti ti-refresh" aria-hidden="true" /> {t('dash_renew_urgently')}
                    </Link>
                  </div>
                )}
                {isFree && (daysLeft === null || daysLeft > 14) && (
                  <div className="mt-2">
                    <Link href="/dashboard/subscription"
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-xs font-bold"
                      style={{ backgroundColor: planData.color }}>
                      <i className="ti ti-star-filled" aria-hidden="true" /> {t('dash_upgrade_basic')} — Tsh {basicPrice.toLocaleString()}/mwezi
                    </Link>
                  </div>
                )}
              </div>
            )
          }

          // ── No subscription ───────────────────────────
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">{t('dash_no_sub_title')}</p>
              <p className="text-xs text-amber-600 mb-3">{t('dash_no_sub_sub')}</p>
              <Link href="/dashboard/subscription"
                className="inline-flex items-center gap-1 bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-full">
                {t('dash_choose_plan')}
              </Link>
            </div>
          )
        })()}

        {/* ── Verification banner ── */}
        {profile !== null && (profile?.verification_status === 'unverified' || !profile?.verification_status) ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-red-800 flex items-center gap-1.5"><i className="ti ti-id-badge" aria-hidden="true" /> {t('dash_verify_id_title')}</p>
              <p className="text-xs text-red-600 mt-0.5">{t('dash_verify_id_sub')}</p>
            </div>
            <Link href="/dashboard/verify"
              className="flex-shrink-0 bg-red-500 text-white text-xs font-semibold px-3 py-2 rounded-full whitespace-nowrap">
              {t('dash_verify_btn')}
            </Link>
          </div>
        ) : profile?.verification_status === 'pending' ? (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3">
            <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5"><i className="ti ti-clock-hour-4" aria-hidden="true" /> {t('dash_pending_docs')}</p>
            <p className="text-xs text-amber-600 mt-0.5">{t('dash_pending_docs_sub')}</p>
          </div>
        ) : profile?.verification_status === 'rejected' ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-red-800 flex items-center gap-1.5"><i className="ti ti-circle-x" aria-hidden="true" /> {t('dash_rejected_title')}</p>
              <p className="text-xs text-red-600 mt-0.5">{profile.verification_rejected_reason ?? t('dash_resubmit_btn')}</p>
            </div>
            <Link href="/dashboard/verify"
              className="flex-shrink-0 bg-red-500 text-white text-xs font-semibold px-3 py-2 rounded-full whitespace-nowrap">
              {t('dash_resubmit_btn')}
            </Link>
          </div>
        ) : null}


        {/* ── Listing usage bar ── */}
        {subscription && (() => {
          const limit     = getListingLimit(subscription.plan)
          const current   = stats.activeCount + stats.pendingCount
          const pct       = limit > 0 ? Math.min(100, (current / limit) * 100) : 0
          const remaining = Math.max(0, limit - current)
          const barColor  = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-primary-500'
          return (
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-semibold text-gray-700">{t('dash_listing_usage')}</p>
                <span className="text-sm font-bold text-gray-800">{current}/{limit}</span>
              </div>
              <div className="bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  role="progressbar"
                  aria-valuenow={current}
                  aria-valuemax={limit}
                  aria-label={t('dash_listing_usage')}
                  className={`${barColor} rounded-full h-full transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {remaining <= 2 && remaining > 0 && (
                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1"><i className="ti ti-alert-triangle" aria-hidden="true" /> {t('dash_trial_days')} {remaining} {t('dash_few_remaining')}</p>
              )}
              {remaining === 0 && (
                <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><i className="ti ti-ban" aria-hidden="true" /> {t('dash_limit_reached')}</p>
              )}
            </div>
          )
        })()}

        {/* ── Stats / Growth Banner ── */}
        <Link
          href="/dashboard/takwimu"
          className="flex items-center gap-3 p-4 bg-gradient-to-r from-primary-600 to-primary-500 rounded-2xl text-white"
        >
          <i className="ti ti-chart-bar text-3xl flex-shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="font-bold">{t('dash_my_stats')}</p>
            <p className="text-green-100 text-xs">{t('dash_stats_sub')}</p>
          </div>
          <span className="flex-shrink-0 text-green-100">→</span>
        </Link>

        {/* ── Matangazo Yangu shortcut ── */}
        <Link
          href="/dashboard/listings"
          className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="w-11 h-11 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="ti ti-home-2 text-2xl text-primary-600" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm">Matangazo Yangu</p>
            <p className="text-gray-400 text-xs mt-0.5">
              {stats.totalListings} tangazo
              {stats.activeCount > 0 && <> · <span className="text-primary-600 font-medium">{stats.activeCount} yanafanya kazi</span></>}
              {stats.pendingCount > 0 && <> · <span className="text-amber-500 font-medium">{stats.pendingCount} yanasubiri</span></>}
            </p>
          </div>
          <i className="ti ti-chevron-right text-gray-300 text-xl flex-shrink-0" aria-hidden="true" />
        </Link>

        {/* ── Listings section ── */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-bold text-gray-800">{t('dash_my_listings')}</h2>
            <Link href="/dashboard/listings/new" className="text-xs text-primary-600 font-medium">
              {t('dash_add_btn')}
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-none -mx-4 px-4">
            {([
              { key: 'active',  label: `${t('dash_tab_active')} (${stats.activeCount})`  },
              { key: 'pending', label: `${t('dash_tab_pending')} (${stats.pendingCount})` },
              { key: 'all',     label: `${t('dash_tab_all')} (${stats.totalListings})`    },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full transition-all ${
                  activeTab === tab.key
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-gray-500 border border-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filteredListings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <div className="text-4xl mb-3"><i className="ti ti-home-2 text-4xl text-gray-300" aria-hidden="true" /></div>
              <p className="text-sm font-semibold text-gray-600 mb-1">
                {activeTab === 'active'  ? t('dash_empty_active')
                : activeTab === 'pending' ? t('dash_empty_pending')
                : t('dash_empty_all')}
              </p>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                {activeTab === 'active'  ? t('dash_empty_active_sub')
                : activeTab === 'pending' ? t('dash_empty_pending_sub')
                : t('dash_empty_all_sub')}
              </p>
              <Link
                href="/dashboard/listings/new"
                className="inline-block text-xs text-white font-semibold bg-primary-500 px-5 py-2.5 rounded-full"
              >
                <i className="ti ti-circle-plus" aria-hidden="true" /> {t('dash_add_first')}
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredListings.map(listing => (
                <div key={listing.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex gap-3 p-3">
                    {/* Thumbnail */}
                    <div className="relative w-20 h-20 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                      {listing.images?.[0] ? (
                        <Image fill src={listing.images[0]} alt="" className="object-cover" sizes="80px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl"><i className="ti ti-home" aria-hidden="true" /></div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {typeLabel[listing.type] || listing.type} – {listing.district}
                        </p>
                        <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_LABELS[listing.status]?.cls ?? 'bg-gray-100 text-gray-500'}`}>
                          {STATUS_LABELS[listing.status]?.label ?? listing.status}
                        </span>
                      </div>
                      <p className="text-primary-600 font-bold text-sm mb-1.5">
                        Tsh {formatPrice(listing.price_monthly)}<span className="text-xs font-normal text-gray-400"> /mwezi</span>
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-0.5"><i className="ti ti-eye text-xs" aria-hidden="true" /> {listing.view_count ?? 0}</span>
                        <span className="flex items-center gap-0.5"><i className="ti ti-phone text-xs" aria-hidden="true" /> {listing.lead_count ?? 0}</span>
                        {listing.is_boosted && (
                          <span className="text-amber-500 font-semibold flex items-center gap-0.5">
                            <i className="ti ti-rocket text-xs" aria-hidden="true" /> Boosted
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex border-t border-gray-50">
                    <Link
                      href={`/listings/${listing.id}`}
                      className="flex-1 text-center py-2.5 text-xs text-gray-500 min-h-[44px] flex items-center justify-center gap-1 active:bg-gray-50"
                    >
                      <i className="ti ti-eye text-xs" aria-hidden="true" /> {t('dash_view')}
                    </Link>
                    <div className="w-px bg-gray-50" />
                    <Link
                      href={`/listings/${listing.id}/edit`}
                      className="flex-1 text-center py-2.5 text-xs text-primary-600 font-medium min-h-[44px] flex items-center justify-center gap-1 active:bg-primary-50"
                    >
                      <i className="ti ti-pencil text-xs" aria-hidden="true" /> {t('dash_edit')}
                    </Link>
                    <div className="w-px bg-gray-50" />
                    {/* Three-dots dropdown */}
                    <div
                      className="relative flex-1"
                      ref={openMenu === listing.id ? menuRef : undefined}
                    >
                      <button
                        onClick={() => setOpenMenu(openMenu === listing.id ? null : listing.id)}
                        className="w-full min-h-[44px] flex items-center justify-center gap-1 text-xs text-gray-500 active:bg-gray-50"
                      >
                        <i className="ti ti-dots-vertical text-xs" aria-hidden="true" /> {t('dash_more')}
                      </button>
                      {openMenu === listing.id && (
                        <div className="absolute right-0 bottom-full mb-1 z-30 bg-white rounded-2xl shadow-xl border border-gray-100 py-1 min-w-[180px]">
                          <Link
                            href={`/listings/${listing.id}`}
                            onClick={() => setOpenMenu(null)}
                            className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-50"
                          >
                            <i className="ti ti-eye text-base text-gray-400" aria-hidden="true" /> Angalia Listing
                          </Link>
                          <Link
                            href={`/listings/${listing.id}/edit`}
                            onClick={() => setOpenMenu(null)}
                            className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-50"
                          >
                            <i className="ti ti-pencil text-base text-gray-400" aria-hidden="true" /> Hariri Listing
                          </Link>
                          <div className="border-t border-gray-100 mt-1 pt-1">
                            <button
                              onClick={() => {
                                setOpenMenu(null)
                                setDeleteDialog({ id: listing.id, title: `${typeLabel[listing.type] ?? listing.type} — ${listing.district}` })
                              }}
                              className="flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 active:bg-red-50 w-full text-left"
                            >
                              <i className="ti ti-trash text-base" aria-hidden="true" /> Futa Listing
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Rating section ── */}
        {profile && profile.rating_count > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-gray-800 mb-2">{t('dash_reviews_title')}</h3>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900">{profile.rating_avg.toFixed(1)}</p>
                <div className="flex justify-center gap-0.5 mt-0.5">
                  {[1,2,3,4,5].map(i => (
                    <i key={i} className={`ti ti-star-filled text-sm ${i <= Math.round(profile.rating_avg) ? 'text-amber-400' : 'text-gray-200'}`} aria-hidden="true" />
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">{profile.rating_count} {t('dash_reviews_from')}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete listing confirm dialog */}
      {deleteDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
          onClick={() => setDeleteDialog(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="text-4xl mb-2"><i className="ti ti-trash text-4xl text-red-500" aria-hidden="true" /></div>
            <h2 className="font-bold text-gray-900 mb-1">Futa listing?</h2>
            <p className="text-gray-500 text-sm mb-5">
              <strong>{deleteDialog.title}</strong><br />
              Listing haitaonekana tena. Hatua hii haiwezi kutenduliwa.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDeleteDialog(null)}
                className="py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold"
              >
                Hapana
              </button>
              <button
                onClick={() => deleteListing(deleteDialog.id)}
                className="py-3 rounded-xl bg-red-500 text-white text-sm font-semibold active:scale-95"
              >
                Ndiyo, futa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout confirm dialog */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
          onClick={() => setShowLogoutConfirm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="text-4xl mb-3"><i className="ti ti-hand-stop text-4xl text-gray-300" aria-hidden="true" /></div>
            <h2 className="font-bold text-gray-900 mb-2">{t('dash_logout_confirm_title')}</h2>
            <p className="text-gray-500 text-sm mb-5">{t('dash_logout_confirm_sub')}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold"
              >
                {t('dash_logout_no')}
              </button>
              <button
                onClick={handleLogout}
                className="py-3 rounded-xl bg-red-500 text-white text-sm font-semibold"
              >
                {t('dash_logout_yes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Welcome Modal — inaonekana baada ya kuthibitisha email */}
      {showWelcome && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Karibu NyumbaFasta"
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
          onClick={dismissWelcome}
        >
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden relative" onClick={e => e.stopPropagation()}>
            <div className="bg-primary-500 px-6 pt-5 pb-4 flex flex-col items-center text-center">
              <button onClick={dismissWelcome} aria-label="Funga"
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white text-sm">
                <i className="ti ti-x" aria-hidden="true" />
              </button>
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
                <i className="ti ti-rosette-discount-check text-white text-3xl" aria-hidden="true" />
              </div>
              <h2 className="font-bold text-lg text-white">{t('dash_welcome_modal_title')}</h2>
              <p className="text-primary-100 text-sm mt-0.5">{t('dash_welcome_modal_sub')}</p>
            </div>
            <div className="px-6 py-5 text-center">
              <p className="text-gray-600 text-sm leading-relaxed">
                {t('dash_welcome_modal_body')}
              </p>
              <button
                onClick={dismissWelcome}
                className="mt-4 w-full bg-primary-500 text-white py-3 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
              >
                {t('dash_welcome_modal_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
