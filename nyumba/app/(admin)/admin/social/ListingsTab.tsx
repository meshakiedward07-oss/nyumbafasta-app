'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { PlatformLogo } from '@/components/shared/PlatformLogo'
import PostEditorDrawer from './PostEditorDrawer'

type SocialStatus = { instagram: string | null; facebook: string | null; tiktok: string | null }

type SocialListing = {
  id: string; title: string; type: string; district: string; region: string
  price_monthly: number; images: string[]; video_url: string | null
  bedrooms: number | null; furnished: string; is_boosted: boolean
  created_at: string; social: SocialStatus
}

type EditorState = { listing: SocialListing; platform: string } | null

type BatchPlatform = 'both' | 'instagram' | 'facebook'

type BatchItem = {
  listing: SocialListing
  status: 'pending' | 'posting' | 'done' | 'failed'
  error?: string
}

type Props = {
  showToast: (msg: string) => void
  onOpenFull: (listingId: string) => void
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'leo'
  if (days === 1) return 'jana'
  if (days < 7)  return `siku ${days}`
  return `wiki ${Math.floor(days / 7)}`
}

function PlatformBadge({ platform, posted, date }: { platform: string; posted: boolean; date: string | null }) {
  return (
    <span title={posted ? `Mwisho: ${timeAgo(date)}` : `Haijachapishwa`}
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${
        posted ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'
      }`}>
      <PlatformLogo platform={platform} size={11} />
      {posted ? timeAgo(date) : '—'}
    </span>
  )
}

// ── Batch Progress Modal ──────────────────────────────────────────────────────
function BatchModal({
  items, platform, done, onClose,
}: {
  items: BatchItem[]; platform: BatchPlatform; done: boolean; onClose: () => void
}) {
  const total    = items.length
  const finished = items.filter(i => i.status === 'done' || i.status === 'failed').length
  const success  = items.filter(i => i.status === 'done').length
  const pct      = total ? Math.round((finished / total) * 100) : 0

  const platformLabel: Record<BatchPlatform, string> = {
    both: 'IG + FB', instagram: 'Instagram', facebook: 'Facebook',
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between mb-1">
            <p className="font-semibold text-gray-800">
              {done ? `Imekamilika — ${success}/${total} imechapishwa` : `Inachapisha kwa ${platformLabel[platform]}…`}
            </p>
            {done && (
              <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
                <i className="ti ti-x text-gray-500" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${done && success < total ? 'bg-amber-400' : 'bg-primary-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{pct}% · {finished}/{total}</p>
        </div>

        {/* Item list */}
        <div className="px-5 pb-4 max-h-64 overflow-y-auto space-y-2">
          {items.map(item => (
            <div key={item.listing.id} className="flex items-center gap-3">
              <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                {item.status === 'done'    && <i className="ti ti-circle-check text-green-500 text-lg" aria-hidden="true" />}
                {item.status === 'failed'  && <i className="ti ti-circle-x text-red-400 text-lg" aria-hidden="true" />}
                {item.status === 'posting' && <i className="ti ti-loader-2 animate-spin text-primary-500 text-lg" aria-hidden="true" />}
                {item.status === 'pending' && <i className="ti ti-circle-dashed text-gray-300 text-lg" aria-hidden="true" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${item.status === 'pending' ? 'text-gray-400' : 'text-gray-800'}`}>
                  {item.listing.title}
                </p>
                {item.error && <p className="text-[11px] text-red-400 truncate">{item.error}</p>}
              </div>
              <span className="text-[10px] text-gray-400 flex-shrink-0">
                {item.listing.district}
              </span>
            </div>
          ))}
        </div>

        {done && (
          <div className="px-5 pb-5">
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600">
              Sawa
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
type Filter = 'all' | 'unposted' | 'posted'

export default function ListingsTab({ showToast, onOpenFull }: Props) {
  const [listings,  setListings]  = useState<SocialListing[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState<Filter>('all')
  const [search,    setSearch]    = useState('')
  const [editor,    setEditor]    = useState<EditorState>(null)

  // Multi-select
  const [selected,  setSelected]  = useState<Set<string>>(new Set())
  const [batchPlat, setBatchPlat] = useState<BatchPlatform>('both')

  // Batch posting
  const [batchItems,  setBatchItems]  = useState<BatchItem[] | null>(null)
  const [batchDone,   setBatchDone]   = useState(false)
  const abortRef = useRef(false)

  const fetchListings = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/v1/social/listings')
      const data = await res.json() as { listings?: SocialListing[] }
      setListings(data.listings ?? [])
    } catch { showToast('Imeshindwa kupakia listings') }
    finally { setLoading(false) }
  }, [showToast])

  useEffect(() => { fetchListings() }, [fetchListings])

  // ── Selection helpers ───────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) { n.delete(id) } else { n.add(id) }
      return n
    })
  }

  function selectAll() {
    setSelected(new Set(filtered.map(l => l.id)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  // ── Single listing post (via API, no editor) ────────────────────────────────
  async function quickPost(listingId: string, platform: BatchPlatform): Promise<{ ok: boolean; error?: string }> {
    const res  = await fetch('/api/v1/social/post', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, platform }),
    })
    const body = await res.text()
    let data: { status?: string; error?: string } = {}
    try { data = JSON.parse(body) } catch { /* ignore */ }
    if (data.status === 'published') return { ok: true }
    return { ok: false, error: data.error ?? `HTTP ${res.status}` }
  }

  // ── Batch post runner ────────────────────────────────────────────────────────
  async function startBatchPost() {
    const toPost = filtered.filter(l => selected.has(l.id))
    if (!toPost.length) return

    abortRef.current = false
    const items: BatchItem[] = toPost.map(l => ({ listing: l, status: 'pending' }))
    setBatchItems([...items])
    setBatchDone(false)

    for (let i = 0; i < items.length; i++) {
      if (abortRef.current) break

      // Mark as posting
      items[i] = { ...items[i], status: 'posting' }
      setBatchItems([...items])

      const result = await quickPost(items[i].listing.id, batchPlat)

      items[i] = {
        ...items[i],
        status: result.ok ? 'done' : 'failed',
        error:  result.error,
      }
      setBatchItems([...items])

      // Small delay between posts to respect rate limits
      if (i < items.length - 1 && !abortRef.current) {
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    setBatchDone(true)
    clearSelection()
    await fetchListings()
  }

  function closeBatchModal() {
    abortRef.current = true
    setBatchItems(null)
    setBatchDone(false)
  }

  // ── Filtered listings ───────────────────────────────────────────────────────
  const filtered = listings.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      l.title.toLowerCase().includes(q) ||
      l.district.toLowerCase().includes(q) ||
      l.region.toLowerCase().includes(q)
    const hasPost = !!(l.social.instagram || l.social.facebook || l.social.tiktok)
    const matchFilter = filter === 'all' ? true : filter === 'posted' ? hasPost : !hasPost
    return matchSearch && matchFilter
  })

  const unpostedCount = listings.filter(l => !l.social.instagram && !l.social.facebook && !l.social.tiktok).length
  const selectedCount = selected.size

  const typeLabel: Record<string, string> = {
    chumba: 'Chumba', apartment: 'Apartment', nyumba: 'Nyumba', studio: 'Studio', duka: 'Duka',
  }

  return (
    <>
    <div className="space-y-4 pb-24">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-semibold text-lg text-gray-900">Listings Library</h2>
          <p className="text-sm text-gray-500">
            {listings.length} active
            {unpostedCount > 0 && <> · <span className="text-amber-600 font-medium">{unpostedCount} haziajchapishwa</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 ? (
            <button onClick={clearSelection} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <i className="ti ti-x text-sm" aria-hidden="true" /> Ghairi
            </button>
          ) : (
            <button onClick={selectAll} className="text-xs text-primary-600 font-medium hover:text-primary-700 flex items-center gap-1">
              <i className="ti ti-checks text-sm" aria-hidden="true" /> Chagua Zote
            </button>
          )}
          <button onClick={fetchListings} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
            <i className={`ti ti-refresh ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── Search + filter ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" aria-hidden="true" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tafuta listing..."
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'unposted', 'posted'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                filter === f ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}>
              {f === 'all' ? 'Zote' : f === 'unposted' ? 'Hazijachapishwa' : 'Imechapishwa'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Listing grid ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 h-64 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
          <i className="ti ti-photo-off text-4xl text-gray-300" aria-hidden="true" />
          <p className="text-sm text-gray-500 mt-3 font-medium">
            {search ? 'Hakuna listings zinazofanana na utafutaji wako' : 'Hakuna listings'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(listing => {
            const cover      = listing.images?.[0]
            const neverPosted = !listing.social.instagram && !listing.social.facebook && !listing.social.tiktok
            const isSelected  = selected.has(listing.id)

            return (
              <div key={listing.id}
                className={`bg-white rounded-xl border overflow-hidden flex flex-col transition-all hover:shadow-md cursor-pointer ${
                  isSelected ? 'border-primary-400 ring-2 ring-primary-200' :
                  neverPosted ? 'border-amber-200' : 'border-gray-100'
                }`}
              >
                {/* Cover image — click to select */}
                <div className="relative h-36 bg-gray-100 flex-shrink-0" onClick={() => toggleSelect(listing.id)}>
                  {cover ? (
                    <Image fill src={cover} alt={listing.title} className="object-cover" sizes="400px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <i className="ti ti-home text-4xl text-gray-300" aria-hidden="true" />
                    </div>
                  )}

                  {/* Checkbox overlay */}
                  <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center transition-all shadow ${
                    isSelected ? 'bg-primary-500' : 'bg-white/90 border border-gray-300'
                  }`}>
                    {isSelected && <i className="ti ti-check text-white text-xs" aria-hidden="true" />}
                  </div>

                  {/* Type badge */}
                  <span className="absolute top-2 right-2 bg-primary-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    {typeLabel[listing.type] ?? listing.type}
                  </span>

                  {listing.video_url && (
                    <span className="absolute bottom-8 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <i className="ti ti-video text-xs" aria-hidden="true" /> Video
                    </span>
                  )}

                  {neverPosted && (
                    <div className="absolute bottom-0 left-0 right-0 bg-amber-400/90 text-white text-[10px] font-semibold text-center py-0.5 tracking-wide">
                      <i className="ti ti-alert-triangle text-xs" aria-hidden="true" /> HAIJACHAPISHWA
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 flex-1 flex flex-col gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 line-clamp-1">{listing.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <i className="ti ti-map-pin text-xs" aria-hidden="true" />
                      {listing.district}, {listing.region}
                    </p>
                    <p className="text-xs font-bold text-primary-600 mt-0.5">
                      Tsh {listing.price_monthly.toLocaleString()}/mwezi
                      {listing.bedrooms ? <span className="text-gray-400 font-normal"> · {listing.bedrooms} vyumba</span> : null}
                    </p>
                  </div>

                  {/* Platform badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <PlatformBadge platform="instagram" posted={!!listing.social.instagram} date={listing.social.instagram} />
                    <PlatformBadge platform="facebook"  posted={!!listing.social.facebook}  date={listing.social.facebook}  />
                    <PlatformBadge platform="tiktok"    posted={!!listing.social.tiktok}    date={listing.social.tiktok}    />
                  </div>

                  {/* Actions — show only when NOT in batch select or individual card */}
                  <div className="flex gap-1.5 mt-auto pt-1">
                    {/* Main: open editor */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditor({ listing, platform: 'both' }) }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-primary-500 text-white hover:bg-primary-600 transition-all active:scale-95"
                    >
                      <i className="ti ti-edit text-sm" aria-hidden="true" /> Hariri &amp; Chapisha
                    </button>

                    {/* More options */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenFull(listing.id) }}
                      title="Chaguo zaidi"
                      className="px-2.5 py-2 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all"
                    >
                      <i className="ti ti-dots" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>

    {/* ── Batch Action Bar ─────────────────────────────────────────────────────── */}
    {selectedCount > 0 && !batchItems && (
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-2xl px-4 py-3">
        <div className="max-w-2xl mx-auto flex flex-col gap-3">
          {/* Count + platform selector */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-primary-500 text-white text-xs font-bold rounded-full mr-2">
                {selectedCount}
              </span>
              listing {selectedCount === 1 ? 'imechaguliwa' : 'zimechaguliwa'}
            </p>
            <button onClick={clearSelection} className="text-xs text-gray-400 hover:text-gray-600">
              Ghairi
            </button>
          </div>

          <div className="flex gap-2">
            {/* Platform tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">
              {([
                { val: 'both',      label: 'IG+FB' },
                { val: 'instagram', label: 'IG'    },
                { val: 'facebook',  label: 'FB'    },
              ] as { val: BatchPlatform; label: string }[]).map(({ val, label }) => (
                <button key={val} onClick={() => setBatchPlat(val)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    batchPlat === val ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Post button */}
            <button
              onClick={startBatchPost}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-all active:scale-[0.98]"
            >
              <i className="ti ti-send text-sm" aria-hidden="true" />
              Chapisha {selectedCount > 1 ? `Zote ${selectedCount}` : ''}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Batch Progress Modal ─────────────────────────────────────────────────── */}
    {batchItems && (
      <BatchModal
        items={batchItems}
        platform={batchPlat}
        done={batchDone}
        onClose={closeBatchModal}
      />
    )}

    {/* ── Post Editor Drawer ───────────────────────────────────────────────────── */}
    {editor && (
      <PostEditorDrawer
        listing={editor.listing}
        defaultPlatform={editor.platform}
        onClose={() => setEditor(null)}
        onPosted={fetchListings}
        showToast={showToast}
      />
    )}
    </>
  )
}
