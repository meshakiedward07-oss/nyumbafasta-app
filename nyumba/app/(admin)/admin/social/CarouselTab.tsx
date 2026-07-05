'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'

type CarouselPost = {
  id:            string
  listing_id:    string | null
  post_id:       string | null
  media_urls:    string[] | null
  caption:       string | null
  slides_count:  number | null
  status:        string
  error_message: string | null
  likes:         number
  comments:      number
  reach:         number
  posted_at:     string | null
  created_at:    string
  listings:      { id: string; title: string; district: string; region: string } | null
}

type Listing = {
  id:     string
  title:  string
  district: string
  region:   string
  images: string[]
}

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60)  return `Dakika ${mins} zilizopita`
  const hrs = Math.floor(mins / 60)
  if (hrs  < 24)  return `Masaa ${hrs} yaliyopita`
  return `Siku ${Math.floor(hrs / 24)} zilizopita`
}

export default function CarouselTab() {
  const [carousels, setCarousels]   = useState<CarouselPost[]>([])
  const [loading, setLoading]       = useState(true)
  const [posting, setPosting]       = useState(false)
  const [toast, setToast]           = useState<string | null>(null)

  const [listings, setListings]     = useState<Listing[]>([])
  const [selectedId, setSelectedId] = useState('')

  const selected = listings.find(l => l.id === selectedId) ?? null

  function showMsg(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4500)
  }

  async function fetchCarousels() {
    setLoading(true)
    try {
      const res  = await fetch('/api/v1/social/carousel')
      const data = await res.json() as { carousels?: CarouselPost[] }
      setCarousels(data.carousels ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function fetchListings() {
    const res  = await fetch('/api/v1/listings?status=active&limit=50')
    const data = await res.json() as { listings?: Listing[] }
    setListings(data.listings ?? [])
  }

  useEffect(() => { fetchCarousels(); fetchListings() }, [])

  async function handlePost(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) { showMsg('Chagua listing kwanza'); return }
    if (!selected || (selected.images?.length ?? 0) < 2) {
      showMsg('Listing hii haina picha za kutosha (inahitaji angalau 2)')
      return
    }

    setPosting(true)
    try {
      const res  = await fetch('/api/v1/social/carousel', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ listingId: selectedId }),
      })
      const data = await res.json() as { success?: boolean; slidesCount?: number; error?: string }

      if (data.success) {
        showMsg(`Carousel imechapishwa! (Slides: ${data.slidesCount})`)
        setSelectedId('')
        fetchCarousels()
      } else {
        showMsg(`Imeshindwa: ${data.error}`)
      }
    } finally {
      setPosting(false)
    }
  }

  const statusColor: Record<string, string> = {
    posted:  'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    failed:  'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm">
          {toast}
        </div>
      )}

      {/* Post form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><i className="ti ti-layout-columns" aria-hidden="true" /> Chapisha Carousel Mpya</h2>
        <form onSubmit={handlePost} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Chagua Listing</label>
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">-- Chagua listing --</option>
              {listings.map(l => (
                <option key={l.id} value={l.id}>
                  {l.title} — {l.district} ({l.images?.length ?? 0} picha)
                </option>
              ))}
            </select>
          </div>

          {/* Slides preview */}
          {selected && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">
                Slides: {selected.images?.length ?? 0}
                {(selected.images?.length ?? 0) < 2 && (
                  <span className="text-red-500 ml-2 flex items-center gap-0.5"><i className="ti ti-alert-triangle" aria-hidden="true" /> Inahitaji angalau 2</span>
                )}
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {(selected.images ?? []).slice(0, 10).map((img, i) => (
                  <div
                    key={i}
                    className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-gray-200"
                  >
                    <Image fill src={img} alt={`Slide ${i + 1}`} className="object-cover" sizes="64px" />
                    <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[10px] px-1 rounded-tl">
                      {i + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
<p className="font-semibold mb-1 flex items-center gap-1"><i className="ti ti-info-circle" aria-hidden="true" /> Jinsi carousel inavyofanya kazi:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Picha zote za listing zinaonekana kwenye slide moja</li>
              <li>Watermark ya NyumbaFasta inawekwa kwenye kila slide</li>
              <li>Caption ya AI inazalishwa kwa Kiswahili</li>
              <li>Inahitaji picha angalau 2 (max 10)</li>
              <li>Mchakato unaweza kuchukua dakika 1-2</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={posting || !selectedId || (selected?.images?.length ?? 0) < 2}
            className="btn-primary w-full py-3"
          >
            {posting ? <><i className="ti ti-loader-2 animate-spin" aria-hidden="true" /> Inachapisha carousel...</> : <><i className="ti ti-rocket" aria-hidden="true" /> Chapisha Carousel Sasa</>}
          </button>
        </form>
      </div>

      {/* History */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><i className="ti ti-list" aria-hidden="true" /> Historia ya Carousel</h3>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : carousels.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
  <div className="text-4xl mb-3"><i className="ti ti-layout-columns" aria-hidden="true" /></div>
            <p>Hakuna carousel zilizochapishwa bado</p>
            <p className="text-sm mt-1">Chagua listing yenye picha 2+ hapo juu</p>
          </div>
        ) : (
          <div className="space-y-3">
            {carousels.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {c.status === 'posted' ? 'Imechapishwa' : c.status === 'failed' ? 'Imeshindwa' : 'Inasubiri'}
                      </span>
                      {c.slides_count && (
<span className="text-xs text-gray-500 flex items-center gap-0.5"><i className="ti ti-layout-columns" aria-hidden="true" /> {c.slides_count} slides</span>
                      )}
                      <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span>
                    </div>
                    {c.listings && (
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {c.listings.title} — {c.listings.district}
                      </p>
                    )}
                  </div>

                  {/* Thumbnail strip */}
                  {c.media_urls && c.media_urls.length > 0 && (
                    <div className="flex gap-1 flex-shrink-0">
                      {c.media_urls.slice(0, 3).map((url, i) => (
                        <div key={i} className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-100">
                          <Image fill src={url} alt="" className="object-cover" sizes="40px" />
                        </div>
                      ))}
                      {c.media_urls.length > 3 && (
                        <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                          +{c.media_urls.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Metrics */}
                {c.status === 'posted' && (
                  <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600">
<span className="flex items-center gap-0.5"><i className="ti ti-heart" aria-hidden="true" /> {c.likes}</span>
<span className="flex items-center gap-0.5"><i className="ti ti-message-circle" aria-hidden="true" /> {c.comments}</span>
<span className="flex items-center gap-0.5"><i className="ti ti-eye" aria-hidden="true" /> {c.reach}</span>
                    {c.posted_at && <span className="text-gray-400 ml-auto">{timeAgo(c.posted_at)}</span>}
                  </div>
                )}

                {c.status === 'failed' && c.error_message && (
                  <p className="text-xs text-red-500 mt-2 truncate">{c.error_message}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
