'use client'
import { useState, useEffect, useCallback } from 'react'

type Recommendation = {
  best_hours?:          number[]
  best_days?:           number[]
  worst_hours?:         number[]
  worst_days?:          number[]
  bestHours?:           number[]
  bestDays?:            number[]
  worstHours?:          number[]
  worstDays?:           number[]
  recommendation_text?: string
  recommendation?:      string
  data_points?:         number
  dataPoints?:          number
  avg_engagement?:      number
  analysis_date?:       string
  heatmap?:             number[][]
  postsAnalyzed?:       number
}

const DAY_NAMES = ['Jumatatu', 'Jumanne', 'Jumatano', 'Alhamisi', 'Ijumaa', 'Jumamosi', 'Jumapili']
const DAY_SHORT = ['Jum', 'Jma', 'Jno', 'Alh', 'Iju', 'Jms', 'Jpili']

function fmt12(h: number) {
  if (h === 0)  return '12 usiku'
  if (h < 12)  return `${h} asubuhi`
  if (h === 12) return '12 mchana'
  return `${h - 12} jioni`
}

function HourBadge({ hour, type }: { hour: number; type: 'best' | 'worst' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
      type === 'best'
        ? 'bg-green-100 text-green-700'
        : 'bg-red-100 text-red-700'
    }`}>
      {fmt12(hour)}
    </span>
  )
}

function DayBadge({ day, type }: { day: number; type: 'best' | 'worst' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
      type === 'best'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-orange-100 text-orange-700'
    }`}>
      {DAY_NAMES[day] ?? day}
    </span>
  )
}

function HeatmapGrid({ data }: { data: number[][] }) {
  const flat    = data.flat().filter(v => v > 0)
  const maxVal  = flat.length > 0 ? Math.max(...flat) : 1

  function cellColor(val: number): string {
    if (val === 0) return 'bg-gray-100'
    const ratio = val / maxVal
    if (ratio > 0.8) return 'bg-green-600'
    if (ratio > 0.6) return 'bg-green-400'
    if (ratio > 0.4) return 'bg-green-200'
    if (ratio > 0.2) return 'bg-yellow-100'
    return 'bg-gray-100'
  }

  // Show every other hour to fit in screen
  const HOURS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[480px]">
        {/* Hour labels */}
        <div className="flex mb-1 pl-14">
          {HOURS.map(h => (
            <div key={h} className="flex-1 text-center text-[10px] text-gray-400">{h}h</div>
          ))}
        </div>
        {/* Rows */}
        {data.map((row, dayIdx) => (
          <div key={dayIdx} className="flex items-center mb-0.5">
            <div className="w-14 text-[10px] text-gray-500 flex-shrink-0">{DAY_SHORT[dayIdx]}</div>
            {HOURS.map(h => {
              // Average the two adjacent hours
              const val = (row[h] + (row[h + 1] ?? 0)) / (row[h + 1] !== undefined ? 2 : 1)
              return (
                <div
                  key={h}
                  title={`${DAY_NAMES[dayIdx]} ${h}h: ${val.toFixed(2)}%`}
                  className={`flex-1 h-6 rounded-sm mx-0.5 ${cellColor(val)}`}
                />
              )
            })}
          </div>
        ))}
        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 text-[10px] text-gray-500">
          <span>Chini</span>
          {['bg-gray-100','bg-yellow-100','bg-green-200','bg-green-400','bg-green-600'].map(c => (
            <div key={c} className={`w-5 h-3 rounded-sm ${c}`} />
          ))}
          <span>Juu</span>
        </div>
      </div>
    </div>
  )
}

export default function BestTimeTab() {
  const [platform, setPlatform] = useState<'instagram' | 'facebook'>('instagram')
  const [rec, setRec]           = useState<Recommendation | null>(null)
  const [loading, setLoading]   = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [toast, setToast]       = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const loadRecommendation = useCallback(async (p: 'instagram' | 'facebook') => {
    setLoading(true)
    setRec(null)
    try {
      const res = await fetch(`/api/v1/social/best-time?platform=${p}`)
      const data = await res.json() as Recommendation
      setRec(data)
    } catch {
      showToast('Imeshindwa kupakia mapendekezo')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRecommendation(platform)
  }, [platform, loadRecommendation])

  async function handleAnalyze() {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/v1/social/best-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })
      const data = await res.json() as Recommendation
      setRec(data)
      const analyzed = data.postsAnalyzed ?? data.data_points ?? data.dataPoints ?? 0
      showToast(`Uchambuzi umekamilika! Posts zilizochunguzwa: ${analyzed}`)
    } catch {
      showToast('Uchambuzi umeshindwa')
    } finally {
      setAnalyzing(false)
    }
  }

  const bestHours  = rec?.best_hours  ?? rec?.bestHours  ?? []
  const bestDays   = rec?.best_days   ?? rec?.bestDays   ?? []
  const worstHours = rec?.worst_hours ?? rec?.worstHours ?? []
  const worstDays  = rec?.worst_days  ?? rec?.worstDays  ?? []
  const recText    = rec?.recommendation_text ?? rec?.recommendation ?? ''
  const dataPoints = rec?.data_points ?? rec?.dataPoints ?? 0
  const avgEng     = rec?.avg_engagement ?? 0
  const heatmap    = rec?.heatmap ?? null

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm">
          {toast}
        </div>
      )}

      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex gap-2">
          {(['instagram', 'facebook'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                platform === p
                  ? 'bg-primary-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p === 'instagram' ? '📸 Instagram' : '👤 Facebook'}
            </button>
          ))}
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
        >
          {analyzing ? (
            <>
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Inachunguza...
            </>
          ) : (
            '🤖 Chunguza Upya'
          )}
        </button>
      </div>

      {analyzing && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-5 text-sm text-purple-800">
          Inakusanya data ya posts na kuchanganua kwa AI... Dakika 1-2. Usifunge dirisha.
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : rec ? (
        <div className="space-y-5">
          {/* Meta info */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            {dataPoints > 0 && <span>📊 Posts zilizochunguzwa: <strong>{dataPoints}</strong></span>}
            {avgEng > 0    && <span>📈 Wastani wa engagement: <strong>{avgEng}%</strong></span>}
            {rec.analysis_date && <span>📅 Uchambuzi wa: <strong>{rec.analysis_date}</strong></span>}
            {dataPoints === 0  && (
              <span className="text-amber-600">
                ⚠️ Bado kuna data ndogo — chapisha posts zaidi kisha bonyeza &ldquo;Chunguza Upya&rdquo;
              </span>
            )}
          </div>

          {/* Best/Worst hours */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Masaa Bora (EAT)</h3>
              <div className="flex flex-wrap gap-2">
                {bestHours.length > 0
                  ? bestHours.map(h => <HourBadge key={h} hour={h} type="best" />)
                  : <span className="text-xs text-gray-400">Bado hakuna data ya kutosha</span>
                }
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Masaa Mabaya</h3>
              <div className="flex flex-wrap gap-2">
                {worstHours.length > 0
                  ? worstHours.map(h => <HourBadge key={h} hour={h} type="worst" />)
                  : <span className="text-xs text-gray-400">—</span>
                }
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Siku Bora</h3>
              <div className="flex flex-wrap gap-2">
                {bestDays.length > 0
                  ? bestDays.map(d => <DayBadge key={d} day={d} type="best" />)
                  : <span className="text-xs text-gray-400">Bado hakuna data ya kutosha</span>
                }
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Siku Mbaya</h3>
              <div className="flex flex-wrap gap-2">
                {worstDays.length > 0
                  ? worstDays.map(d => <DayBadge key={d} day={d} type="worst" />)
                  : <span className="text-xs text-gray-400">—</span>
                }
              </div>
            </div>
          </div>

          {/* AI recommendation */}
          {recText && (
            <div className="bg-gradient-to-br from-primary-50 to-white border border-primary-500/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🤖</span>
                <h3 className="font-semibold text-gray-800">Ushauri wa Amina</h3>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{recText}</p>
            </div>
          )}

          {/* Heatmap */}
          {heatmap && heatmap.length === 7 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Ramani ya Wakati (Siku × Saa)</h3>
              <HeatmapGrid data={heatmap} />
              <p className="text-xs text-gray-400 mt-3">
                Saa ziko katika wakati wa Tanzania (EAT = UTC+3). Rangi ya kijani = engagement kubwa.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
