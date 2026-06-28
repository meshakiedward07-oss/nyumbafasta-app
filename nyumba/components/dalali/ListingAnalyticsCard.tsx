'use client'
import { useEffect, useState } from 'react'

interface ListingAnalytics {
  totalViews:       number
  totalLeads:       number
  totalShares:      number
  totalSaves:       number
  avgRating:        number
  ratingCount:      number
  performanceScore: number
}

function ScoreBadge({ score }: { score: number }) {
  if (score >= 70) return <span className="text-primary-600 font-semibold text-xs"><i className="ti ti-flame" aria-hidden="true" /> Inafanya vizuri</span>
  if (score >= 30) return <span className="text-amber-600 font-semibold text-xs"><i className="ti ti-arrow-right" aria-hidden="true" /> Wastani</span>
  return <span className="text-red-500 font-semibold text-xs"><i className="ti ti-alert-triangle" aria-hidden="true" /> Inahitaji kuangaliwa</span>
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-primary-500' : score >= 30 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${score}%` }} />
    </div>
  )
}

export default function ListingAnalyticsCard({ listingId }: { listingId: string }) {
  const [data, setData]       = useState<ListingAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/v1/listings/${listingId}/analytics`)
      .then(res => {
        if (!res.ok) throw new Error('failed')
        return res.json() as Promise<ListingAnalytics>
      })
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [listingId])

  if (loading) {
    return (
      <div className="px-3 pb-3 animate-pulse">
        <div className="bg-gray-50 rounded-xl p-3 space-y-2">
          <div className="h-1.5 bg-gray-200 rounded-full w-full" />
          <div className="grid grid-cols-4 gap-2">
            {[1,2,3,4].map(i => <div key={i} className="h-10 bg-gray-200 rounded-lg" />)}
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) return null

  return (
    <div className="px-3 pb-3 border-t border-gray-50 pt-3">
      <div className="bg-gray-50 rounded-xl p-3">

        {/* Performance bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Utendaji</span>
            <ScoreBadge score={data.performanceScore} />
          </div>
          <ScoreBar score={data.performanceScore} />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white rounded-lg p-2 text-center">
            <p className="text-base font-bold text-gray-900">{data.totalViews}</p>
            <p className="text-[10px] text-gray-400 mt-0.5"><i className="ti ti-eye" aria-hidden="true" /> Waliotazama</p>
          </div>
          <div className="bg-white rounded-lg p-2 text-center">
            <p className="text-base font-bold text-gray-900">{data.totalLeads}</p>
            <p className="text-[10px] text-gray-400 mt-0.5"><i className="ti ti-lock-open" aria-hidden="true" /> Unlocks</p>
          </div>
          <div className="bg-white rounded-lg p-2 text-center">
            <p className="text-base font-bold text-gray-900">{data.totalSaves}</p>
            <p className="text-[10px] text-gray-400 mt-0.5"><i className="ti ti-heart" aria-hidden="true" /> Saved</p>
          </div>
          <div className="bg-white rounded-lg p-2 text-center">
            <p className="text-base font-bold text-gray-900">
              {data.avgRating > 0 ? data.avgRating.toFixed(1) : '—'}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5"><i className="ti ti-star-filled" aria-hidden="true" /> Rating</p>
          </div>
        </div>

        {/* Low-performance hint */}
        {data.performanceScore < 30 && data.totalViews < 5 && (
          <p className="text-[10px] text-amber-600 mt-2 text-center">
            <i className="ti ti-bulb" aria-hidden="true" /> Jaribu kupunguza bei au kuongeza picha zaidi
          </p>
        )}
      </div>
    </div>
  )
}
