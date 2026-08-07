'use client'
import { useState, useEffect, useCallback } from 'react'
import type { DepartmentScorecard, KPIItem, SopSummary, DeptStatus, KPIStatus, ScorecardReport } from '@/lib/scorecards/scorer'
import type { SnapshotRow } from '@/lib/scorecards/snapshot'

// ── Types for department settings ─────────────────────────────────────────────

interface KpiTarget {
  label:  string
  target: string
  unit:   string
  notes:  string
}

interface DeptSetting {
  owner_role:           string
  owner_name:           string | null
  sop_title:            string | null
  sop_url:              string | null
  sop_review_days:      number
  sop_last_reviewed_at: string | null
  kpi_targets:          KpiTarget[]
  goal_notes:           string | null
  updated_at:           string | null
}

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
  const delta = points[points.length - 1] - points[0]
  const color = delta > 3 ? '#10b981' : delta < -3 ? '#ef4444' : '#9ca3af'
  return (
    <svg width={W} height={H} className="block shrink-0" aria-hidden>
      <polyline points={coords.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {(() => { const last = coords[coords.length - 1].split(','); return <circle cx={last[0]} cy={last[1]} r="2" fill={color} /> })()}
    </svg>
  )
}

function TrendBadge({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const delta = points[points.length - 1] - points[0]
  if (delta > 3)  return <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">↑ +{Math.round(delta)}</span>
  if (delta < -3) return <span className="text-xs text-red-500 font-medium">↓ {Math.round(delta)}</span>
  return <span className="text-xs text-gray-400">→</span>
}

// ── KPI row ───────────────────────────────────────────────────────────────────

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

// ── Custom KPI target row (from settings) ─────────────────────────────────────

function KpiTargetRow({ item }: { item: KpiTarget }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-dashed border-gray-100 dark:border-gray-800 last:border-0">
      <span className="w-2 h-2 rounded-full shrink-0 bg-blue-400" />
      <span className="flex-1 text-sm text-gray-600 dark:text-gray-400 truncate">{item.label}</span>
      <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 tabular-nums">
        {item.target}
        {item.unit ? <span className="ml-0.5 font-normal text-xs text-gray-500"> {item.unit}</span> : null}
      </span>
    </div>
  )
}

// ── SOP Badge ─────────────────────────────────────────────────────────────────

function SOPBadge({ sop, setting }: { sop: SopSummary | null; setting?: DeptSetting | null }) {
  // Prefer custom SOP from settings if URL is set
  const customUrl   = setting?.sop_url?.trim()
  const customTitle = setting?.sop_title?.trim()
  const reviewedAt  = setting?.sop_last_reviewed_at ?? sop?.last_reviewed_at ?? null
  const title       = customTitle ?? sop?.title ?? null

  const reviewDays = setting?.sop_review_days ?? 30
  let isOverdue = sop?.is_overdue ?? false
  if (reviewedAt) {
    isOverdue = Date.now() - new Date(reviewedAt).getTime() > reviewDays * 86_400_000
  } else if (title) {
    isOverdue = true
  }

  if (!title && !customUrl) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-1.5 text-xs text-gray-400">
        <i className="ti ti-file-x" />
        Hakuna SOP
      </div>
    )
  }

  const ackChip = sop?.acknowledged_count
    ? <span className="shrink-0 text-xs text-gray-400 flex items-center gap-0.5"><i className="ti ti-users text-xs" />{sop.acknowledged_count}</span>
    : null

  const inner = (
    <>
      {isOverdue
        ? <i className="ti ti-alert-triangle shrink-0" />
        : <i className="ti ti-circle-check shrink-0" />}
      <span className="truncate flex-1">{title ?? 'SOP Document'}</span>
      {ackChip}
      {reviewedAt && (
        <span className="shrink-0 text-gray-400">
          {new Date(reviewedAt).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short' })}
        </span>
      )}
      {isOverdue && <span className="font-medium shrink-0">Imekwisha</span>}
    </>
  )

  const cls = `mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-1.5 text-xs ${
    isOverdue ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
  }`

  if (customUrl) {
    return (
      <a href={customUrl} target="_blank" rel="noopener noreferrer" className={`${cls} hover:underline`}>
        {inner}
        <i className="ti ti-external-link shrink-0 opacity-60" />
      </a>
    )
  }
  return <div className={cls}>{inner}</div>
}

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score, status }: { score: number; status: DeptStatus }) {
  return (
    <div className={`w-14 h-14 rounded-full flex flex-col items-center justify-center shrink-0 ${DEPT_BADGE[status]}`}>
      <span className="text-xl font-bold tabular-nums leading-none">{score}</span>
      <span className="text-[9px] uppercase tracking-wide opacity-60 mt-0.5">/100</span>
    </div>
  )
}

// ── Dept Card ─────────────────────────────────────────────────────────────────

function DeptCard({
  card, history, setting, onEdit,
}: {
  card:     DepartmentScorecard
  history:  SnapshotRow[]
  setting:  DeptSetting | null
  onEdit:   (role: string) => void
}) {
  const chronoScores = [...history].reverse().map(s => s.score)
  const customKpis   = setting?.kpi_targets ?? []

  return (
    <div className={`rounded-xl border ${DEPT_BG[card.overall]} p-4 flex flex-col`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${DEPT_BADGE[card.overall]}`}>
          <i className={`ti ti-${card.icon} text-lg`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 leading-tight">{card.department}</h3>
          {setting?.owner_name && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              <i className="ti ti-user mr-0.5" />{setting.owner_name}
            </p>
          )}
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
        <div className="flex flex-col items-end gap-1.5">
          <ScoreRing score={card.score} status={card.overall} />
          <button
            onClick={() => onEdit(card.owner_role)}
            className="text-xs text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-0.5 transition-colors"
          >
            <i className="ti ti-settings text-xs" /> Hariri
          </button>
        </div>
      </div>

      {/* Sparkline */}
      {chronoScores.length >= 2 && (
        <div className="flex items-center gap-3 mb-3 px-0.5">
          <Sparkline points={chronoScores} />
          <div className="flex flex-col">
            <TrendBadge points={chronoScores} />
            <span className="text-[10px] text-gray-400 mt-0.5">{chronoScores.length}d</span>
          </div>
        </div>
      )}

      {/* Auto KPIs from scorer */}
      <div className="flex-1">
        {card.kpis.map(kpi => <KPIRow key={kpi.label} kpi={kpi} />)}
      </div>

      {/* Custom KPI targets from settings */}
      {customKpis.length > 0 && (
        <div className="mt-3 pt-3 border-t border-dashed border-blue-200 dark:border-blue-800">
          <p className="text-[10px] uppercase tracking-wide text-blue-500 dark:text-blue-400 mb-1.5 font-semibold flex items-center gap-1">
            <i className="ti ti-target" /> Malengo Yaliyowekwa
          </p>
          {customKpis.map((item, i) => <KpiTargetRow key={i} item={item} />)}
        </div>
      )}

      {/* Goal notes */}
      {setting?.goal_notes && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic leading-snug line-clamp-2">
          {setting.goal_notes}
        </p>
      )}

      {/* SOP */}
      <SOPBadge sop={card.sop} setting={setting} />
    </div>
  )
}

// ── Edit Drawer ───────────────────────────────────────────────────────────────

const DEPT_LABELS: Record<string, string> = {
  admin: 'Uthibitisho', staff: 'Msaada', sales: 'Mauzo',
  finance: 'Fedha', marketing: 'Masoko',
}

function EditDrawer({
  role, initial, onClose, onSaved,
}: {
  role:    string
  initial: DeptSetting | null
  onClose: () => void
  onSaved: (s: DeptSetting) => void
}) {
  const blank: KpiTarget = { label: '', target: '', unit: '', notes: '' }

  const [ownerName,     setOwnerName]     = useState(initial?.owner_name          ?? '')
  const [sopTitle,      setSopTitle]      = useState(initial?.sop_title           ?? '')
  const [sopUrl,        setSopUrl]        = useState(initial?.sop_url             ?? '')
  const [sopDays,       setSopDays]       = useState(String(initial?.sop_review_days ?? 30))
  const [sopReviewed,   setSopReviewed]   = useState(initial?.sop_last_reviewed_at?.slice(0, 10) ?? '')
  const [goalNotes,     setGoalNotes]     = useState(initial?.goal_notes          ?? '')
  const [kpiTargets,    setKpiTargets]    = useState<KpiTarget[]>(initial?.kpi_targets?.length ? initial.kpi_targets : [])
  const [saving,        setSaving]        = useState(false)
  const [err,           setErr]           = useState<string | null>(null)

  const addKpi    = () => setKpiTargets(prev => [...prev, { ...blank }])
  const removeKpi = (i: number) => setKpiTargets(prev => prev.filter((_, j) => j !== i))
  const updateKpi = (i: number, field: keyof KpiTarget, val: string) =>
    setKpiTargets(prev => prev.map((k, j) => j === i ? { ...k, [field]: val } : k))

  const save = async () => {
    setSaving(true)
    setErr(null)
    try {
      const res = await fetch('/api/v1/admin/department-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_role:           role,
          owner_name:           ownerName.trim()    || null,
          sop_title:            sopTitle.trim()     || null,
          sop_url:              sopUrl.trim()       || null,
          sop_review_days:      Number(sopDays)     || 30,
          sop_last_reviewed_at: sopReviewed         || null,
          kpi_targets:          kpiTargets.filter(k => k.label.trim()),
          goal_notes:           goalNotes.trim()    || null,
        }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const json = await res.json() as { setting: DeptSetting }
      onSaved(json.setting)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Hariri Idara</h2>
            <p className="text-xs text-gray-500 mt-0.5">{DEPT_LABELS[role] ?? role}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <i className="ti ti-x" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* General */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Habari za Idara</h3>
            <label className="block mb-3">
              <span className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Msimamizi / Mwenye Jukumu</span>
              <input value={ownerName} onChange={e => setOwnerName(e.target.value)}
                placeholder="Jina la msimamizi..."
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </label>
            <label className="block">
              <span className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Malengo / Madhumuni ya Idara</span>
              <textarea value={goalNotes} onChange={e => setGoalNotes(e.target.value)}
                rows={3} placeholder="Eleza malengo makuu ya idara hii..."
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none" />
            </label>
          </section>

          {/* SOP */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <i className="ti ti-file-description" /> SOP (Utaratibu wa Kazi)
            </h3>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Jina la SOP</span>
                <input value={sopTitle} onChange={e => setSopTitle(e.target.value)}
                  placeholder="mfano: SOP ya Uthibitisho wa KYC"
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </label>
              <label className="block">
                <span className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Kiungo cha SOP (Google Drive / Notion / nk.)</span>
                <input value={sopUrl} onChange={e => setSopUrl(e.target.value)}
                  type="url" placeholder="https://..."
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Muda wa Mapitio (siku)</span>
                  <input value={sopDays} onChange={e => setSopDays(e.target.value)}
                    type="number" min="1" max="365"
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400" />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Tarehe ya Mapitio ya Mwisho</span>
                  <input value={sopReviewed} onChange={e => setSopReviewed(e.target.value)}
                    type="date" max={new Date().toISOString().slice(0, 10)}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400" />
                </label>
              </div>
            </div>
          </section>

          {/* KPI Targets */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <i className="ti ti-target" /> Malengo ya KPI
              </h3>
              <button onClick={addKpi}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-0.5 font-medium">
                <i className="ti ti-plus text-xs" /> Ongeza KPI
              </button>
            </div>

            {kpiTargets.length === 0 ? (
              <div className="text-center py-4 text-gray-400 text-xs border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                Hakuna malengo ya KPI. Bonyeza &ldquo;Ongeza KPI&rdquo; kuanza.
              </div>
            ) : (
              <div className="space-y-3">
                {kpiTargets.map((kpi, i) => (
                  <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">KPI #{i + 1}</span>
                      <button onClick={() => removeKpi(i)} className="text-xs text-red-400 hover:text-red-600">
                        <i className="ti ti-trash text-xs" />
                      </button>
                    </div>
                    <input value={kpi.label} onChange={e => updateKpi(i, 'label', e.target.value)}
                      placeholder="Jina la KPI (mfano: Muda wa Majibu)"
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400" />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={kpi.target} onChange={e => updateKpi(i, 'target', e.target.value)}
                        placeholder="Lengo (mfano: ≤ 24saa)"
                        className="border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400" />
                      <input value={kpi.unit} onChange={e => updateKpi(i, 'unit', e.target.value)}
                        placeholder="Kiasi (mfano: saa, %)"
                        className="border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400" />
                    </div>
                    <input value={kpi.notes} onChange={e => updateKpi(i, 'notes', e.target.value)}
                      placeholder="Maelezo zaidi (si lazima)"
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400" />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-800 px-5 py-4 space-y-2">
          {err && <p className="text-sm text-red-600 text-center">{err}</p>}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Ghairi
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors">
              {saving ? 'Inahifadhi...' : 'Hifadhi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

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
  const [report,    setReport]    = useState<ScorecardReport | null>(null)
  const [history,   setHistory]   = useState<Record<string, SnapshotRow[]>>({})
  const [settings,  setSettings]  = useState<Record<string, DeptSetting>>({})
  const [loading,   setLoading]   = useState(true)
  const [refreshing,setRefreshing]= useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [editRole,  setEditRole]  = useState<string | null>(null)

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true)
    setError(null)
    try {
      const [scoreRes, histRes, settRes] = await Promise.all([
        fetch(`/api/v1/admin/scorecards${force ? '?force=1' : ''}`),
        fetch('/api/v1/admin/scorecards/history?days=7'),
        fetch('/api/v1/admin/department-settings'),
      ])
      if (!scoreRes.ok) throw new Error(`${scoreRes.status}`)
      const scoreJson = await scoreRes.json()
      setReport(scoreJson.report)
      if (histRes.ok) {
        const h = await histRes.json()
        setHistory(h.history ?? {})
      }
      if (settRes.ok) {
        const s = await settRes.json() as { settings: DeptSetting[] }
        const map: Record<string, DeptSetting> = {}
        for (const d of s.settings ?? []) map[d.owner_role] = d
        setSettings(map)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hitilafu')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSaved = (saved: DeptSetting) => {
    setSettings(prev => ({ ...prev, [saved.owner_role]: saved }))
    setEditRole(null)
  }

  const departments = report?.departments ?? []
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Kadi za Idara</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Hali ya kila idara — KPIs, SOP, na tahadhari. Bonyeza <i className="ti ti-settings" /> kwenye kadi kuhariri.
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
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Malengo Yaliyowekwa</span>
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
              setting={settings[card.owner_role] ?? null}
              onEdit={setEditRole}
            />
          ))}
        </div>
      ) : !error ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          <i className="ti ti-layout-grid text-4xl block mb-2 opacity-30" />
          Hakuna taarifa
        </div>
      ) : null}

      {/* Edit drawer */}
      {editRole && (
        <EditDrawer
          role={editRole}
          initial={settings[editRole] ?? null}
          onClose={() => setEditRole(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
