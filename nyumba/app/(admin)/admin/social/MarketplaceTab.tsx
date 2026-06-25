'use client'
import { useState, useEffect, useCallback } from 'react'

type MarketplaceStats = {
  totalActive:      number
  totalPosted:      number
  totalFailed:      number
  totalViews:       number
  totalInquiries:   number
  catalogConfigured: boolean
  recentListings:   MarketplaceListing[]
}

type MarketplaceListing = {
  id:                  string
  listing_id:          string
  status:              string
  availability:        string
  price_tzs:           number | null
  title:               string | null
  location:            string | null
  views:               number
  inquiries:           number
  marketplace_item_id: string | null
  error_message:       string | null
  posted_at:           string | null
  expires_at:          string | null
  listings?: { title: string; district: string; region: string; images: string[] } | null
}

type Inquiry = {
  id:          string
  listing_id:  string | null
  sender_name: string | null
  message:     string
  replied:     boolean
  created_at:  string
  listings?: { title: string; district: string; region: string } | null
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:  'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    failed:  'bg-red-100 text-red-700',
    sold:    'bg-gray-100 text-gray-500',
    deleted: 'bg-gray-100 text-gray-400',
    expired: 'bg-orange-100 text-orange-600',
  }
  const labels: Record<string, string> = {
    active: 'Active', pending: 'Inasubiri', failed: 'Imeshindwa',
    sold: 'Imepangwa', deleted: 'Imefutwa', expired: 'Imekwisha',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {labels[status] ?? status}
    </span>
  )
}

function SetupGuide() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">⚠️</span>
        <h3 className="font-semibold text-amber-800">Marketplace Haijawekwa</h3>
      </div>
      <p className="text-sm text-amber-700 mb-4">Fuata hatua hizi ili kuanzisha Facebook Marketplace:</p>
      <ol className="space-y-3 text-sm text-amber-800">
        <li className="flex gap-2">
          <span className="font-bold w-5 flex-shrink-0">1.</span>
          <span>Nenda <strong>Commerce Manager:</strong> <code className="bg-amber-100 px-1 rounded text-xs">business.facebook.com/commerce</code></span>
        </li>
        <li className="flex gap-2">
          <span className="font-bold w-5 flex-shrink-0">2.</span>
          <span>Unda Catalog mpya: Aina → <strong>&ldquo;Homes for sale or rent&rdquo;</strong>, Jina → &ldquo;NyumbaFasta Listings&rdquo;</span>
        </li>
        <li className="flex gap-2">
          <span className="font-bold w-5 flex-shrink-0">3.</span>
          <span>Copy <strong>Catalog ID</strong> kutoka Commerce Manager</span>
        </li>
        <li className="flex gap-2">
          <span className="font-bold w-5 flex-shrink-0">4.</span>
          <span>Weka kwenye Vercel env vars: <code className="bg-amber-100 px-1 rounded text-xs">FACEBOOK_CATALOG_ID=xxxxxxxx</code></span>
        </li>
        <li className="flex gap-2">
          <span className="font-bold w-5 flex-shrink-0">5.</span>
          <span>Kwenye Meta Developer Console: ongeza permission <code className="bg-amber-100 px-1 rounded text-xs">catalog_management</code></span>
        </li>
        <li className="flex gap-2">
          <span className="font-bold w-5 flex-shrink-0">6.</span>
          <span>Rudi hapa na bonyeza <strong>&ldquo;Sync Listings Zote&rdquo;</strong></span>
        </li>
      </ol>
    </div>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

type InnerTab = 'listings' | 'inquiries'

export default function MarketplaceTab() {
  const [innerTab, setInnerTab]   = useState<InnerTab>('listings')
  const [stats, setStats]         = useState<MarketplaceStats | null>(null)
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading]     = useState(false)
  const [syncing, setSyncing]     = useState(false)
  const [toast, setToast]         = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 5000)
  }

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/v1/social/marketplace')
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        showToast(`Hitilafu: ${err.error ?? res.status}`)
        return
      }
      const data = await res.json() as MarketplaceStats
      setStats(data)
    } catch {
      showToast('Imeshindwa kupakia takwimu za Marketplace')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadInquiries = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/v1/social/marketplace/inquiries')
      const data = await res.json() as { inquiries: Inquiry[] }
      setInquiries(data.inquiries ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (innerTab === 'listings') loadStats()
    else loadInquiries()
  }, [innerTab, loadStats, loadInquiries])

  async function handleSync() {
    setSyncing(true)
    try {
      const res  = await fetch('/api/v1/social/marketplace/sync', { method: 'POST' })
      const data = await res.json() as { posted?: number; failed?: number; skipped?: number; error?: string; message?: string }
      if (!res.ok || data.error) {
        showToast(`Hitilafu: ${data.error ?? `HTTP ${res.status}`}`)
        return
      }
      showToast(`Sync imekamilika! ✅ Zimewekwa: ${data.posted ?? 0} | ❌ Zimeshindwa: ${data.failed ?? 0} | ⏭️ Zimerukwa: ${data.skipped ?? 0}`)
      loadStats()
    } catch (e) {
      showToast(`Hitilafu ya mtandao: ${String(e)}`)
    } finally {
      setSyncing(false)
    }
  }

  async function handleRemove(listingId: string) {
    if (!confirm('Unahakika unataka kufuta listing hii kutoka Marketplace?')) return
    const res  = await fetch(`/api/v1/social/marketplace/${listingId}`, { method: 'DELETE' })
    const data = await res.json() as { ok?: boolean; error?: string }
    showToast(data.ok ? 'Imefutwa kutoka Marketplace' : `Hitilafu: ${data.error}`)
    if (data.ok) loadStats()
  }

  async function handleMarkTaken(listingId: string) {
    const res  = await fetch(`/api/v1/social/marketplace/${listingId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ availability: 'OUT_OF_STOCK' }),
    })
    const data = await res.json() as { ok?: boolean; error?: string }
    showToast(data.ok ? 'Imewekwa kama "Imepangwa" kwenye Marketplace' : `Hitilafu: ${data.error}`)
    if (data.ok) loadStats()
  }

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm max-w-sm">
          {toast}
        </div>
      )}

      {/* Inner tabs */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setInnerTab('listings')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              innerTab === 'listings' ? 'bg-[#1D9E75] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            🏠 Listings
          </button>
          <button
            onClick={() => setInnerTab('inquiries')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              innerTab === 'inquiries' ? 'bg-[#1D9E75] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            💬 Maswali
          </button>
        </div>

        {innerTab === 'listings' && (
          <div className="flex gap-2">
            <button
              onClick={loadStats}
              disabled={loading}
              className="px-3 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              🔄 Onyesha Upya
            </button>
            <button
              onClick={handleSync}
              disabled={syncing || !stats?.catalogConfigured}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {syncing ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Inasync...
                </>
              ) : (
                '🔄 Sync Listings Zote'
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── LISTINGS TAB ── */}
      {innerTab === 'listings' && (
        <div>
          {/* Setup guide if catalog not configured */}
          {stats && !stats.catalogConfigured && <SetupGuide />}

          {/* Stats cards */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
              {[
                { label: 'Active',       value: stats.totalActive,    emoji: '✅', color: 'text-green-600'  },
                { label: 'Zimewekwa',    value: stats.totalPosted,    emoji: '📦', color: 'text-blue-600'   },
                { label: 'Zimeshindwa', value: stats.totalFailed,    emoji: '❌', color: 'text-red-600'    },
                { label: 'Imeonekana',   value: stats.totalViews,     emoji: '👁️', color: 'text-purple-600' },
                { label: 'Maswali',      value: stats.totalInquiries, emoji: '💬', color: 'text-orange-600' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-xl mb-1">{c.emoji}</div>
                  <div className={`text-2xl font-bold ${c.color}`}>{c.value.toLocaleString()}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{c.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Listings */}
          {loading && !stats ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(stats?.recentListings ?? []).map(item => (
                <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start gap-3">
                    {/* Thumbnail */}
                    {item.listings?.images?.[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.listings.images[0]}
                        alt=""
                        className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <StatusBadge status={item.status} />
                        {item.availability === 'OUT_OF_STOCK' && (
                          <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">Imepangwa</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {item.title ?? item.listings?.title ?? '—'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.location ?? `${item.listings?.district}, ${item.listings?.region}`}
                        {item.price_tzs ? ` • TZS ${item.price_tzs.toLocaleString('sw-TZ')}/mwezi` : ''}
                      </p>
                      <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
                        <span>👁️ {item.views} waliotazama</span>
                        <span>💬 {item.inquiries} maswali</span>
                        {item.posted_at && <span>📅 {fmtDate(item.posted_at)}</span>}
                        {item.expires_at && <span>⏳ Inaisha: {fmtDate(item.expires_at)}</span>}
                      </div>
                      {item.error_message && (
                        <p className="text-xs text-red-600 mt-1">❌ {item.error_message}</p>
                      )}
                    </div>
                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      {item.status === 'active' && item.availability === 'IN_STOCK' && (
                        <button
                          onClick={() => handleMarkTaken(item.listing_id)}
                          className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 whitespace-nowrap"
                        >
                          Imepangwa
                        </button>
                      )}
                      {item.marketplace_item_id && (
                        <a
                          href={`https://www.facebook.com/marketplace/item/${item.marketplace_item_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2.5 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 whitespace-nowrap text-center"
                        >
                          Angalia FB ↗
                        </a>
                      )}
                      <button
                        onClick={() => handleRemove(item.listing_id)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-red-100 text-red-600 hover:bg-red-50"
                      >
                        Futa
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!loading && (stats?.recentListings ?? []).length === 0 && (
                <div className="text-center py-16 text-gray-400">
                  <div className="text-4xl mb-3">🛒</div>
                  <p>Hakuna listings kwenye Marketplace bado</p>
                  {stats?.catalogConfigured ? (
                    <p className="text-sm mt-1">Bonyeza &ldquo;Sync Listings Zote&rdquo; kuanza</p>
                  ) : (
                    <p className="text-sm mt-1">Fuata hatua za setup hapo juu kwanza</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── INQUIRIES TAB ── */}
      {innerTab === 'inquiries' && (
        <div>
          <p className="text-sm text-gray-500 mb-4">Maswali kutoka Facebook Marketplace: {inquiries.length}</p>
          <div className="space-y-3">
            {inquiries.map(inq => (
              <div key={inq.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {inq.replied ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Amejibiwa</span>
                      ) : (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Hajajibiwa</span>
                      )}
                      <span className="text-xs text-gray-400">{fmtDate(inq.created_at)}</span>
                    </div>
                    {inq.listings && (
                      <p className="text-xs font-medium text-gray-500 mb-1">
                        🏠 {inq.listings.title} — {inq.listings.district}
                      </p>
                    )}
                    {inq.sender_name && (
                      <p className="text-xs text-gray-500">Kutoka: {inq.sender_name}</p>
                    )}
                    <p className="text-sm text-gray-800 mt-1">{inq.message}</p>
                  </div>
                </div>
              </div>
            ))}
            {!loading && inquiries.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <div className="text-4xl mb-3">💬</div>
                <p>Hakuna maswali bado</p>
                <p className="text-sm mt-1">Maswali ya Marketplace yataonekana hapa mara wateja watakapouliza</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
