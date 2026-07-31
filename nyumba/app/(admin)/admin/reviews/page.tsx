'use client'
import { useState, useEffect, useCallback } from 'react'

function fmt(d: string) { return new Date(d).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' }) }

type Review = {
  id: string; rating: number; comment: string | null; is_flagged: boolean; created_at: string
  reviewer: { id: string; full_name: string } | null
  dalali:   { id: string; full_name: string; username: string | null } | null
  listing:  { id: string; title: string; type: string; district: string } | null
}
type Summary = { total: number; flagged: number; low_rating: number }

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <i key={i} className={`ti ti-star-filled text-xs ${i <= rating ? 'text-amber-400' : 'text-gray-200'}`} />
      ))}
    </div>
  )
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [summary, setSummary] = useState<Summary>({ total: 0, flagged: 0, low_rating: 0 })
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [q, setQ]             = useState('')
  const [filter, setFilter]   = useState('all')
  const [acting, setActing]   = useState<string | null>(null)
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ filter, q, page: String(page), limit: '50' })
    const res  = await fetch(`/api/v1/admin/reviews?${params}`)
    const data = await res.json() as { reviews: Review[]; total: number; summary: Summary }
    setReviews(data.reviews ?? [])
    setTotal(data.total ?? 0)
    if (data.summary) setSummary(data.summary)
    setLoading(false)
  }, [filter, q, page])

  useEffect(() => { load() }, [load])

  async function doAction(id: string, action: 'flag' | 'unflag' | 'delete') {
    setActing(id + action)
    const res  = await fetch(`/api/v1/admin/reviews/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json() as { error?: string; message?: string }
    setActing(null)
    if (!res.ok) { showToast(data.error ?? 'Imeshindwa', false); return }
    showToast(data.message ?? 'Imefanyika')
    load()
  }

  const FILTERS = [
    { key: 'all',        label: `Zote (${summary.total})` },
    { key: 'flagged',    label: `Bendera (${summary.flagged})` },
    { key: 'low_rating', label: `Chini 3★ (${summary.low_rating})` },
  ]

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl text-sm text-white ${toast.ok ? 'bg-gray-900' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      <div>
        <h1 className="text-xl font-bold text-gray-900">Mapitio ya Wateja</h1>
        <p className="text-sm text-gray-500 mt-0.5">Simamiamapitio ya nyota na maoni — futa au weka bendera yaliyodhuru</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-gray-900">{summary.total.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-0.5">Jumla ya Mapitio</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-red-600">{summary.flagged}</p>
          <p className="text-xs text-gray-500 mt-0.5">Yamewekwa Bendera</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-orange-600">{summary.low_rating}</p>
          <p className="text-xs text-gray-500 mt-0.5">Chini ya 3 Nyota</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
        <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }}
          placeholder="Tafuta jina, maoni..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => { setFilter(f.key); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f.key ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews list */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
          ))
        ) : reviews.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-sm text-gray-400">
            Hakuna mapitio yaliyopatikana
          </div>
        ) : reviews.map(r => (
          <div key={r.id} className={`bg-white border rounded-2xl p-4 shadow-sm ${r.is_flagged ? 'border-red-200 bg-red-50/30' : 'border-gray-100'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Stars rating={r.rating} />
                  {r.is_flagged && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                      <i className="ti ti-flag" /> Bendera
                    </span>
                  )}
                </div>
                {r.comment && <p className="text-sm text-gray-700 mb-2 leading-relaxed">&ldquo;{r.comment}&rdquo;</p>}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400">
                  <span><i className="ti ti-user" /> {r.reviewer?.full_name ?? '—'}</span>
                  <span>→ <i className="ti ti-user-tie" /> {r.dalali?.full_name ?? '—'}{r.dalali?.username ? ` (@${r.dalali.username})` : ''}</span>
                  {r.listing && <span><i className="ti ti-home" /> {r.listing.title} · {r.listing.district}</span>}
                  <span><i className="ti ti-calendar" /> {fmt(r.created_at)}</span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {r.is_flagged ? (
                  <button onClick={() => doAction(r.id, 'unflag')} disabled={acting === r.id + 'unflag'}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                    Ondoa Bendera
                  </button>
                ) : (
                  <button onClick={() => doAction(r.id, 'flag')} disabled={acting === r.id + 'flag'}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-orange-200 text-orange-600 hover:bg-orange-50 disabled:opacity-50">
                    <i className="ti ti-flag" /> Bendera
                  </button>
                )}
                <button onClick={() => { if (confirm('Futa mapitio haya kabisa?')) doAction(r.id, 'delete') }}
                  disabled={acting === r.id + 'delete'}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">
                  <i className="ti ti-trash" /> Futa
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {total > 50 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{total.toLocaleString()} jumla</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">←</button>
            <span className="px-3 py-1.5">Uk. {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page * 50 >= total}
              className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">→</button>
          </div>
        </div>
      )}
    </div>
  )
}
