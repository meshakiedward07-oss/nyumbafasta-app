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

export default function DashboardClient({ dalaliName, username, profile, subscription, listings, stats }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const [loggingOut, setLoggingOut] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState<'active' | 'pending' | 'all'>('active')
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch — date calculations run client-only
  useEffect(() => { setMounted(true) }, [])

  async function handleLogout() {
    setLoggingOut(true)
    setShowLogoutConfirm(false)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const filteredListings = listings.filter(l => {
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
      <div className="relative px-4 pt-10 pb-6 overflow-hidden gradient-primary">
        {/* Decorative circles for depth */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/[0.06] pointer-events-none" />
        <div className="absolute top-4 right-16 w-20 h-20 rounded-full bg-white/[0.05] pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-black/[0.05] pointer-events-none" />

        <div className="relative flex justify-between items-start mb-5">
          <div>
            <p className="text-green-100 text-xs mb-0.5 opacity-80">Karibu,</p>
            <h1 className="text-white text-xl font-bold drop-shadow-sm">{dalaliName}</h1>
            {profile?.is_premium_verified && (
              <span className="inline-flex items-center gap-1 bg-white/25 text-white text-xs px-2.5 py-0.5 rounded-full mt-1.5 border border-white/20 backdrop-blur-sm">
                <i className="ti ti-rosette-discount-check text-amber-300" aria-hidden="true" /> Premium
              </span>
            )}
            {profile?.whatsapp_number ? (
              <p className="text-green-100/70 text-xs mt-1.5 flex items-center gap-1">
                <i className="ti ti-phone-filled text-xs" aria-hidden="true" />
                +255 ••• •••{profile.whatsapp_number.slice(-3)}
              </p>
            ) : (
              <a href="/dashboard/profile" className="text-amber-200 text-xs mt-1.5 inline-flex items-center gap-1 underline">
                <i className="ti ti-plus text-xs" aria-hidden="true" /> Weka WhatsApp yako
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
              {loggingOut ? 'Inatoka...' : 'Toka'}
            </button>
          </div>
        </div>

        {/* Stats row — individual colored glass cards */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Matangazo',      value: stats.totalListings, icon: 'ti-home-2',        accent: 'bg-white/10'        },
            { label: 'Zinafanya kazi', value: stats.activeCount,   icon: 'ti-circle-check',  accent: 'bg-emerald-400/25'  },
            { label: 'Waliotazama',    value: stats.totalViews,    icon: 'ti-eye',           accent: 'bg-blue-400/20'     },
            { label: 'Maombi',         value: stats.totalLeads,    icon: 'ti-users',         accent: 'bg-amber-400/20'    },
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
              <p className="font-bold text-amber-800 text-sm">Huna listing hai sasa hivi</p>
              <p className="text-xs text-amber-700 mt-0.5 leading-snug">
                Wateja hawawezi kukupata. Ongeza listing mpya au subiri idhini ya listing iliyowasilishwa.
              </p>
            </div>
            <Link
              href="/dashboard/listings/new"
              className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 active:scale-[0.97] text-white text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap transition-all"
            >
              Ongeza Listing
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
                    <p className="font-bold text-base flex items-center gap-1.5"><i className="ti ti-confetti" aria-hidden="true" /> Trial ya Bure</p>
                    <p className="text-green-100 text-xs">
                      {trialDaysLeft > 0 ? `Siku ${trialDaysLeft} zimebaki kati ya 14` : 'Leo ni siku ya mwisho!'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold ${trialDaysLeft <= 3 ? 'text-red-200' : ''}`}>
                      {trialDaysLeft}
                    </div>
                    <div className="text-green-100 text-xs">siku</div>
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
                    {trialDaysLeft <= 3 ? <><i className="ti ti-alert-octagon" aria-hidden="true" /> Haraka! Siku chache zimebaki</> : <><i className="ti ti-clock" aria-hidden="true" /> Lipa kabla trial haijamalizika</>}
                  </p>
                )}
                <Link
                  href="/dashboard/subscription"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                             bg-white text-primary-600 font-bold text-sm active:scale-[0.97] transition-all"
                >
                  <i className="ti ti-credit-card" aria-hidden="true" /> Endelea na Subscription — Tsh {basicPrice.toLocaleString()}/mwezi
                </Link>
              </div>
            )
          }

          // ── Trial expired ─────────────────────────────
          if (subscription?.status === 'trial_expired') {
            return (
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                <p className="font-bold text-red-700 text-base mb-1 flex items-center gap-1.5"><i className="ti ti-circle-x" aria-hidden="true" /> Trial Yako Imekwisha</p>
                <p className="text-red-600 text-xs mb-4">
                  Listings zako zimesimamishwa kwa muda. Lipa sasa uendelee kupata wateja.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/dashboard/subscription"
                    className="flex flex-col items-center py-3 rounded-xl border-2 border-primary-400 bg-white
                               text-primary-700 font-bold text-xs active:scale-[0.97] transition-all text-center">
                    <span className="font-semibold">Basic</span>
                    <span className="text-lg font-bold">Tsh 10k</span>
                    <span className="text-xs text-gray-400">/mwezi</span>
                  </Link>
                  <Link href="/dashboard/subscription?plan=premium"
                    className="flex flex-col items-center py-3 rounded-xl bg-amber-500 text-white
                               font-bold text-xs active:scale-[0.97] transition-all text-center">
                    <span className="font-semibold flex items-center gap-1"><i className="ti ti-star-filled" aria-hidden="true" /> Premium</span>
                    <span className="text-lg font-bold">Tsh 25k</span>
                    <span className="text-xs text-amber-100">/mwezi</span>
                  </Link>
                </div>
              </div>
            )
          }

          // ── Grace period ──────────────────────────────
          if (subscription?.status === 'grace_period') {
            return (
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-4">
                <p className="text-sm font-bold text-yellow-800 mb-1 flex items-center gap-1.5"><i className="ti ti-alert-triangle" aria-hidden="true" /> Subscription Imekwisha!</p>
                {subscription.grace_period_until && (
                  <p className="text-xs text-yellow-700 mb-1">
                    Grace period: siku {mounted ? Math.max(0, Math.ceil((new Date(subscription.grace_period_until).getTime() - Date.now()) / 86_400_000)) : '...'} zimebaki
                  </p>
                )}
                <p className="text-xs text-yellow-600 mb-3">Listings zako bado zinaonekana — zitasimama grace period ikiisha.</p>
                <Link href="/dashboard/subscription"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-yellow-500 text-white text-sm font-bold">
                  <i className="ti ti-refresh" aria-hidden="true" /> Huisha Sasa
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
                          {daysLeft !== null && daysLeft > 0 ? `siku ${daysLeft} zimebaki` : 'Imeisha'}
                        </span>
                      )}
                      {isFree && daysLeft !== null && (
                        <span className={`text-xs font-medium ${
                          daysLeft <= 7 ? 'text-red-500' : daysLeft <= 14 ? 'text-amber-500' : 'text-gray-400'
                        }`}>
                          siku {Math.max(0, daysLeft)} zimebaki
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">Inaisha: {subExpiry}</p>
                  </div>
                  <Link href="/dashboard/subscription"
                    className="text-xs font-medium px-3 py-1.5 rounded-full text-white"
                    style={{ backgroundColor: badge.color }}>
                    {isFree ? 'Panda Daraja' : 'Simamia'}
                  </Link>
                </div>
                {isFree && daysLeft !== null && daysLeft <= 14 && daysLeft > 0 && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs text-amber-700 font-semibold mb-2">
                      {daysLeft <= 3 ? <><i className="ti ti-alert-octagon" aria-hidden="true" /> Siku chache tu zimebaki!</> : <><i className="ti ti-alert-triangle" aria-hidden="true" /> Kipindi cha bure kinaisha hivi karibuni!</>}
                    </p>
                    <Link href="/dashboard/subscription"
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-bold">
                      <i className="ti ti-rocket" aria-hidden="true" /> Upgrade Sasa — Tsh {basicPrice.toLocaleString()}/mwezi
                    </Link>
                  </div>
                )}
                {!isFree && daysLeft !== null && daysLeft <= 7 && daysLeft > 0 && (
                  <div className="mt-3">
                    <Link href="/dashboard/subscription"
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 text-white text-xs font-bold">
                      <i className="ti ti-refresh" aria-hidden="true" /> Huisha Sasa — Usipoteze Wateja
                    </Link>
                  </div>
                )}
                {isFree && (daysLeft === null || daysLeft > 14) && (
                  <div className="mt-2">
                    <Link href="/dashboard/subscription"
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-xs font-bold"
                      style={{ backgroundColor: planData.color }}>
                      <i className="ti ti-star-filled" aria-hidden="true" /> Upgrade kwenda Basic — Tsh {basicPrice.toLocaleString()}/mwezi
                    </Link>
                  </div>
                )}
              </div>
            )
          }

          // ── No subscription ───────────────────────────
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">Huna subscription</p>
              <p className="text-xs text-amber-600 mb-3">Chagua plan kuanza kutangaza listings zako na kupata wateja.</p>
              <Link href="/dashboard/subscription"
                className="inline-flex items-center gap-1 bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-full">
                Chagua Plan →
              </Link>
            </div>
          )
        })()}

        {/* ── Verification banner ── */}
        {profile !== null && (profile?.verification_status === 'unverified' || !profile?.verification_status) ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-red-800 flex items-center gap-1.5"><i className="ti ti-id-badge" aria-hidden="true" /> Thibitisha utambulisho wako</p>
              <p className="text-xs text-red-600 mt-0.5">Pata badge ya Verified — wateja wanakuamini zaidi</p>
            </div>
            <Link href="/dashboard/verify"
              className="flex-shrink-0 bg-red-500 text-white text-xs font-semibold px-3 py-2 rounded-full whitespace-nowrap">
              Thibitisha →
            </Link>
          </div>
        ) : profile?.verification_status === 'pending' ? (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3">
            <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5"><i className="ti ti-clock-hour-4" aria-hidden="true" /> Hati zinakaguliwa</p>
            <p className="text-xs text-amber-600 mt-0.5">Admin anakagua — masaa 24. Utapata notification.</p>
          </div>
        ) : profile?.verification_status === 'rejected' ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-red-800 flex items-center gap-1.5"><i className="ti ti-circle-x" aria-hidden="true" /> Ombi limekataliwa</p>
              <p className="text-xs text-red-600 mt-0.5">{profile.verification_rejected_reason ?? 'Wasilisha tena na hati sahihi.'}</p>
            </div>
            <Link href="/dashboard/verify"
              className="flex-shrink-0 bg-red-500 text-white text-xs font-semibold px-3 py-2 rounded-full whitespace-nowrap">
              Wasilisha Tena →
            </Link>
          </div>
        ) : null}

        {/* ── Microsite URL card — only for verified dalali ── */}
        {profile?.is_premium_verified && username && (() => {
          const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
          const micrositeUrl = `${APP_URL}/agent/${username}`
          return (
            <div className="bg-white border border-primary-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-primary-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <i className="ti ti-rosette-discount-check" aria-hidden="true" /> Verified
                </span>
                <p className="text-sm font-semibold text-gray-800">Ukurasa Wako wa Umma</p>
              </div>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">Wateja wanaweza kukupata moja kwa moja kupitia kiungo hiki:</p>
              <div className="flex items-center gap-2 bg-primary-50 rounded-xl px-3 py-2 mb-3">
                <i className="ti ti-link text-primary-500 flex-shrink-0 text-sm" aria-hidden="true" />
                <span className="text-xs text-primary-700 font-medium flex-1 truncate">{micrositeUrl.replace('https://', '')}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(micrositeUrl).catch(() => {
                      const ta = document.createElement('textarea')
                      ta.value = micrositeUrl
                      ta.style.position = 'fixed'; ta.style.opacity = '0'
                      document.body.appendChild(ta); ta.focus(); ta.select()
                      document.execCommand('copy'); document.body.removeChild(ta)
                    })
                  }}
                  className="flex items-center justify-center gap-1 bg-primary-500 text-white text-xs font-semibold py-2 rounded-xl active:scale-95 transition-all"
                >
                  <i className="ti ti-copy text-xs" aria-hidden="true" /> Nakili
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Angalia listings zangu za nyumba: ${micrositeUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 bg-green-500 text-white text-xs font-semibold py-2 rounded-xl active:scale-95 transition-all"
                >
                  <i className="ti ti-brand-whatsapp text-xs" aria-hidden="true" /> Share
                </a>
                <a
                  href={micrositeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 bg-gray-100 text-gray-700 text-xs font-semibold py-2 rounded-xl active:scale-95 transition-all"
                >
                  <i className="ti ti-external-link text-xs" aria-hidden="true" /> Fungua
                </a>
              </div>
            </div>
          )
        })()}

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
                <p className="text-sm font-semibold text-gray-700">Matumizi ya Listings</p>
                <span className="text-sm font-bold text-gray-800">{current}/{limit}</span>
              </div>
              <div className="bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  role="progressbar"
                  aria-valuenow={current}
                  aria-valuemax={limit}
                  aria-label="Matumizi ya listings"
                  className={`${barColor} rounded-full h-full transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {remaining <= 2 && remaining > 0 && (
                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1"><i className="ti ti-alert-triangle" aria-hidden="true" /> Zimebaki {remaining} tu — ongeza au upgrade plan</p>
              )}
              {remaining === 0 && (
                <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><i className="ti ti-ban" aria-hidden="true" /> Umefika limit — futa listing moja au ongeza za ziada</p>
              )}
            </div>
          )
        })()}

        {/* ── Stats / Growth Banner ── */}
        <Link
          href="/dashboard/crm"
          className="flex items-center gap-3 p-4 bg-gradient-to-r from-primary-600 to-primary-500 rounded-2xl text-white"
        >
          <i className="ti ti-chart-bar text-3xl flex-shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="font-bold">Takwimu Zangu</p>
            <p className="text-green-100 text-xs">Mwonekano, ukuaji na contacts za microsite yako</p>
          </div>
          <span className="flex-shrink-0 text-green-100">→</span>
        </Link>

        {/* ── Quick actions ── */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { href: '/dashboard/listings/new', icon: 'ti-circle-plus', label: 'Ongeza',  bg: 'bg-primary-50', color: 'text-primary-500' },
            { href: '/dashboard/hesabu',       icon: 'ti-coins',       label: 'Hesabu',  bg: 'bg-blue-50',    color: 'text-blue-500'    },
            { href: '/dashboard/reviews',      icon: 'ti-star',        label: 'Maoni',   bg: 'bg-amber-50',   color: 'text-amber-500'   },
            { href: '/dashboard/profile',      icon: 'ti-settings',    label: 'Akaunti', bg: 'bg-gray-50',    color: 'text-gray-500'    },
          ].map(a => (
            <Link
              key={a.href}
              href={a.href}
              className="flex flex-col items-center gap-1.5 bg-white border border-gray-100 rounded-2xl py-3 shadow-sm active:scale-95 transition-all"
            >
              <div className={`w-10 h-10 rounded-xl ${a.bg} flex items-center justify-center`}>
                <i className={`ti ${a.icon} text-xl ${a.color}`} aria-hidden="true" />
              </div>
              <span className="text-[10px] text-gray-600 font-medium text-center leading-tight">{a.label}</span>
            </Link>
          ))}
        </div>

        {/* ── Listings section ── */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-bold text-gray-800">Listings Zangu</h2>
            <Link href="/dashboard/listings/new" className="text-xs text-primary-600 font-medium">
              + Ongeza
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-none -mx-4 px-4">
            {([
              { key: 'active', label: `Zinafanya kazi (${stats.activeCount})` },
              { key: 'pending', label: `Zinasubiri (${stats.pendingCount})` },
              { key: 'all', label: `Zote (${stats.totalListings})` },
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
                {activeTab === 'active' ? 'Huna listings zinazofanya kazi'
                : activeTab === 'pending' ? 'Hakuna listings zinazosubiri'
                : 'Bado hujaweka listing yoyote'}
              </p>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                {activeTab === 'active'
                  ? 'Listings zilizoidhinishwa na admin zinaonekana hapa. Ongeza listing ili wateja wakupate.'
                : activeTab === 'pending'
                  ? 'Listings zako zote zimeshaidhinishwa na admin. Vizuri sana!'
                  : 'Ongeza nyumba au chumba unachotaka kukodisha. Wateja zaidi ya 10,000 wanasubiri!'}
              </p>
              <Link
                href="/dashboard/listings/new"
                className="inline-block text-xs text-white font-semibold bg-primary-500 px-5 py-2.5 rounded-full"
              >
                <i className="ti ti-circle-plus" aria-hidden="true" /> Ongeza Listing ya Kwanza
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredListings.map(listing => (
                <div key={listing.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
                      <i className="ti ti-eye text-xs" aria-hidden="true" /> Angalia
                    </Link>
                    <div className="w-px bg-gray-50" />
                    <Link
                      href={`/listings/${listing.id}/edit`}
                      className="flex-1 text-center py-2.5 text-xs text-primary-600 font-medium min-h-[44px] flex items-center justify-center gap-1 active:bg-primary-50"
                    >
                      <i className="ti ti-pencil text-xs" aria-hidden="true" /> Hariri
                    </Link>
                    <div className="w-px bg-gray-50" />
                    <Link
                      href="/dashboard/listings"
                      className="flex-1 text-center py-2.5 text-xs text-amber-600 font-medium min-h-[44px] flex items-center justify-center gap-1 active:bg-amber-50"
                    >
                      <i className="ti ti-dots-vertical text-xs" aria-hidden="true" /> Zaidi
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
            <h3 className="text-sm font-bold text-gray-800 mb-2">Maoni ya Wateja</h3>
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
                <p className="text-xs text-gray-500">{profile.rating_count} maoni kutoka kwa wateja</p>
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
            <h2 className="font-bold text-gray-900 mb-2">Toka kwenye akaunti?</h2>
            <p className="text-gray-500 text-sm mb-5">Utahitaji kuingia tena baadaye.</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold"
              >
                Hapana
              </button>
              <button
                onClick={handleLogout}
                className="py-3 rounded-xl bg-red-500 text-white text-sm font-semibold"
              >
                Ndiyo, toka
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
              <h2 className="font-bold text-lg text-white">Akaunti Imethibitishwa</h2>
              <p className="text-primary-100 text-sm mt-0.5">Karibu NyumbaFasta Tanzania</p>
            </div>
            <div className="px-6 py-5 text-center">
              <p className="text-gray-600 text-sm leading-relaxed">
                Uko tayari kuongeza listings zako na kupata wateja wako wa kwanza.
              </p>
              <button
                onClick={dismissWelcome}
                className="mt-4 w-full bg-primary-500 text-white py-3 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
              >
                Anza Kutumia
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
