'use client'
import { useState, useEffect } from 'react'
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
  // This modal used to show "you got Enterprise, 30 days free" to EVERY new
  // dalali unconditionally, regardless of whether trial activation actually
  // succeeded — some signups ended up with no subscription row at all (a
  // separate backend issue) while still seeing this exact promise. Gate the
  // content on the real subscription so it never claims something that
  // wasn't actually granted.
  const gotEnterpriseTrial = subscription?.plan === 'enterprise' && subscription?.is_trial === true

  function dismissWelcome() {
    setWelcomeDismissed(true)
    router.replace('/dashboard')
  }

  const supabase = createClient()
  const [loggingOut,        setLoggingOut]        = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [mounted,           setMounted]           = useState(false)

  // Avoid hydration mismatch — date calculations run client-only
  useEffect(() => { setMounted(true) }, [])

  async function handleLogout() {
    setLoggingOut(true)
    setShowLogoutConfirm(false)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  // Dashboard home shows only active listings; full list is in Matangazo Yangu
  const activeListings = listings.filter(l => l.status === 'active')

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

        {/* ── Quick actions grid ── */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { href: '/dashboard/listings/new', icon: 'ti-circle-plus', label: t('dash_add_btn'),      color: 'text-primary-600', bg: 'bg-primary-50'  },
            { href: '/dashboard/listings',     icon: 'ti-home-2',       label: t('dl_my_ads_title'),   color: 'text-blue-600',    bg: 'bg-blue-50'     },
            { href: '/dashboard/subscription', icon: 'ti-crown',        label: t('dash_upgrade'),      color: 'text-amber-600',   bg: 'bg-amber-50'    },
            { href: '/dashboard/profile',      icon: 'ti-user-edit',    label: t('cl_profile'),        color: 'text-gray-600',    bg: 'bg-gray-100'    },
          ].map(a => (
            <Link key={a.href} href={a.href}
              className="flex flex-col items-center gap-1.5 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm active:scale-[0.95] transition-transform">
              <div className={`w-10 h-10 ${a.bg} rounded-xl flex items-center justify-center`}>
                <i className={`ti ${a.icon} text-xl ${a.color}`} aria-hidden="true" />
              </div>
              <p className="text-[10px] font-semibold text-gray-600 text-center leading-tight px-1">{a.label}</p>
            </Link>
          ))}
        </div>

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
            const trialPct = Math.max(0, Math.min(100, (trialDaysLeft / 30) * 100))

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
                  <i className="ti ti-credit-card" aria-hidden="true" /> {t('dash_continue_sub')} — Tsh {basicPrice.toLocaleString()}{t('dash_per_month')}
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
                      <i className="ti ti-rocket" aria-hidden="true" /> {t('dash_upgrade_now')} — Tsh {basicPrice.toLocaleString()}{t('dash_per_month')}
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
                      <i className="ti ti-star-filled" aria-hidden="true" /> {t('dash_upgrade_basic')} — Tsh {basicPrice.toLocaleString()}{t('dash_per_month')}
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
          <i className="ti ti-chevron-right flex-shrink-0 text-green-100 text-xl" aria-hidden="true" />
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
            <p className="font-bold text-gray-900 text-sm">{t('dl_my_ads_title')}</p>
            <p className="text-gray-400 text-xs mt-0.5">
              {stats.totalListings} {t('dl_listing_singular')}
              {stats.activeCount > 0 && <> · <span className="text-primary-600 font-medium">{stats.activeCount} {t('dl_listing_active_unit')}</span></>}
              {stats.pendingCount > 0 && <> · <span className="text-amber-500 font-medium">{stats.pendingCount} {t('dl_listing_pending_unit')}</span></>}
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

          {activeListings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <div className="text-4xl mb-3"><i className="ti ti-home-2 text-4xl text-gray-300" aria-hidden="true" /></div>
              <p className="text-sm font-semibold text-gray-600 mb-1">{t('dash_empty_active')}</p>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">{t('dash_empty_active_sub')}</p>
              <Link
                href="/dashboard/listings/new"
                className="inline-block text-xs text-white font-semibold bg-primary-500 px-5 py-2.5 rounded-full"
              >
                <i className="ti ti-circle-plus" aria-hidden="true" /> {t('dash_add_first')}
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {activeListings.map(listing => (
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
                        Tsh {formatPrice(listing.price_monthly)}<span className="text-xs font-normal text-gray-400"> {t('dash_per_month')}</span>
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

                  {/* Actions — "Zaidi" goes to full Matangazo Yangu management page */}
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
                    <Link
                      href="/dashboard/listings"
                      className="flex-1 text-center py-2.5 text-xs text-gray-500 min-h-[44px] flex items-center justify-center gap-1 active:bg-gray-50"
                    >
                      <i className="ti ti-dots-vertical text-xs" aria-hidden="true" /> {t('dash_more')}
                    </Link>
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

      {/* Welcome Modal — Growth Plan popup baada ya registration */}
      {showWelcome && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Growth Plan ya Bure"
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
          onClick={dismissWelcome}
        >
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden relative" onClick={e => e.stopPropagation()}>
            {gotEnterpriseTrial ? (
              <>
                {/* Header */}
                <div className="bg-gradient-to-br from-primary-500 to-primary-700 px-6 pt-6 pb-5 text-center relative">
                  <button onClick={dismissWelcome} aria-label="Funga"
                    className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white text-sm">
                    <i className="ti ti-x" aria-hidden="true" />
                  </button>
                  {/* Badge */}
                  <div className="inline-flex items-center gap-1.5 bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full mb-3">
                    <i className="ti ti-crown text-yellow-300" aria-hidden="true" /> ENTERPRISE PLAN
                  </div>
                  <h2 className="font-bold text-2xl text-white leading-tight">{t('dash_welcome_modal_title')}</h2>
                  <p className="text-primary-100 text-sm mt-1">{t('dash_welcome_modal_sub')}</p>
                  {/* Days countdown */}
                  <div className="mt-4 inline-flex items-center gap-3 bg-white/10 rounded-2xl px-5 py-3">
                    <div className="text-center">
                      <div className="text-4xl font-black text-white">30</div>
                      <div className="text-primary-200 text-[10px] uppercase tracking-wider">Siku Bure</div>
                    </div>
                    <div className="w-px h-10 bg-white/20" />
                    <div className="text-left">
                      <div className="text-white text-xs font-semibold">Inaanza leo</div>
                      <div className="text-primary-200 text-[10px] mt-0.5">Bila kadi ya benki</div>
                      <div className="text-primary-200 text-[10px]">Bila malipo yoyote</div>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="px-5 pt-4 pb-2">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Unachopata sasa hivi</p>
                  <div className="space-y-2">
                    {[
                      { icon: 'ti-home-2',      text: 'Listings hadi 50 active' },
                      { icon: 'ti-photo',       text: 'Picha 20 kwa kila listing' },
                      { icon: 'ti-video',       text: 'Video za listings' },
                      { icon: 'ti-rocket',      text: 'Boost listing — ionekane juu zaidi' },
                      { icon: 'ti-rosette-discount-check', text: 'Verified badge — wateja wanakuamini' },
                      { icon: 'ti-chart-bar',   text: 'Analytics kamili + export data' },
                      { icon: 'ti-brand-whatsapp', text: 'WhatsApp yako inaonekana kwa wateja' },
                      { icon: 'ti-headset',     text: 'Priority support 24/7' },
                    ].map(f => (
                      <div key={f.icon} className="flex items-center gap-2.5">
                        <div className="w-6 h-6 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <i className={`ti ${f.icon} text-primary-600 text-xs`} aria-hidden="true" />
                        </div>
                        <span className="text-sm text-gray-700">{f.text}</span>
                        <i className="ti ti-check text-green-500 text-sm ml-auto" aria-hidden="true" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* After trial info */}
                <div className="mx-5 mt-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
                  <i className="ti ti-info-circle text-amber-500 text-base flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-xs text-amber-700 leading-snug">{t('dash_welcome_modal_after')}</p>
                </div>
              </>
            ) : (
              <>
                {/* Honest fallback — trial activation didn't grant Enterprise
                    (or failed outright); never promise a plan that wasn't
                    actually applied to this account. */}
                <div className="bg-gradient-to-br from-primary-500 to-primary-700 px-6 pt-6 pb-5 text-center relative">
                  <button onClick={dismissWelcome} aria-label="Funga"
                    className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white text-sm">
                    <i className="ti ti-x" aria-hidden="true" />
                  </button>
                  <div className="inline-flex items-center gap-1.5 bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full mb-3">
                    <i className="ti ti-home" aria-hidden="true" /> FREE PLAN
                  </div>
                  <h2 className="font-bold text-2xl text-white leading-tight">Karibu NyumbaFasta! 👋</h2>
                  <p className="text-primary-100 text-sm mt-1">Akaunti yako iko tayari kwenye Free Plan</p>
                </div>
                <div className="px-5 pt-4 pb-2">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-6 h-6 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <i className="ti ti-home-2 text-primary-600 text-xs" aria-hidden="true" />
                    </div>
                    <span className="text-sm text-gray-700">Listings 2 active</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-snug mt-3">
                    Chagua Basic, Premium au Enterprise wakati wowote ili kuongeza uwezo wako — listings zaidi, boost, verified badge, na analytics kamili.
                  </p>
                </div>
              </>
            )}

            {/* CTA */}
            <div className="px-5 pb-5 flex flex-col gap-2">
              <button
                onClick={dismissWelcome}
                className="w-full bg-primary-500 text-white py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-transform"
              >
                {gotEnterpriseTrial ? t('dash_welcome_modal_btn') : 'Sawa, Nimeelewa'}
              </button>
              <Link
                href="/dashboard/subscription"
                onClick={dismissWelcome}
                className="w-full text-center text-xs text-gray-400 py-1.5 hover:text-gray-600"
              >
                Angalia plans zote →
              </Link>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
