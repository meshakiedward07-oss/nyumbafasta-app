'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import DalaliBottomNav from '@/components/shared/DalaliBottomNav'
import ShareButton from '@/components/shared/ShareButton'
import BoostModal from '@/components/dalali/BoostModal'
import type { Listing } from '@/lib/types/database'

const STATUS: Record<string, { label: string; cls: string }> = {
  active:   { label: 'Inapatikana',  cls: 'bg-primary-50 text-primary-700' },
  pending:  { label: 'Inasubiri',    cls: 'bg-blue-50 text-blue-700' },
  taken:    { label: 'Imepangishwa', cls: 'bg-amber-50 text-amber-700' },
  expired:  { label: 'Imeisha',      cls: 'bg-gray-100 text-gray-500' },
  rejected: { label: 'Ilikataliwa',  cls: 'bg-red-50 text-red-600' },
}

const TYPE: Record<string, string> = {
  chumba: 'Chumba', apartment: 'Apartment', nyumba: 'Nyumba', studio: 'Studio', duka: 'Duka',
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
  if (status === 'expired') {
    return (
      <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-medium">
        ❌ Imekwisha
      </span>
    )
  }
  if (!expiresAt) return null
  const days = daysLeft(expiresAt)
  if (days <= 7) return (
    <span suppressHydrationWarning className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-medium animate-pulse">
      🔴 Siku {days} tu!
    </span>
  )
  if (days <= 14) return (
    <span suppressHydrationWarning className="bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full font-medium">
      ⚠️ Siku {days}
    </span>
  )
  if (days <= 30) return (
    <span suppressHydrationWarning className="bg-yellow-100 text-yellow-600 text-xs px-2 py-0.5 rounded-full font-medium">
      ⏰ Siku {days}
    </span>
  )
  return (
    <span suppressHydrationWarning className="bg-green-100 text-green-600 text-xs px-2 py-0.5 rounded-full">
      ✅ Siku {days}
    </span>
  )
}

// ── Renew Button ──────────────────────────────────────────
function RenewButton({ listing, onRenewed }: { listing: Listing; onRenewed: () => void }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const days = daysLeft(listing.expires_at)
  const needsRenewal = days <= 14 || listing.status === 'expired'
  if (!needsRenewal) return null

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
      onRenewed()
      alert(`✅ Listing "${listing.title || `${TYPE[listing.type]} — ${listing.district}`}" imehuishwa kwa siku 90!`)
    } catch (err) {
      alert('Kosa: ' + String(err))
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
        🔄 Huisha
      </button>

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
            <h3 className="font-bold text-lg mb-2">🔄 Huisha Listing</h3>

            {/* Listing preview */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="font-medium text-sm">
                {listing.title || `${TYPE[listing.type] || listing.type} — ${listing.district}`}
              </p>
              <p className="text-gray-500 text-xs mt-0.5">📍 {listing.district}, {listing.region}</p>
              <p className="text-[#1D9E75] font-semibold text-sm mt-1">
                Tsh {listing.price_monthly?.toLocaleString()}/mwezi
              </p>
            </div>

            {/* Info */}
            <div className="space-y-2 mb-4">
              {[
                'Picha na maelezo yanabaki kama yalivyo',
                'Bei inabaki kama ilivyo',
                'Itaonekana kwa wateja kwa siku 90 zaidi',
              ].map(txt => (
                <div key={txt} className="flex items-center gap-2 text-sm">
                  <span className="text-green-500">✓</span>
                  <span className="text-gray-600">{txt}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-blue-500">ℹ️</span>
                <span className="text-gray-600">Hii ni bure — inahuisha muda tu</span>
              </div>
            </div>

            {/* New expiry */}
            <div suppressHydrationWarning className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-center">
              <p className="text-green-700 text-sm font-medium">Baada ya kuhuisha:</p>
              <p className="text-green-600 text-xs mt-0.5">Itaisha {renewDate}</p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium"
              >
                Ghairi
              </button>
              <button
                onClick={handleRenew}
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-[#1D9E75] text-white text-sm font-bold disabled:opacity-50"
              >
                {loading ? 'Inahuisha...' : '✅ Huisha Sasa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Dialog type ───────────────────────────────────────────
type Dialog = { type: 'taken' | 'available' | 'delete'; listingId: string; title: string }
type Tab = 'all' | 'active' | 'expired'

// ── Main component ────────────────────────────────────────
export default function MyListingsClient({ listings: initial }: { listings: Listing[] }) {
  const [listings, setListings] = useState(initial)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [boostListing, setBoostListing] = useState<Listing | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  async function setStatus(id: string, status: 'active' | 'taken') {
    setLoading(id)
    setDialog(null)
    try {
      await fetch(`/api/v1/listings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_status', status }),
      })
      setListings(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    } finally {
      setLoading(null)
    }
  }

  async function deleteListing(id: string) {
    setLoading(id)
    setDialog(null)
    try {
      await fetch(`/api/v1/listings/${id}`, { method: 'DELETE' })
      setListings(prev => prev.filter(l => l.id !== id))
    } finally {
      setLoading(null)
    }
  }

  function refreshListings() {
    window.location.reload()
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
      <div className="bg-primary-500 px-4 pt-10 pb-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-white text-lg font-bold">Listings Zangu</h1>
            <p className="text-green-100 text-xs">
              {listings.length} jumla · {activeCount} zinafanya kazi · {pendingCount} zinasubiri
            </p>
          </div>
          <Link
            href="/dashboard/listings/new"
            className="flex items-center gap-1 bg-white text-primary-600 text-xs font-semibold px-3 py-2 rounded-full"
          >
            ➕ Ongeza
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {([
            { key: 'all', label: `Zote (${listings.length})` },
            { key: 'active', label: `Zinafanya kazi (${activeCount + pendingCount})` },
            { key: 'expired', label: `❌ Zilizokwisha (${expiredCount})` },
          ] as { key: Tab; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                tab === t.key
                  ? 'bg-white text-primary-700'
                  : 'bg-white/20 text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {displayed.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            {tab === 'expired' ? (
              <>
                <div className="text-5xl mb-3">✅</div>
                <p className="text-sm text-gray-600 font-medium">Hakuna listings zilizokwisha</p>
                <p className="text-xs text-gray-400 mt-1">Vizuri sana — listings zako ziko active!</p>
              </>
            ) : (
              <>
                <div className="text-5xl mb-3">🏘</div>
                <p className="text-sm text-gray-600 font-medium mb-1">Bado hujaweka listing yoyote</p>
                <p className="text-xs text-gray-400 mb-5">Anza sasa — wateja wanangoja!</p>
                <Link
                  href="/dashboard/listings/new"
                  className="inline-block bg-primary-500 text-white text-sm font-semibold px-6 py-3 rounded-2xl"
                >
                  ➕ Ongeza Listing ya Kwanza
                </Link>
              </>
            )}
          </div>
        ) : (
          displayed.map(listing => {
            const cfg = STATUS[listing.status] ?? { label: listing.status, cls: 'bg-gray-100 text-gray-500' }
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
                    <p className="text-red-600 text-xs font-medium">❌ Imekwisha — haionekani kwa wateja</p>
                    <RenewButton listing={listing} onRenewed={refreshListings} />
                  </div>
                )}

                {/* Card body */}
                <div className="flex gap-3 p-3">
                  <div className="relative w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                    {listing.images?.[0] ? (
                      <Image fill src={listing.images[0]} alt="" className="object-cover" sizes="64px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl text-gray-300">🏠</div>
                    )}
                    {listing.status === 'taken' && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold">TAKEN</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {TYPE[listing.type] || listing.type} — {listing.district}
                      </p>
                      {/* ⋮ dots menu */}
                      <div className="relative flex-shrink-0" ref={openMenu === listing.id ? menuRef : undefined}>
                        <button
                          onClick={() => setOpenMenu(openMenu === listing.id ? null : listing.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors"
                        >
                          ⋮
                        </button>

                        {openMenu === listing.id && (
                          <div className="absolute right-0 top-8 z-30 bg-white rounded-2xl shadow-lg border border-gray-100 py-1 min-w-[180px]">
                            <Link
                              href={`/listings/${listing.id}`}
                              onClick={() => setOpenMenu(null)}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <span>👁️</span> Angalia
                            </Link>
                            <Link
                              href={`/listings/${listing.id}/edit`}
                              onClick={() => setOpenMenu(null)}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <span>✏️</span> Hariri
                            </Link>

                            {listing.status === 'active' && (
                              <button
                                onClick={() => {
                                  setOpenMenu(null)
                                  setDialog({ type: 'taken', listingId: listing.id, title: `${TYPE[listing.type]} — ${listing.district}` })
                                }}
                                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-amber-700 hover:bg-amber-50 w-full text-left"
                              >
                                <span>🔴</span> Imepangishwa
                              </button>
                            )}

                            {listing.status === 'taken' && (
                              <button
                                onClick={() => {
                                  setOpenMenu(null)
                                  setDialog({ type: 'available', listingId: listing.id, title: `${TYPE[listing.type]} — ${listing.district}` })
                                }}
                                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-primary-700 hover:bg-primary-50 w-full text-left"
                              >
                                <span>✅</span> Inapatikana tena
                              </button>
                            )}

                            <div className="border-t border-gray-50 mt-1 pt-1">
                              <button
                                onClick={() => {
                                  setOpenMenu(null)
                                  setDialog({ type: 'delete', listingId: listing.id, title: `${TYPE[listing.type]} — ${listing.district}` })
                                }}
                                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 w-full text-left"
                              >
                                <span>🗑️</span> Futa
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
                      Tsh {fmt(listing.price_monthly)} / mwezi
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                      <span>👁 {listing.view_count ?? 0}</span>
                      <span>🔗 {listing.share_count ?? 0}</span>
                      <span>📞 {listing.lead_count ?? 0}</span>
                      {listing.is_boosted && (
                        <span className="text-yellow-600 font-semibold" suppressHydrationWarning>
                          🚀 Boosted
                        </span>
                      )}
                    </div>

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
                  <div className="flex border-t border-gray-50">
                    {listing.status === 'active' ? (
                      <button
                        onClick={() => setDialog({ type: 'taken', listingId: listing.id, title: `${TYPE[listing.type]} — ${listing.district}` })}
                        disabled={isLoading}
                        className="flex-1 py-2.5 text-xs font-medium text-amber-700 active:bg-amber-50 transition-colors"
                      >
                        🔴 Imepangishwa
                      </button>
                    ) : (
                      <button
                        onClick={() => setDialog({ type: 'available', listingId: listing.id, title: `${TYPE[listing.type]} — ${listing.district}` })}
                        disabled={isLoading}
                        className="flex-1 py-2.5 text-xs font-medium text-primary-600 active:bg-primary-50 transition-colors"
                      >
                        ✅ Inapatikana tena
                      </button>
                    )}
                    <div className="w-px bg-gray-50" />
                    <button
                      onClick={() => setBoostListing(listing)}
                      className="flex-1 py-2.5 text-xs font-semibold text-yellow-500 active:bg-yellow-50 transition-colors"
                    >
                      🚀 Boost
                    </button>
                    <div className="w-px bg-gray-50" />
                    <ShareButton
                      listing={listing}
                      variant="dashboard"
                      className="flex-1 justify-center rounded-none bg-transparent hover:bg-green-50 py-2.5 px-0"
                    />
                    <div className="w-px bg-gray-50" />
                    <Link
                      href={`/listings/${listing.id}/edit`}
                      className="flex-1 py-2.5 text-center text-xs font-medium text-gray-600 active:bg-gray-50 transition-colors"
                    >
                      ✏️ Hariri
                    </Link>
                  </div>
                )}

                {/* Expired — full-width renew CTA */}
                {isExpired && (
                  <div className="px-3 pb-3">
                    <RenewButton listing={listing} onRenewed={refreshListings} />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

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
                  <div className="text-4xl mb-2">🔴</div>
                  <h3 className="text-base font-bold text-gray-900">Imepangishwa?</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    <strong>{dialog.title}</strong><br />
                    Listing haitaonekana tena kwa wateja. Wateja walioisave wataarifiwa.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setDialog(null)} className="py-3 rounded-2xl bg-gray-100 text-gray-700 text-sm font-semibold">
                    Hapana
                  </button>
                  <button onClick={() => setStatus(dialog.listingId, 'taken')} className="py-3 rounded-2xl bg-amber-500 text-white text-sm font-semibold active:scale-95">
                    Ndiyo, imepangishwa
                  </button>
                </div>
              </>
            )}

            {dialog.type === 'available' && (
              <>
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">✅</div>
                  <h3 className="text-base font-bold text-gray-900">Rudisha listing?</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    <strong>{dialog.title}</strong><br />
                    Listing itaonekana tena kwa wateja.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setDialog(null)} className="py-3 rounded-2xl bg-gray-100 text-gray-700 text-sm font-semibold">
                    Hapana
                  </button>
                  <button onClick={() => setStatus(dialog.listingId, 'active')} className="py-3 rounded-2xl bg-primary-500 text-white text-sm font-semibold active:scale-95">
                    Ndiyo, rudisha
                  </button>
                </div>
              </>
            )}

            {dialog.type === 'delete' && (
              <>
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">🗑️</div>
                  <h3 className="text-base font-bold text-gray-900">Futa listing?</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    <strong>{dialog.title}</strong><br />
                    Listing haitaonekana tena. Hatua hii haiwezi kutenduliwa.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setDialog(null)} className="py-3 rounded-2xl bg-gray-100 text-gray-700 text-sm font-semibold">
                    Hapana
                  </button>
                  <button onClick={() => deleteListing(dialog.listingId)} className="py-3 rounded-2xl bg-red-500 text-white text-sm font-semibold active:scale-95">
                    Ndiyo, futa
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <DalaliBottomNav />

      {boostListing && (
        <BoostModal
          listingId={boostListing.id}
          listingTitle={`${TYPE[boostListing.type] || boostListing.type} — ${boostListing.district}`}
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
    </div>
  )
}
