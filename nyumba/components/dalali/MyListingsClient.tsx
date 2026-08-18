'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import BoostModal from '@/components/dalali/BoostModal'
import QuickEditModal from '@/components/dalali/QuickEditModal'
import ListingAnalyticsCard from '@/components/dalali/ListingAnalyticsCard'
import { ListingDeadlineBanner } from '@/components/dalali/ListingDeadlineBanner'
import type { Listing } from '@/lib/types/database'
import { useLanguage } from '@/lib/i18n/context'
import type { TKey } from '@/lib/i18n/translations'

const STATUS_CLS: Record<string, string> = {
  active:   'bg-primary-50 text-primary-700',
  pending:  'bg-blue-50 text-blue-700',
  taken:    'bg-amber-50 text-amber-700',
  expired:  'bg-gray-100 text-gray-500',
  rejected: 'bg-red-50 text-red-600',
}

const STATUS_KEYS: Record<string, TKey> = {
  active: 'my_status_active', pending: 'my_status_pending', taken: 'my_status_taken',
  expired: 'my_status_expired', rejected: 'my_status_rejected',
}

const TYPE_KEYS: Record<string, TKey> = {
  chumba: 'my_type_chumba', apartment: 'my_type_apartment', nyumba: 'my_type_nyumba',
  studio: 'my_type_studio', duka: 'my_type_duka',
}

function getTypeName(type: string, t: (k: TKey) => string): string {
  return TYPE_KEYS[type] ? t(TYPE_KEYS[type]) : type
}

function getStatusLabel(status: string, t: (k: TKey) => string): string {
  return STATUS_KEYS[status] ? t(STATUS_KEYS[status]) : status
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return `${n}`
}

function daysLeft(expiresAt: string | null): number {
  if (!expiresAt) return 999
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

// ── Expiry Badge ──────────────────────────────────────────
function ListingExpiryBadge({ expiresAt, status }: { expiresAt: string | null; status: string }) {
  const { t } = useLanguage()
  if (status === 'expired') {
    return (
      <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-medium">
        <i className="ti ti-circle-x" aria-hidden="true" /> {t('my_expired_label')}
      </span>
    )
  }
  if (!expiresAt) return null
  const days = daysLeft(expiresAt)
  if (days <= 7) return (
    <span suppressHydrationWarning className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-medium animate-pulse">
      <i className="ti ti-circle-dot" aria-hidden="true" /> {t('my_days_urgent').replace('{{n}}', String(days))}
    </span>
  )
  if (days <= 14) return (
    <span suppressHydrationWarning className="bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full font-medium">
      <i className="ti ti-alert-triangle" aria-hidden="true" /> {t('my_days_remaining').replace('{{n}}', String(days))}
    </span>
  )
  if (days <= 30) return (
    <span suppressHydrationWarning className="bg-yellow-100 text-yellow-600 text-xs px-2 py-0.5 rounded-full font-medium">
      <i className="ti ti-clock" aria-hidden="true" /> {t('my_days_remaining').replace('{{n}}', String(days))}
    </span>
  )
  return (
    <span suppressHydrationWarning className="bg-green-100 text-green-600 text-xs px-2 py-0.5 rounded-full">
      <i className="ti ti-circle-check" aria-hidden="true" /> {t('my_days_remaining').replace('{{n}}', String(days))}
    </span>
  )
}

// ── Renew Button ──────────────────────────────────────────
function RenewButton({ listing, onRenewed, autoOpen }: { listing: Listing; onRenewed: () => void; autoOpen?: boolean }) {
  const supabase = createClient()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(!!autoOpen)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const days = daysLeft(listing.expires_at)
  const needsRenewal = days <= 14 || listing.status === 'expired'
  if (!needsRenewal && !autoOpen) return null

  async function handleRenew() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.rpc('renew_listing', {
        listing_id: listing.id,
        owner_id: user?.id,
      })
      if (error) throw error
      setShowModal(false)
      showToast(`"${listing.title || `${getTypeName(listing.type, t)} — ${listing.district}`}" ${t('my_renew_success')}`, true)
      onRenewed()
    } catch (err) {
      showToast('Kosa: ' + String(err), false)
    } finally {
      setLoading(false)
    }
  }

  const renewDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    .toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 ${
          listing.status === 'expired' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
        }`}
      >
        <i className="ti ti-refresh" aria-hidden="true" /> {t('my_renew_btn')}
      </button>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-3 rounded-2xl text-sm font-medium text-white shadow-lg transition-all
          ${toast.ok ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Renewal Modal — bottom sheet */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl p-5 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden" />
            <h3 className="font-bold text-lg mb-2 flex items-center gap-1.5"><i className="ti ti-refresh" aria-hidden="true" /> {t('my_renew_title')}</h3>

            {/* Listing preview */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="font-medium text-sm">
                {listing.title || `${getTypeName(listing.type, t)} — ${listing.district}`}
              </p>
              <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1"><i className="ti ti-map-pin" aria-hidden="true" /> {listing.district}, {listing.region}</p>
              <p className="text-primary-500 font-semibold text-sm mt-1">
                Tsh {listing.price_monthly?.toLocaleString()}{t('my_per_month')}
              </p>
            </div>

            {/* Info */}
            <div className="space-y-2 mb-4">
              {([
                'my_renew_info1', 'my_renew_info2', 'my_renew_info3',
              ] as const).map(key => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <i className="ti ti-check text-green-500" aria-hidden="true" />
                  <span className="text-gray-600">{t(key)}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 text-sm">
                <i className="ti ti-info-circle text-blue-500" aria-hidden="true" />
                <span className="text-gray-600">{t('my_renew_free')}</span>
              </div>
            </div>

            {/* New expiry */}
            <div suppressHydrationWarning className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-center">
              <p className="text-green-700 text-sm font-medium">{t('my_renew_after')}</p>
              <p className="text-green-600 text-xs mt-0.5">{t('my_renew_expires').replace('{{date}}', renewDate)}</p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium"
              >
                {t('common_cancel')}
              </button>
              <button
                onClick={handleRenew}
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-primary-500 text-white text-sm font-bold disabled:opacity-50"
              >
                {loading ? t('my_renewing') : <><i className="ti ti-circle-check" aria-hidden="true" /> {t('my_renew_now_btn')}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Dialog type ───────────────────────────────────────────
type Dialog = { type: 'taken' | 'available' | 'delete'; listingId: string; title: string; isMulti?: boolean; totalCapacity?: number }
type Tab = 'all' | 'active' | 'expired'

// ── Main component ────────────────────────────────────────
type SlotInfo = { current: number; limit: number; plan: string | null } | null

export default function MyListingsClient({ listings: initial, autoRenewId }: { listings: Listing[]; autoRenewId?: string }) {
  const router = useRouter()
  const { t } = useLanguage()
  const [listings, setListings] = useState(initial)
  const [apiLoading, setApiLoading] = useState(true)
  const [slotInfo, setSlotInfo] = useState<SlotInfo>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [duplicating, setDuplicating] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [boostListing, setBoostListing] = useState<Listing | null>(null)
  const [editListing, setEditListing] = useState<Listing | null>(null)
  const [expandedAnalytics, setExpandedAnalytics] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [remainingNeeded, setRemainingNeeded] = useState('1')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/v1/subscriptions/can-post')
      .then(r => r.json())
      .then(d => setSlotInfo({ current: d.current ?? 0, limit: d.limit ?? 0, plan: d.plan ?? null }))
      .catch(() => {})
  }, [])

  // Always fetch fresh listings from API — bypasses any SSR cache or RLS issue
  useEffect(() => {
    let cancelled = false
    setApiLoading(true)
    fetch('/api/v1/dalali/my-listings')
      .then(r => r.ok ? r.json() : null)
      .then((data: Listing[] | null) => {
        if (!cancelled) {
          if (Array.isArray(data)) setListings(data)
          setApiLoading(false)
        }
      })
      .catch(() => { if (!cancelled) setApiLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Auto-trigger renewal modal when navigated here from a notification with ?renew=<listingId>
  const [autoRenewTriggered, setAutoRenewTriggered] = useState(false)
  const [autoRenewListing, setAutoRenewListing] = useState<Listing | null>(null)
  useEffect(() => {
    if (!autoRenewId || autoRenewTriggered) return
    const target = initial.find(l => l.id === autoRenewId)
    if (target) {
      setAutoRenewTriggered(true)
      setAutoRenewListing(target)
    }
  }, [autoRenewId, autoRenewTriggered, initial])

  useEffect(() => {
    function handle(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  }, [])

  async function setStatus(id: string, status: 'active' | 'taken') {
    setLoading(id)
    setDialog(null)
    try {
      const res = await fetch(`/api/v1/listings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_status', status }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d.error ?? t('my_err_status'))
        return
      }
      setListings(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    } finally {
      setLoading(null)
    }
  }

  async function reactivateMulti(id: string, remaining: number) {
    setLoading(id)
    setDialog(null)
    try {
      const res = await fetch(`/api/v1/listings/${id}/occupancy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remaining_needed: remaining }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d.error ?? t('my_err_status'))
        return
      }
      setListings(prev => prev.map(l =>
        l.id === id ? { ...l, status: 'active', current_occupancy: 0, total_capacity: remaining } : l
      ))
    } finally {
      setLoading(null)
    }
  }

  async function duplicateListing(id: string) {
    setOpenMenu(null)
    setDuplicating(id)
    try {
      const res  = await fetch(`/api/v1/listings/${id}/duplicate`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? t('my_err_duplicate')); return }
      router.refresh()
    } finally { setDuplicating(null) }
  }

  async function deleteListing(id: string) {
    setLoading(id)
    setDialog(null)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/v1/listings/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setDeleteError(json.error ?? t('my_err_delete'))
        return
      }
      setListings(prev => prev.filter(l => l.id !== id))
      router.refresh()
    } catch {
      setDeleteError(t('my_err_network'))
    } finally {
      setLoading(null)
    }
  }

  function refreshListings() {
    setApiLoading(true)
    fetch('/api/v1/dalali/my-listings')
      .then(r => r.ok ? r.json() : null)
      .then((data: Listing[] | null) => {
        if (Array.isArray(data)) setListings(data)
        setApiLoading(false)
      })
      .catch(() => setApiLoading(false))
    router.refresh()
  }

  const activeCount  = listings.filter(l => l.status === 'active').length
  const pendingCount = listings.filter(l => l.status === 'pending').length
  const expiredCount = listings.filter(l => l.status === 'expired').length

  const displayed = tab === 'active'
    ? listings.filter(l => l.status !== 'expired')
    : tab === 'expired'
    ? listings.filter(l => l.status === 'expired')
    : listings

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* Header */}
      <div className="bg-primary-500 px-4 pb-4" style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top))' }}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-white text-lg font-bold">{t('my_listings_title')}</h1>
            <p className="text-green-100 text-xs">
              {activeCount} {t('my_active_working')} · {pendingCount} {t('my_pending_waiting')}
            </p>
            {slotInfo && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="flex-1 max-w-[120px] h-1.5 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${slotInfo.current >= slotInfo.limit ? 'bg-red-400' : 'bg-white'}`}
                    style={{ width: `${Math.min(100, slotInfo.limit > 0 ? (slotInfo.current / slotInfo.limit) * 100 : 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-green-100 font-medium">
                  {slotInfo.current}/{slotInfo.limit} {t('my_slots_label')}
                </span>
              </div>
            )}
          </div>
          <Link
            href="/dashboard/listings/new"
            className="flex items-center gap-1 bg-white text-primary-600 text-xs font-semibold px-3 py-2 rounded-full"
          >
            <i className="ti ti-circle-plus" aria-hidden="true" /> {t('my_add_btn')}
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {([
            { key: 'all',     label: `${t('my_tab_all')} (${listings.length})` },
            { key: 'active',  label: `${t('my_tab_active')} (${listings.filter(l => l.status !== 'expired').length})` },
            { key: 'expired', label: `${t('my_tab_expired')} (${expiredCount})` },
          ] as { key: Tab; label: string }[]).map(tb => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                tab === tb.key
                  ? 'bg-white text-primary-700'
                  : 'bg-white/20 text-white'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* Loading skeleton while API fetch is in progress */}
        {apiLoading && (
          <div className="space-y-3 animate-pulse">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-3 flex gap-3">
                <div className="w-20 h-20 bg-gray-200 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="flex gap-2 mt-2">
                    <div className="h-5 w-16 bg-gray-200 rounded-full" />
                    <div className="h-5 w-12 bg-gray-200 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Deadline banner — only shown to dalali with 0 listings */}
        {!apiLoading && listings.length === 0 && <ListingDeadlineBanner />}

        {/* No active listing warning */}
        {!apiLoading && listings.length > 0 && activeCount === 0 && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <i className="ti ti-eye-off text-amber-600 text-lg" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-amber-800 text-sm">{t('my_no_active_title')}</p>
              <p className="text-xs text-amber-700 mt-0.5 leading-snug">
                {t('my_no_active_desc')}
              </p>
            </div>
            <Link
              href="/dashboard/listings/new"
              className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 active:scale-[0.97] text-white text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap transition-all"
            >
              {t('my_add_btn')}
            </Link>
          </div>
        )}

        {/* Performance summary */}
        {!apiLoading && listings.filter(l => l.status === 'active').length > 0 && (() => {
          const active = listings.filter(l => l.status === 'active')
          const best = active.reduce((a, b) => {
            const diff = (b.view_count ?? 0) - (a.view_count ?? 0)
            return diff !== 0 ? (diff > 0 ? b : a) : (b.id > a.id ? b : a)
          })
          const worst = active.reduce((a, b) => {
            const diff = (b.view_count ?? 0) - (a.view_count ?? 0)
            return diff !== 0 ? (diff < 0 ? b : a) : (b.id < a.id ? b : a)
          })
          return (
            <div className="bg-white rounded-2xl border border-gray-100 p-3 flex gap-2">
              <div className="flex-1 bg-primary-50 rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-0.5"><i className="ti ti-flame" aria-hidden="true" /> {t('my_perf_good')}</p>
                <p className="text-xs font-semibold text-gray-800 truncate">
                  {getTypeName(best.type, t)} — {best.district}
                </p>
                <p className="text-[10px] text-primary-600">{best.view_count ?? 0} {t('my_views_label')}</p>
              </div>
              {worst.id !== best.id && (
                <div className="flex-1 bg-amber-50 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-0.5"><i className="ti ti-bulb" aria-hidden="true" /> {t('my_perf_needs')}</p>
                  <p className="text-xs font-semibold text-gray-800 truncate">
                    {getTypeName(worst.type, t)} — {worst.district}
                  </p>
                  <p className="text-[10px] text-amber-600">{worst.view_count ?? 0} {t('my_views_label')}</p>
                </div>
              )}
            </div>
          )
        })()}

        {!apiLoading && (displayed.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            {tab === 'expired' ? (
              <>
                <div className="text-5xl mb-3"><i className="ti ti-circle-check text-5xl text-green-400" aria-hidden="true" /></div>
                <p className="text-sm text-gray-600 font-medium">{t('my_no_expired_title')}</p>
                <p className="text-xs text-gray-400 mt-1">{t('my_no_expired_sub')}</p>
              </>
            ) : (
              <>
                <div className="text-5xl mb-3"><i className="ti ti-home-2 text-5xl text-gray-300" aria-hidden="true" /></div>
                <p className="text-sm text-gray-600 font-medium mb-1">{t('my_empty_title')}</p>
                <p className="text-xs text-gray-400 mb-5">{t('my_empty_sub')}</p>
                <Link
                  href="/dashboard/listings/new"
                  className="inline-block bg-primary-500 text-white text-sm font-semibold px-6 py-3 rounded-2xl"
                >
                  <i className="ti ti-circle-plus" aria-hidden="true" /> {t('my_empty_btn')}
                </Link>
              </>
            )}
          </div>
        ) : (
          displayed.map(listing => {
            const cfg       = { label: getStatusLabel(listing.status, t), cls: STATUS_CLS[listing.status] ?? 'bg-gray-100 text-gray-500' }
            const isLoading = loading === listing.id
            const isExpired = listing.status === 'expired'

            return (
              <div
                key={listing.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-opacity ${
                  isLoading ? 'opacity-50' : ''
                } ${isExpired ? 'border-red-200 opacity-80' : 'border-gray-100'}`}
              >
                {/* Expired banner */}
                {isExpired && (
                  <div className="bg-red-50 px-3 py-2 flex items-center justify-between">
                    <p className="text-red-600 text-xs font-medium flex items-center gap-1"><i className="ti ti-circle-x" aria-hidden="true" /> {t('my_expired_banner')}</p>
                    <RenewButton listing={listing} onRenewed={refreshListings} />
                  </div>
                )}

                {/* Card body */}
                <div className="flex gap-3 p-3">
                  <div className="relative w-20 h-20 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                    {listing.images?.[0] ? (
                      <Image fill src={listing.images[0]} alt="" className="object-cover" sizes="80px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl text-gray-300"><i className="ti ti-home" aria-hidden="true" /></div>
                    )}
                    {listing.status === 'taken' && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold">{t('my_taken_overlay')}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {getTypeName(listing.type, t)} — {listing.district}
                      </p>
                      {/* ⋮ dots menu */}
                      <div className="relative flex-shrink-0" ref={openMenu === listing.id ? menuRef : undefined}>
                        <button
                          onClick={() => setOpenMenu(openMenu === listing.id ? null : listing.id)}
                          className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 active:bg-gray-100 active:scale-90 transition-all"
                        >
                          ⋮
                        </button>

                        {openMenu === listing.id && (
                          <div className="absolute right-0 top-10 z-30 bg-white rounded-2xl shadow-xl border border-gray-100 py-1 min-w-[196px]">
                            <Link
                              href={`/listings/${listing.id}`}
                              onClick={() => setOpenMenu(null)}
                              className="flex items-center gap-3 px-4 py-3.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-50"
                            >
                              <i className="ti ti-eye text-base text-gray-400" aria-hidden="true" /> {t('my_menu_view')}
                            </Link>
                            <Link
                              href={`/listings/${listing.id}/edit`}
                              onClick={() => setOpenMenu(null)}
                              className="flex items-center gap-3 px-4 py-3.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-50"
                            >
                              <i className="ti ti-pencil text-base text-gray-400" aria-hidden="true" /> {t('my_menu_edit')}
                            </Link>

                            <button
                              onClick={() => duplicateListing(listing.id)}
                              disabled={duplicating === listing.id}
                              className="flex items-center gap-3 px-4 py-3.5 text-sm text-blue-600 hover:bg-blue-50 active:bg-blue-50 w-full text-left disabled:opacity-50"
                            >
                              <i className="ti ti-copy text-base text-blue-400" aria-hidden="true" />
                              {duplicating === listing.id ? t('my_menu_duplicating') : t('my_menu_duplicate')}
                            </button>

                            {listing.status === 'active' && (
                              <button
                                onClick={() => {
                                  setOpenMenu(null)
                                  setDialog({ type: 'taken', listingId: listing.id, title: `${getTypeName(listing.type, t)} — ${listing.district}` })
                                }}
                                className="flex items-center gap-3 px-4 py-3.5 text-sm text-amber-700 hover:bg-amber-50 active:bg-amber-50 w-full text-left"
                              >
                                <i className="ti ti-circle-dot text-base text-amber-500" aria-hidden="true" /> {t('my_menu_taken')}
                              </button>
                            )}

                            {listing.status === 'taken' && (
                              <button
                                onClick={() => {
                                  setOpenMenu(null)
                                  setRemainingNeeded('1')
                                  setDialog({ type: 'available', listingId: listing.id, title: `${getTypeName(listing.type, t)} — ${listing.district}`, isMulti: listing.listing_unit_type === 'multi', totalCapacity: listing.total_capacity })
                                }}
                                className="flex items-center gap-3 px-4 py-3.5 text-sm text-primary-700 hover:bg-primary-50 active:bg-primary-50 w-full text-left"
                              >
                                <i className="ti ti-circle-check text-base text-primary-500" aria-hidden="true" /> {t('my_menu_available')}
                              </button>
                            )}

                            <div className="border-t border-gray-100 mt-1 pt-1">
                              <button
                                onClick={() => {
                                  setOpenMenu(null)
                                  setDialog({ type: 'delete', listingId: listing.id, title: `${getTypeName(listing.type, t)} — ${listing.district}` })
                                }}
                                className="flex items-center gap-3 px-4 py-3.5 text-sm text-red-500 hover:bg-red-50 active:bg-red-50 w-full text-left"
                              >
                                <i className="ti ti-trash text-base" aria-hidden="true" /> {t('my_menu_delete')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full mb-1.5 ${cfg.cls}`}>
                      {cfg.label}
                    </span>

                    <p className="text-primary-600 font-bold text-xs mb-1">
                      Tsh {fmt(listing.price_monthly)} {t('my_per_month')}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                      <span className="flex items-center gap-0.5"><i className="ti ti-eye" aria-hidden="true" /> {listing.view_count ?? 0}</span>
                      <span className="flex items-center gap-0.5"><i className="ti ti-link" aria-hidden="true" /> {listing.share_count ?? 0}</span>
                      <span className="flex items-center gap-0.5"><i className="ti ti-phone" aria-hidden="true" /> {listing.lead_count ?? 0}</span>
                      {listing.is_boosted && (
                        <span className="text-yellow-600 font-semibold" suppressHydrationWarning>
                          <i className="ti ti-rocket" aria-hidden="true" /> {t('my_boosted_label')}
                        </span>
                      )}
                    </div>

                    {/* Occupancy progress bar for multi-unit listings */}
                    {listing.listing_unit_type === 'multi' && listing.total_capacity > 0 && (
                      <div className="mt-1.5">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] text-gray-400">
                            <i className="ti ti-users" aria-hidden="true" /> {t('my_occupancy_label')}
                          </span>
                          <span className={`text-[10px] font-semibold ${
                            listing.current_occupancy >= listing.total_capacity ? 'text-red-500' : 'text-gray-500'
                          }`}>
                            {listing.current_occupancy ?? 0} / {listing.total_capacity}
                            {listing.current_occupancy >= listing.total_capacity && ` — ${t('my_occupancy_full')}`}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              listing.current_occupancy >= listing.total_capacity ? 'bg-red-400' : 'bg-primary-400'
                            }`}
                            style={{ width: `${Math.min(100, ((listing.current_occupancy ?? 0) / listing.total_capacity) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Expiry badge + renew button */}
                    {!isExpired && (
                      <div className="flex items-center justify-between mt-2">
                        <ListingExpiryBadge expiresAt={listing.expires_at} status={listing.status} />
                        <RenewButton listing={listing} onRenewed={refreshListings} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick action row */}
                {(listing.status === 'active' || listing.status === 'taken') && (
                  <>
                    <div className="flex border-t border-gray-100">
                      {listing.status === 'active' ? (
                        <button
                          onClick={() => setDialog({ type: 'taken', listingId: listing.id, title: `${getTypeName(listing.type, t)} — ${listing.district}` })}
                          disabled={isLoading}
                          className="flex-1 min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-amber-700 active:bg-amber-50 transition-colors"
                        >
                          <i className="ti ti-circle-dot text-base" aria-hidden="true" />
                          {t('my_btn_taken')}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setRemainingNeeded('1')
                            setDialog({ type: 'available', listingId: listing.id, title: `${getTypeName(listing.type, t)} — ${listing.district}`, isMulti: listing.listing_unit_type === 'multi', totalCapacity: listing.total_capacity })
                          }}
                          disabled={isLoading}
                          className="flex-1 min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-primary-600 active:bg-primary-50 transition-colors"
                        >
                          <i className="ti ti-circle-check text-base" aria-hidden="true" />
                          {t('my_btn_available')}
                        </button>
                      )}
                      <div className="w-px bg-gray-100" />
                      <button
                        onClick={() => setBoostListing(listing)}
                        className="flex-1 min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-yellow-600 active:bg-yellow-50 transition-colors"
                      >
                        <i className="ti ti-rocket text-base" aria-hidden="true" />
                        Boost
                      </button>
                      <div className="w-px bg-gray-100" />
                      <button
                        onClick={() => setExpandedAnalytics(expandedAnalytics === listing.id ? null : listing.id)}
                        className={`flex-1 min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                          expandedAnalytics === listing.id
                            ? 'text-primary-600 bg-primary-50'
                            : 'text-gray-500 active:bg-gray-50'
                        }`}
                      >
                        <i className="ti ti-chart-bar text-base" aria-hidden="true" />
                        {t('my_btn_analytics')}
                      </button>
                      <div className="w-px bg-gray-100" />
                      <button
                        onClick={() => setEditListing(listing)}
                        className="flex-1 min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-primary-700 active:bg-primary-50 transition-colors"
                      >
                        <i className="ti ti-bolt text-base" aria-hidden="true" />
                        {t('my_btn_update')}
                      </button>
                    </div>
                    {/* Delete row */}
                    <div className="border-t border-gray-100">
                      <button
                        onClick={() => setDialog({ type: 'delete', listingId: listing.id, title: `${getTypeName(listing.type, t)} — ${listing.district}` })}
                        disabled={isLoading}
                        className="w-full min-h-[40px] flex items-center justify-center gap-1.5 text-[11px] font-medium text-red-400 active:bg-red-50 transition-colors"
                      >
                        <i className="ti ti-trash text-sm" aria-hidden="true" />
                        {t('my_menu_delete')}
                      </button>
                    </div>
                  </>
                )}

                {/* Analytics expand */}
                {expandedAnalytics === listing.id && (
                  <ListingAnalyticsCard listingId={listing.id} />
                )}

                {/* Expired — renew + delete actions */}
                {isExpired && (
                  <div className="px-3 pb-3 flex items-center gap-2">
                    <div className="flex-1">
                      <RenewButton listing={listing} onRenewed={refreshListings} />
                    </div>
                    <button
                      onClick={() => setDialog({ type: 'delete', listingId: listing.id, title: `${getTypeName(listing.type, t)} — ${listing.district}` })}
                      disabled={isLoading}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium text-red-500 border border-red-200 bg-red-50 active:bg-red-100 transition-colors flex-shrink-0"
                    >
                      <i className="ti ti-trash" aria-hidden="true" /> {t('my_menu_delete')}
                    </button>
                  </div>
                )}
              </div>
            )
          })
        ))}
      </div>

      {/* ── Delete error toast ── */}
      {deleteError && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 bg-red-500 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-lg max-w-xs w-[90%]">
          <i className="ti ti-alert-circle flex-shrink-0" aria-hidden="true" />
          <span className="flex-1">{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="flex-shrink-0 ml-1 opacity-70 hover:opacity-100">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* ── Confirmation dialogs ── */}
      {dialog && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setDialog(null)}
        >
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>

            {dialog.type === 'taken' && (
              <>
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2"><i className="ti ti-circle-dot text-4xl text-amber-500" aria-hidden="true" /></div>
                  <h3 className="text-base font-bold text-gray-900">{t('my_dialog_taken_title')}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    <strong>{dialog.title}</strong><br />
                    {t('my_dialog_taken_desc')}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setDialog(null)} className="py-3 rounded-2xl bg-gray-100 text-gray-700 text-sm font-semibold">
                    {t('my_dialog_no')}
                  </button>
                  <button onClick={() => setStatus(dialog.listingId, 'taken')} className="py-3 rounded-2xl bg-amber-500 text-white text-sm font-semibold active:scale-95">
                    {t('my_dialog_yes_taken')}
                  </button>
                </div>
              </>
            )}

            {dialog.type === 'available' && (
              <>
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2"><i className="ti ti-circle-check text-4xl text-primary-500" aria-hidden="true" /></div>
                  <h3 className="text-base font-bold text-gray-900">
                    {dialog.isMulti ? t('my_reactivate_title') : t('my_dialog_avail_title')}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    <strong>{dialog.title}</strong>
                  </p>
                </div>

                {dialog.isMulti ? (
                  <div className="mb-4">
                    <p className="text-sm text-gray-500 mb-3">{t('my_reactivate_desc')}</p>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="500"
                      value={remainingNeeded}
                      onChange={e => setRemainingNeeded(e.target.value)}
                      placeholder="e.g. 3"
                      className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                    <p className="text-xs text-gray-400 text-center mt-1.5">{t('my_reactivate_input')}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center mb-4">{t('my_dialog_avail_desc')}</p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setDialog(null)} className="py-3 rounded-2xl bg-gray-100 text-gray-700 text-sm font-semibold">
                    {t('my_dialog_no')}
                  </button>
                  {dialog.isMulti ? (
                    <button
                      onClick={() => {
                        const n = parseInt(remainingNeeded)
                        if (!n || n < 1) return
                        reactivateMulti(dialog.listingId, n)
                      }}
                      disabled={!parseInt(remainingNeeded) || parseInt(remainingNeeded) < 1}
                      className="py-3 rounded-2xl bg-primary-500 text-white text-sm font-semibold active:scale-95 disabled:opacity-50"
                    >
                      {t('my_reactivate_btn')}
                    </button>
                  ) : (
                    <button onClick={() => setStatus(dialog.listingId, 'active')} className="py-3 rounded-2xl bg-primary-500 text-white text-sm font-semibold active:scale-95">
                      {t('my_dialog_yes_avail')}
                    </button>
                  )}
                </div>
              </>
            )}

            {dialog.type === 'delete' && (
              <>
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2"><i className="ti ti-trash text-4xl text-red-500" aria-hidden="true" /></div>
                  <h3 className="text-base font-bold text-gray-900">{t('my_dialog_del_title')}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    <strong>{dialog.title}</strong><br />
                    {t('my_dialog_del_desc')}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setDialog(null)} className="py-3 rounded-2xl bg-gray-100 text-gray-700 text-sm font-semibold">
                    {t('my_dialog_no')}
                  </button>
                  <button onClick={() => deleteListing(dialog.listingId)} className="py-3 rounded-2xl bg-red-500 text-white text-sm font-semibold active:scale-95">
                    {t('my_dialog_yes_del')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {editListing && (
        <QuickEditModal
          listing={editListing}
          onClose={() => setEditListing(null)}
          onSaved={(updated) => {
            setListings(prev => prev.map(l => l.id === editListing.id ? { ...l, ...updated } : l))
            setEditListing(null)
          }}
        />
      )}

      {boostListing && (
        <BoostModal
          listingId={boostListing.id}
          listingTitle={`${getTypeName(boostListing.type, t)} — ${boostListing.district}`}
          isCurrentlyBoosted={boostListing.is_boosted}
          boostedUntil={boostListing.boosted_until}
          onClose={() => setBoostListing(null)}
          onBoosted={(boostedUntil) => {
            setListings(prev => prev.map(l =>
              l.id === boostListing.id ? { ...l, is_boosted: true, boosted_until: boostedUntil } : l
            ))
            setBoostListing(null)
          }}
        />
      )}

      {/* Auto-renewal modal triggered by ?renew= from notification tap */}
      {autoRenewListing && (
        <RenewButton
          listing={autoRenewListing}
          onRenewed={() => { setAutoRenewListing(null); refreshListings() }}
          autoOpen
        />
      )}
    </div>
  )
}
