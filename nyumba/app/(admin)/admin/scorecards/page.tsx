'use client'
import { useState, useEffect, useCallback } from 'react'
import type { DepartmentScorecard, KPIItem, SopSummary, DeptStatus, KPIStatus, ScorecardReport } from '@/lib/scorecards/scorer'
import type { SnapshotRow } from '@/lib/scorecards/snapshot'

// ── Colour helpers ────────────────────────────────────────────────────────────

const DEPT_BG: Record<DeptStatus, string> = {
  good:     'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
  warning:  'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
  critical: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
}

const DEPT_BADGE: Record<DeptStatus, string> = {
  good:     'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  warning:  'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const KPI_DOT: Record<KPIStatus, string> = {
  good:     'bg-emerald-500',
  warning:  'bg-amber-500',
  critical: 'bg-red-500',
  neutral:  'bg-gray-400',
}

const STATUS_LABEL: Record<DeptStatus, string> = {
  good: 'Nzuri', warning: 'Angalia', critical: 'Hatari',
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
// Renders a 7-point score history as a small inline SVG polyline.

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null

  const W = 56, H = 20, PAD = 2
  const min = Math.max(0,   Math.min(...points) - 5)
  const max = Math.min(100, Math.max(...points) + 5)
  const range = max - min || 1

  const coords = points.map((v, i) => {
    const x = PAD + (i / (points.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  // Trend: compare last value to first
  const delta = points[points.length - 1] - points[0]
  const color = delta > 3 ? '#10b981' : delta < -3 ? '#ef4444' : '#9ca3af'

  return (
    <svg width={W} height={H} className="block shrink-0" aria-hidden>
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Endpoint dot */}
      {(() => {
        const last = coords[coords.length - 1].split(',')
        return <circle cx={last[0]} cy={last[1]} r="2" fill={color} />
      })()}
    </svg>
  )
}

// ── Trend arrow ───────────────────────────────────────────────────────────────

function TrendBadge({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const delta = points[points.length - 1] - points[0]
  if (delta > 3)  return <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">↑ +{Math.round(delta)}</span>
  if (delta < -3) return <span className="text-xs text-red-500 font-medium">↓ {Math.round(delta)}</span>
  return <span className="text-xs text-gray-400">→</span>
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KPIRow({ kpi }: { kpi: KPIItem }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className={`w-2 h-2 rounded-full shrink-0 ${KPI_DOT[kpi.status]}`} />
      <span className="flex-1 text-sm text-gray-600 dark:text-gray-400 truncate">{kpi.label}</span>
      <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
        {kpi.display}
        {kpi.unit ? <span className="ml-0.5 font-normal text-xs text-gray-500"> {kpi.unit}</span> : null}
      </span>
      <span className="text-xs text-gray-400 dark:text-gray-600 w-16 text-right shrink-0 truncate">{kpi.target}</span>
    </div>
  )
}

function SOPBadge({ sop }: { sop: SopSummary | null }) {
  if (!sop) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-1.5 text-xs text-gray-400">
        <i className="ti ti-file-x" />
        Hakuna SOP
      </div>
    )
  }

  const ackChip = sop.acknowledged_count > 0
    ? <span className="shrink-0 text-xs text-gray-400 flex items-center gap-0.5"><i className="ti ti-users text-xs" />{sop.acknowledged_count}</span>
    : null

  if (sop.is_overdue) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
        <i className="ti ti-alert-triangle shrink-0" />
        <span className="truncate flex-1">{sop.title}</span>
        {ackChip}
        <span className="font-medium shrink-0">Imekwisha</span>
      </div>
    )
  }
  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
      <i className="ti ti-circle-check shrink-0" />
      <span className="truncate flex-1">{sop.title}</span>
      {ackChip}
      {sop.last_reviewed_at && (
        <span className="shrink-0 text-gray-400">
          {new Date(sop.last_reviewed_at).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short' })}
        </span>
      )}
    </div>
  )
}

function ScoreRing({ score, status }: { score: number; status: DeptStatus }) {
  return (
    <div className={`w-14 h-14 rounded-full flex flex-col items-center justify-center shrink-0 ${DEPT_BADGE[status]}`}>
      <span className="text-xl font-bold tabular-nums leading-none">{score}</span>
      <span className="text-[9px] uppercase tracking-wide opacity-60 mt-0.5">/100</span>
    </div>
  )
}

function DeptCard({ card, history }: { card: DepartmentScorecard; history: SnapshotRow[] }) {
  // History is newest-first; reverse to chronological for sparkline
  const chronoScores = [...history].reverse().map(s => s.score)

  return (
    <div className={`rounded-xl border ${DEPT_BG[card.overall]} p-4 flex flex-col`}>
      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${DEPT_BADGE[card.overall]}`}>
          <i className={`ti ti-${card.icon} text-lg`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 leading-tight">{card.department}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${DEPT_BADGE[card.overall]}`}>
              {STATUS_LABEL[card.overall]}
            </span>
            {card.open_alerts > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
                <i className="ti ti-alert-triangle text-amber-500 text-xs" />
                {card.open_alerts} tahadhari
              </span>
            )}
          </div>
        </div>
        <ScoreRing score={card.score} status={card.overall} />
      </div>

      {/* Sparkline + trend (only if we have ≥2 snapshots) */}
      {chronoScores.length >= 2 && (
        <div className="flex items-center gap-3 mb-3 px-0.5">
          <Sparkline points={chronoScores} />
          <div className="flex flex-col">
            <TrendBadge points={chronoScores} />
            <span className="text-[10px] text-gray-400 mt-0.5">{chronoScores.length}d</span>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="flex-1">
        {card.kpis.map(kpi => <KPIRow key={kpi.label} kpi={kpi} />)}
      </div>

      <SOPBadge sop={card.sop} />
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 p-4 animate-pulse">
      <div className="flex gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1 space-y-2 pt-0.5">
          <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-14 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700" />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="py-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="flex-1 h-3 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="w-10 h-3 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ScorecardPage() {
  const [report, setReport]           = useState<ScorecardReport | null>(null)
  const [history, setHistory]         = useState<Record<string, SnapshotRow[]>>({})
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true)
    setError(null)
    try {
      const [scoreRes, histRes] = await Promise.all([
        fetch(`/api/v1/admin/scorecards${force ? '?force=1' : ''}`),
        fetch('/api/v1/admin/scorecards/history?days=7'),
      ])
      if (!scoreRes.ok) throw new Error(`${scoreRes.status}`)
      const scoreJson = await scoreRes.json()
      setReport(scoreJson.report)
      if (histRes.ok) {
        const histJson = await histRes.json()
        setHistory(histJson.history ?? {})
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hitilafu')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const departments = report?.departments ?? []

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Kadi za Idara</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Hali ya kila idara — KPIs, SOP, na tahadhari
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {report?.generated_at && (
            <span className="text-xs text-gray-400 dark:text-gray-600">
              {new Date(report.generated_at).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            <i className={`ti ti-refresh text-base ${refreshing ? 'animate-spin' : ''}`} />
            Onyesha Upya
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Nzuri (≥ 80)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Angalia (50–79)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Hatari (&lt; 50)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />Habari tu</span>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
          <i className="ti ti-alert-circle" />
          Imeshindwa kupakia: {error}
        </div>
      )}

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : departments.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map(card => (
            <DeptCard
              key={card.owner_role}
              card={card}
              history={history[card.owner_role] ?? []}
            />
          ))}
        </div>
      ) : !error ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          <i className="ti ti-layout-grid text-4xl block mb-2 opacity-30" />
          Hakuna taarifa
        </div>
      ) : null}
    </div>
  )
}
