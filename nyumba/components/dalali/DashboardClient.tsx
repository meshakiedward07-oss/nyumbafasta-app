'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Listing } from '@/lib/types/database'
import NotificationBell from '@/components/shared/NotificationBell'
import { PLAN_BADGES, getListingLimit, getPlan } from '@/lib/config/subscription-plans'
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
  profile: DalaliProfile
  subscription: Subscription
  listings: Listing[]
  stats: Stats
}

const typeLabel: Record<string, string> = {
  chumba: 'Chumba', apartment: 'Apartment', nyumba: 'Nyumba', studio: 'Studio', duka: 'Duka',
}

const statusConfig: Record<string, { label: string; cls: string }> = {
  active:   { label: 'Inapatikana', cls: 'bg-primary-50 text-primary-700' },
  pending:  { label: 'Inasubiri',   cls: 'bg-amber-50 text-amber-700' },
  taken:    { label: 'Imechukuliwa', cls: 'bg-gray-100 text-gray-500' },
  expired:  { label: 'Imeisha',     cls: 'bg-red-50 text-red-500' },
  rejected: { label: 'Ilikataliwa', cls: 'bg-red-50 text-red-600' },
}

function formatPrice(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}k`
  return `${amount}`
}

export default function DashboardClient({ dalaliName, profile, subscription, listings, stats }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const showWelcome = searchParams.get('welcome') === 'true'
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
      <div className="bg-primary-500 px-4 pt-10 pb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-green-100 text-xs mb-0.5">Karibu,</p>
            <h1 className="text-white text-xl font-bold">{dalaliName}</h1>
            {profile?.is_premium_verified && (
              <span className="inline-flex items-center gap-1 bg-white/20 text-white text-xs px-2 py-0.5 rounded-full mt-1">
                <i className="ti ti-check" aria-hidden="true" /> Imethibitishwa
              </span>
            )}
            {profile?.whatsapp_number ? (
              <p className="text-green-100/80 text-xs mt-1">
                <i className="ti ti-phone" aria-hidden="true" /> +{profile.whatsapp_number}
              </p>
            ) : (
              <a href="/dashboard/profile" className="text-amber-200 text-xs mt-1 inline-block underline">
                + Weka WhatsApp yako
              </a>
            )}
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell className="text-white/80 hover:text-white transition-colors" />
            <button
              onClick={() => setShowLogoutConfirm(true)}
              disabled={loggingOut}
              className="text-white/70 text-xs hover:text-white transition-colors flex items-center gap-1 disabled:opacity-50 min-h-[44px] px-1"
            >
              {loggingOut && (
                <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
              )}
              {loggingOut ? 'Inatoka...' : 'Toka'}
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Matangazo', value: stats.totalListings },
            { label: 'Zinafanya kazi', value: stats.activeCount },
            { label: 'Waliotazama', value: stats.totalViews },
            { label: 'Ombi', value: stats.totalLeads },
          ].map(s => (
            <div key={s.label} className="bg-white/15 rounded-xl p-2.5 text-center">
              <p className="text-white font-bold text-lg leading-none">{s.value}</p>
              <p className="text-green-100 text-xs mt-0.5 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ── Listing deadline warning (0 listings) ── */}
        {stats.totalListings === 0 && <ListingDeadlineBanner />}

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
                  <i className="ti ti-credit-card" aria-hidden="true" /> Endelea na Subscription — Tsh 10,000/mwezi
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
                      <i className="ti ti-rocket" aria-hidden="true" /> Upgrade Sasa — Tsh 10,000/mwezi
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
                      <i className="ti ti-star-filled" aria-hidden="true" /> Upgrade kwenda Basic — Tsh 10,000/mwezi
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
            <p className="text-sm font-semibold text-amber-800">⏳ Hati zinakaguliwa</p>
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
                <div className={`${barColor} rounded-full h-full transition-all`} style={{ width: `${pct}%` }} />
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

        {/* ── CRM Banner ── */}
        <Link
          href="/dashboard/crm"
          className="flex items-center gap-3 p-4 bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl text-white"
        >
          <i className="ti ti-target text-3xl flex-shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="font-bold">Leads Zangu</p>
            <p className="text-green-100 text-xs">Simamia leads na deals zako</p>
          </div>
          <span className="flex-shrink-0 text-green-100">→</span>
        </Link>

        {/* ── Quick actions ── */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/dashboard/listings/new"
            className="flex flex-col items-center gap-2 bg-white border border-gray-100 rounded-2xl p-3 shadow-sm"
          >
            <i className="ti ti-circle-plus text-2xl text-gray-400" aria-hidden="true" />
            <span className="text-xs text-gray-600 font-medium text-center leading-tight">Ongeza Listing</span>
          </Link>
          <Link
            href="/dashboard/profile"
            className="flex flex-col items-center gap-2 bg-white border border-gray-100 rounded-2xl p-3 shadow-sm"
          >
            <i className="ti ti-settings text-2xl text-gray-400" aria-hidden="true" />
            <span className="text-xs text-gray-600 font-medium text-center leading-tight">Wasifu Wangu</span>
          </Link>
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
                    <div className="relative w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                      {listing.images?.[0] ? (
                        <Image fill src={listing.images[0]} alt="" className="object-cover" sizes="64px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl"><i className="ti ti-home" aria-hidden="true" /></div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {typeLabel[listing.type] || listing.type} – {listing.district}
                        </p>
                        <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${statusConfig[listing.status]?.cls ?? 'bg-gray-100 text-gray-500'}`}>
                          {statusConfig[listing.status]?.label ?? listing.status}
                        </span>
                      </div>
                      <p className="text-primary-600 font-bold text-xs mb-1.5">
                        Tsh {formatPrice(listing.price_monthly)} / mwezi
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-0.5"><i className="ti ti-eye" aria-hidden="true" /> {listing.view_count}</span>
                        <span className="flex items-center gap-0.5"><i className="ti ti-phone" aria-hidden="true" /> {listing.lead_count}</span>
                        {listing.is_boosted && <span className="text-primary-500 font-medium flex items-center gap-0.5"><i className="ti ti-bolt" aria-hidden="true" /> Imeimarishwa</span>}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex border-t border-gray-50">
                    <Link
                      href={`/listings/${listing.id}`}
                      className="flex-1 text-center py-3 text-xs text-gray-500 hover:text-gray-700 min-h-[44px] flex items-center justify-center"
                    >
                      Angalia
                    </Link>
                    <div className="w-px bg-gray-50" />
                    <Link
                      href={`/listings/${listing.id}/edit`}
                      className="flex-1 text-center py-3 text-xs text-primary-600 font-medium min-h-[44px] flex items-center justify-center"
                    >
                      Hariri
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-xl">
            <div className="text-5xl mb-3"><i className="ti ti-confetti text-5xl text-primary-400" aria-hidden="true" /></div>
            <h2 className="font-bold text-xl mb-2 text-gray-900">Karibu NyumbaFasta!</h2>
            <p className="text-gray-500 text-sm mb-2 leading-relaxed">
              Akaunti yako imethibitishwa vizuri.
            </p>
            <p className="text-gray-500 text-sm mb-5 leading-relaxed">
              Anza kuongeza listings zako na upate wateja wako wa kwanza!
            </p>
            <button
              onClick={() => router.replace('/dashboard')}
              className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
            >
              Anza Kutumia →
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
