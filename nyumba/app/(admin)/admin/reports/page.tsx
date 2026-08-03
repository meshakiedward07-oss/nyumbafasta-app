'use client'
import { useState } from 'react'
import type { ReviewReport } from '@/lib/reviews/generator'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('sw-TZ')
}

function fmtTsh(n: number): string {
  return `Tsh ${n.toLocaleString('sw-TZ')}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short' })
}

function trend(current: number, prev: number): { arrow: string; cls: string; pct: string } {
  if (prev === 0 && current === 0) return { arrow: '—', cls: 'text-gray-400', pct: '' }
  if (prev === 0) return { arrow: '↑', cls: 'text-green-600', pct: '+100%' }
  const pct = ((current - prev) / prev) * 100
  if (pct > 0)  return { arrow: '↑', cls: 'text-green-600', pct: `+${pct.toFixed(0)}%` }
  if (pct < 0)  return { arrow: '↓', cls: 'text-red-500',   pct: `${pct.toFixed(0)}%` }
  return { arrow: '→', cls: 'text-gray-400', pct: '0%' }
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, trendCurrent, trendPrev, highlight,
}: {
  label:         string
  value:         string
  sub?:          string
  trendCurrent?: number
  trendPrev?:    number
  highlight?:    boolean
}) {
  const t = trendCurrent != null && trendPrev != null ? trend(trendCurrent, trendPrev) : null
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
      <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-green-700' : 'text-gray-900'} font-mono`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      {t && (
        <p className={`text-xs font-semibold mt-1 ${t.cls}`}>
          {t.arrow} {t.pct} vs kipindi kilichopita
        </p>
      )}
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 pt-6 border-t border-gray-100 first:border-t-0 first:pt-0">
      <span className="text-2xl">{icon}</span>
      <div>
        <h2 className="font-bold text-gray-800 text-base">{title}</h2>
        {sub && <p className="text-xs text-gray-500">{sub}</p>}
      </div>
    </div>
  )
}

// ── Report renderer ───────────────────────────────────────────────────────────

function ReportView({ report }: { report: ReviewReport }) {
  const { business: biz, operations: ops, alerts, sop_compliance: sops, prev } = report
  const overdueSOPs = sops.filter(s => s.is_overdue)

  const REVIEW_FREQ_LABELS: Record<string, string> = {
    weekly: 'Kila wiki', monthly: 'Kila mwezi',
    quarterly: 'Kila robo mwaka', biannual: 'Mara mbili kwa mwaka', annually: 'Kila mwaka',
  }

  return (
    <div className="space-y-0 print:text-sm" id="report-content">

      {/* Report header */}
      <div className="bg-gray-800 text-white rounded-xl p-5 mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">NyumbaFasta</p>
          <h1 className="text-lg font-bold">
            Ripoti ya {report.period === 'weekly' ? 'Wiki' : 'Mwezi'}
          </h1>
          <p className="text-sm text-gray-300 mt-1">
            {fmtDateShort(report.period_start)} — {fmtDateShort(report.period_end)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Imetengenezwa</p>
          <p className="text-sm font-mono">{fmtDate(report.generated_at)}</p>
          {overdueSOPs.length > 0 && (
            <p className="text-xs bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full mt-2 font-semibold">
              ⚠ SOP {overdueSOPs.length} zinahitaji ukaguzi
            </p>
          )}
        </div>
      </div>

      {/* ── Business ── */}
      <SectionHeader icon="💼" title="Biashara" sub="Wateja, Mauzo, na Shughuli" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Wateja Wapya"
          value={fmt(biz.new_clients)}
          trendCurrent={biz.new_clients}
          trendPrev={prev.new_clients}
        />
        <StatCard
          label="Madalali Wapya"
          value={fmt(biz.new_dalali)}
          trendCurrent={biz.new_dalali}
          trendPrev={prev.new_dalali}
        />
        <StatCard
          label="Mapato ya Unlocks"
          value={fmtTsh(biz.unlock_revenue_tshs)}
          sub={`${fmt(biz.contact_unlocks)} unlocks × Tsh 2,000`}
          trendCurrent={biz.contact_unlocks}
          trendPrev={prev.contact_unlocks}
          highlight={true}
        />
        <StatCard
          label="Subscriptions Mpya"
          value={fmt(biz.new_subscriptions)}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Listings Mpya"
          value={fmt(biz.new_listings)}
          trendCurrent={biz.new_listings}
          trendPrev={prev.new_listings}
        />
        <StatCard
          label="Listings Zilizoidhinishwa"
          value={fmt(biz.approved_listings)}
          sub={biz.new_listings > 0 ? `${Math.round(biz.approved_listings / biz.new_listings * 100)}% ya mpya` : undefined}
        />
        <StatCard
          label="Listings Zilizokataliwa"
          value={fmt(biz.rejected_listings)}
        />
        <StatCard
          label="Listings Zinazofanya Kazi"
          value={fmt(biz.active_listings)}
          sub="Jumla ya sasa (zote)"
        />
      </div>

      {/* ── Operations ── */}
      <SectionHeader icon="⚙️" title="Uendeshaji" sub="KYC, Listing Approval, na Utaratibu" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="KYC Zilizowasilishwa" value={fmt(ops.kyc_submitted)} />
        <StatCard
          label="KYC Zilizoidhinishwa"
          value={fmt(ops.kyc_approved)}
          sub={ops.kyc_submitted > 0 ? `${Math.round(ops.kyc_approved / ops.kyc_submitted * 100)}% idhini` : undefined}
          highlight={ops.kyc_approved > 0}
        />
        <StatCard label="KYC Zilizokataliwa" value={fmt(ops.kyc_rejected)} />
        <StatCard
          label="KYC Zinazosubiri (Sasa)"
          value={fmt(ops.kyc_pending)}
          sub={ops.kyc_pending > 5 ? '⚠ Zaidi ya kikomo' : undefined}
        />
      </div>

      {/* ── Alerts ── */}
      <SectionHeader icon="🚨" title="Tahadhari" sub="Matukio ya Mfumo katika Kipindi Hiki" />
      {alerts.total_fired === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-5 mb-6 text-center">
          <p className="text-green-700 font-semibold">✅ Hakuna tahadhari zilizowaka katika kipindi hiki</p>
        </div>
      ) : (
        <div className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <StatCard label="Jumla ya Tahadhari" value={fmt(alerts.total_fired)} />
            <StatCard label="Zilizotatuliwa" value={fmt(alerts.resolved)}
              sub={alerts.total_fired > 0 ? `${Math.round(alerts.resolved / alerts.total_fired * 100)}% utatuzi` : undefined} />
            <StatCard label="Muda wa Kutatua"
              value={alerts.avg_resolution_hours != null ? `${alerts.avg_resolution_hours.toFixed(1)}h` : '—'}
              sub="Wastani wa masaa hadi kutatuliwa" />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Mgawanyo kwa Uzito</p>
            <div className="flex gap-4">
              {alerts.critical > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                  <span className="text-sm font-bold text-red-700">{alerts.critical}</span>
                  <span className="text-xs text-gray-500">Muhimu</span>
                </div>
              )}
              {alerts.warning > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-400 flex-shrink-0" />
                  <span className="text-sm font-bold text-amber-700">{alerts.warning}</span>
                  <span className="text-xs text-gray-500">Tahadhari</span>
                </div>
              )}
              {alerts.info > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="text-sm font-bold text-blue-700">{alerts.info}</span>
                  <span className="text-xs text-gray-500">Taarifa</span>
                </div>
              )}
            </div>
            {alerts.most_common_metric && (
              <p className="text-xs text-gray-500 mt-3 border-t border-gray-100 pt-3">
                Tahadhari ya kawaida zaidi: <strong>{alerts.most_common_metric}</strong>
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── SOP Compliance ── */}
      <SectionHeader
        icon="📋"
        title="Uzingatiaji wa SOP"
        sub={`${sops.length} SOP za ndani — ${overdueSOPs.length} zinahitaji ukaguzi`}
      />
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-500 text-left">
              <th className="px-4 py-2.5">SOP</th>
              <th className="px-4 py-2.5">Idara</th>
              <th className="px-4 py-2.5">Mzunguko</th>
              <th className="px-4 py-2.5">Ilipitiwa Mara ya Mwisho</th>
              <th className="px-4 py-2.5">Hali</th>
            </tr>
          </thead>
          <tbody>
            {sops.map(sop => (
              <tr key={sop.slug} className={`border-b border-gray-50 ${sop.is_overdue ? 'bg-amber-50' : ''}`}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800 text-xs">{sop.title}</p>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 capitalize">{sop.owner_role ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {sop.review_frequency ? REVIEW_FREQ_LABELS[sop.review_frequency] ?? sop.review_frequency : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {sop.last_reviewed_at ? fmtDate(sop.last_reviewed_at) : <span className="text-amber-600">Haijawahi</span>}
                </td>
                <td className="px-4 py-3">
                  {sop.is_overdue ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                      ⚠ Kagua
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                      ✓ Sawa
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {sops.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-xs">
                  Hakuna SOP za ndani. Unda SOP kwenye /admin/knowledge.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  type Period = 'weekly' | 'monthly'

  const todayISO  = new Date().toISOString().split('T')[0]

  const [period,   setPeriod]   = useState<Period>('weekly')
  const [date,     setDate]     = useState(todayISO)
  const [report,   setReport]   = useState<ReviewReport | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function load(force = false) {
    setLoading(true); setError('')
    const params = new URLSearchParams({ period, date })
    if (force) params.set('force', '1')
    const res  = await fetch(`/api/v1/admin/period-report?${params}`)
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Hitilafu'); setLoading(false); return }
    setReport(data.report)
    setLoading(false)
  }

  function handlePrint() {
    window.print()
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #report-content, #report-content * { visibility: visible; }
          #report-content { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">

          {/* Page header */}
          <div className="mb-6 flex items-start justify-between gap-4 flex-wrap no-print">
            <div>
              <h1 className="text-xl font-bold text-gray-900">📊 Ripoti za Kipindi</h1>
              <p className="text-sm text-gray-500 mt-1">
                Muhtasari wa wiki au mwezi — biashara, uendeshaji, tahadhari, na uzingatiaji wa SOP.
              </p>
            </div>
            {report && (
              <button onClick={handlePrint}
                className="px-4 py-2 bg-gray-800 text-white rounded-xl text-sm font-medium hover:bg-gray-700">
                🖨 Chapisha / PDF
              </button>
            )}
          </div>

          {/* Controls */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 no-print">
            <div className="flex flex-wrap gap-3 items-end">
              {/* Period toggle */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">Kipindi</p>
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                  {(['weekly', 'monthly'] as Period[]).map(p => (
                    <button key={p} onClick={() => setPeriod(p)}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                        period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                      }`}>
                      {p === 'weekly' ? 'Wiki' : 'Mwezi'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date picker */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">Tarehe ya Mwisho</p>
                <input
                  type="date"
                  value={date}
                  max={todayISO}
                  onChange={e => setDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <button
                onClick={() => load(false)}
                disabled={loading}
                className="px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? '⟳ Inaunda...' : 'Unda Ripoti'}
              </button>

              {report && (
                <button onClick={() => load(true)} disabled={loading}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 disabled:opacity-50">
                  ↺ Unda Upya
                </button>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="bg-white border border-gray-200 rounded-xl p-8 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Inakusanya data...</p>
            </div>
          )}

          {/* Report */}
          {!loading && report && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <ReportView report={report} />
            </div>
          )}

          {/* Empty state */}
          {!loading && !report && !error && (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <p className="text-4xl mb-3">📊</p>
              <p className="font-semibold text-gray-800">Chagua kipindi kisha bonyeza &ldquo;Unda Ripoti&rdquo;</p>
              <p className="text-sm text-gray-500 mt-1">
                Ripoti inakusanya data yote ya biashara, uendeshaji, na uzingatiaji wa SOP.
              </p>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
