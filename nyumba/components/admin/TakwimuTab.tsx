'use client'

interface MonthRevenue {
  label: string
  income: number
  net: number
  fees: number
  subscription: number
  unlock: number
  boost: number
  extra: number
}

interface AnalyticsData {
  revenueByMonth:  MonthRevenue[]
  totals:          Record<string, number>
  growth:          number
  thisMonthIncome: number
  lastMonthIncome: number
  mrr:             number
  subscriptions: {
    active: number; basic: number; premium: number; enterprise: number
    newThisMonth: number; churnedThisMonth: number; retentionRate: number
    expiringSoon: number; totalUnique: number
  }
  unlocks: {
    total: number; thisMonth: number; lastMonth: number
    topListings: { id: string; type: string; district: string; region: string; count: number }[]
  }
  topRegions: { region: string; revenue: number; count: number }[]
  expenses:   { thisMonth: number; recurring: number; profit: number }
}

const fmtTsh = (n: number) => n >= 1_000_000
  ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(0)}k` : String(n)

const fmtFull = (n: number) =>
  'Tsh ' + Math.round(n).toLocaleString('en-TZ')

function Kpi({ icon, label, value, sub, accent }: { icon: string; label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-3.5 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
        <i className={`ti ti-${icon} text-lg`} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-400 truncate">{label}</p>
        <p className="text-sm font-bold text-gray-900 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-[10px] text-gray-400 truncate">{sub}</p>}
      </div>
    </div>
  )
}

// Inline SVG bar chart — no dependencies
function BarChart({ data }: { data: MonthRevenue[] }) {
  const maxVal = Math.max(...data.map(d => d.income), 1)
  const H = 80

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: data.length * 40 }} className="flex items-end gap-1 h-24 px-1">
        {data.map((d, i) => {
          const barH = Math.max(4, Math.round((d.income / maxVal) * H))
          const isLast = i === data.length - 1
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group">
              <div className="relative flex flex-col items-center w-full">
                {/* tooltip */}
                <div className="absolute bottom-full mb-1 bg-gray-900 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                  {fmtFull(d.income)}
                </div>
                <div
                  style={{ height: barH }}
                  className={`w-full rounded-t-md transition-all ${isLast ? 'bg-primary-500' : 'bg-primary-200'}`}
                />
              </div>
              <span className="text-[8px] text-gray-400 truncate w-full text-center">{d.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Source breakdown horizontal bars
function SourceBar({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-800">{fmtFull(amount)} <span className="text-gray-400 font-normal">({pct}%)</span></span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function TakwimuTab({ analytics, loading }: { analytics: AnalyticsData | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1,2,3].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
            <div className="h-3 bg-gray-100 rounded w-24 mb-3" />
            <div className="h-20 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        <i className="ti ti-chart-bar text-3xl block mb-2" aria-hidden="true" />
        Takwimu hazipatikani
      </div>
    )
  }

  const { revenueByMonth, totals, growth, thisMonthIncome, mrr, subscriptions, unlocks, topRegions, expenses } = analytics

  const growthPositive = growth >= 0
  const profitPositive = expenses.profit >= 0

  return (
    <div className="space-y-4 pb-6">

      {/* ── Expiry warning ── */}
      {subscriptions.expiringSoon > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <i className="ti ti-alert-triangle text-amber-500" aria-hidden="true" />
          <span className="text-xs text-amber-700">
            <strong>{subscriptions.expiringSoon}</strong> subscription{subscriptions.expiringSoon > 1 ? 's' : ''} zinaisha siku 7 zijazo
          </span>
        </div>
      )}

      {/* ── Top KPIs ── */}
      <div className="grid grid-cols-2 gap-2.5">
        <Kpi icon="chart-line" label="Mapato Mwezi Huu"
          value={fmtFull(thisMonthIncome)}
          sub={`${growthPositive ? '↑' : '↓'} ${Math.abs(growth).toFixed(1)}% mwezi uliopita`}
          accent={growthPositive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'} />
        <Kpi icon="currency" label="MRR (Mapato ya Kila Mwezi)"
          value={fmtFull(mrr)}
          sub={`${subscriptions.active} subs active`}
          accent="bg-primary-100 text-primary-600" />
        <Kpi icon="users" label="Retention Rate"
          value={`${subscriptions.retentionRate}%`}
          sub={`${subscriptions.totalUnique} madalali waliowahi kulipa`}
          accent="bg-purple-100 text-purple-600" />
        <Kpi icon="lock-open" label="Unlocks Mwezi Huu"
          value={String(unlocks.thisMonth)}
          sub={`Jumla: ${unlocks.total} zote`}
          accent="bg-blue-100 text-blue-600" />
      </div>

      {/* ── P&L this month ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-1.5">
          <i className="ti ti-scale text-primary-500" aria-hidden="true" />
          Faida na Hasara — Mwezi Huu
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] text-gray-400">Mapato</p>
            <p className="text-sm font-bold text-green-600">{fmtTsh(thisMonthIncome)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400">Matumizi</p>
            <p className="text-sm font-bold text-red-500">{fmtTsh(expenses.thisMonth)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400">Faida</p>
            <p className={`text-sm font-bold ${profitPositive ? 'text-primary-600' : 'text-red-500'}`}>
              {profitPositive ? '+' : ''}{fmtTsh(expenses.profit)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Revenue bar chart ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-1.5">
          <i className="ti ti-chart-bar text-primary-500" aria-hidden="true" />
          Mwenendo wa Mapato — Miezi 12
        </p>
        <BarChart data={revenueByMonth} />
        <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary-500 inline-block" />Mwezi huu</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary-200 inline-block" />Miezi iliyopita</span>
        </div>
      </div>

      {/* ── Revenue breakdown ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
          <i className="ti ti-chart-pie text-primary-500" aria-hidden="true" />
          Chanzo cha Mapato (Jumla)
        </p>
        <SourceBar label="Subscriptions"    amount={totals.subscription ?? 0}    total={totals.total} color="bg-primary-500" />
        <SourceBar label="Contact Unlocks"  amount={totals.contact_unlock ?? 0}  total={totals.total} color="bg-blue-500" />
        <SourceBar label="Boost Listings"   amount={totals.boost_listing ?? 0}   total={totals.total} color="bg-purple-500" />
        <SourceBar label="Extra Listings"   amount={totals.extra_listing ?? 0}   total={totals.total} color="bg-amber-500" />
      </div>

      {/* ── Subscription breakdown ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-1.5">
          <i className="ti ti-crown text-primary-500" aria-hidden="true" />
          Subscriptions Active
        </p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Basic',      count: subscriptions.basic,      color: 'bg-blue-50 text-blue-700 border-blue-100' },
            { label: 'Premium',    count: subscriptions.premium,    color: 'bg-purple-50 text-purple-700 border-purple-100' },
            { label: 'Enterprise', count: subscriptions.enterprise, color: 'bg-amber-50 text-amber-700 border-amber-100' },
          ].map(p => (
            <div key={p.label} className={`rounded-xl border p-2.5 text-center ${p.color}`}>
              <p className="text-lg font-bold">{p.count}</p>
              <p className="text-[10px] font-medium">{p.label}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-green-50 rounded-xl p-2.5 text-center border border-green-100">
            <p className="text-base font-bold text-green-700">+{subscriptions.newThisMonth}</p>
            <p className="text-[10px] text-green-600">Mpya mwezi huu</p>
          </div>
          <div className="bg-red-50 rounded-xl p-2.5 text-center border border-red-100">
            <p className="text-base font-bold text-red-600">-{subscriptions.churnedThisMonth}</p>
            <p className="text-[10px] text-red-500">Walioacha mwezi huu</p>
          </div>
        </div>
      </div>

      {/* ── Top regions ── */}
      {topRegions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-1.5">
            <i className="ti ti-map-pin text-primary-500" aria-hidden="true" />
            Maeneo Yanayofanya Vizuri (Unlocks)
          </p>
          <div className="space-y-2.5">
            {topRegions.map((r, i) => {
              const maxRev = topRegions[0]?.revenue ?? 1
              const pct    = Math.round((r.revenue / maxRev) * 100)
              return (
                <div key={r.region} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 w-4 text-right flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-700 font-medium truncate">{r.region}</span>
                      <span className="text-gray-500 flex-shrink-0 ml-2">{r.count} unlocks · {fmtFull(r.revenue)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Top listings ── */}
      {unlocks.topListings.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-1.5">
            <i className="ti ti-home-heart text-primary-500" aria-hidden="true" />
            Listings Zinazovutia Zaidi
          </p>
          <div className="space-y-2">
            {unlocks.topListings.map((l, i) => (
              <div key={l.id} className="flex items-center gap-2.5">
                <span className="text-[10px] font-bold text-primary-500 w-4 flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 truncate capitalize">{l.type} · {l.district}</p>
                  <p className="text-[10px] text-gray-400">{l.region}</p>
                </div>
                <span className="text-xs font-bold text-primary-600 flex-shrink-0 bg-primary-50 rounded-lg px-2 py-0.5">{l.count} unlocks</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Summary: where we win/lose ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-1.5">
          <i className="ti ti-bulb text-amber-500" aria-hidden="true" />
          Muhtasari wa Biashara
        </p>
        <div className="space-y-2">
          {[
            {
              icon: growthPositive ? 'trending-up' : 'trending-down',
              color: growthPositive ? 'text-green-600' : 'text-red-500',
              bg: growthPositive ? 'bg-green-50' : 'bg-red-50',
              text: growthPositive
                ? `Mapato yameongezeka ${Math.abs(growth).toFixed(1)}% ikilinganishwa na mwezi uliopita`
                : `Mapato yamepungua ${Math.abs(growth).toFixed(1)}% ikilinganishwa na mwezi uliopita`,
            },
            {
              icon: 'users',
              color: 'text-purple-600',
              bg: 'bg-purple-50',
              text: `Retention rate: ${subscriptions.retentionRate}% — ${subscriptions.retentionRate >= 60 ? 'Madalali wanabaki vizuri' : 'Dalali wengi hawafanyi renewal — angalia bei au maudhui'}`,
            },
            {
              icon: 'lock-open',
              color: 'text-blue-600',
              bg: 'bg-blue-50',
              text: unlocks.thisMonth >= (unlocks.lastMonth ?? 0)
                ? `Unlocks zimeongezeka mwezi huu (${unlocks.thisMonth} vs ${unlocks.lastMonth} mwezi uliopita)`
                : `Unlocks zimepungua mwezi huu (${unlocks.thisMonth} vs ${unlocks.lastMonth} mwezi uliopita) — angalia listings na ubora`,
            },
            {
              icon: profitPositive ? 'coin' : 'alert-circle',
              color: profitPositive ? 'text-primary-600' : 'text-red-500',
              bg: profitPositive ? 'bg-primary-50' : 'bg-red-50',
              text: profitPositive
                ? `Faida ya mwezi huu: ${fmtFull(expenses.profit)} — biashara inafanya vizuri`
                : `Hasara ya mwezi huu: ${fmtFull(Math.abs(expenses.profit))} — angalia matumizi`,
            },
          ].map((item, i) => (
            <div key={i} className={`flex items-start gap-2.5 rounded-xl p-2.5 ${item.bg}`}>
              <i className={`ti ti-${item.icon} text-base mt-0.5 flex-shrink-0 ${item.color}`} aria-hidden="true" />
              <p className={`text-xs ${item.color}`}>{item.text}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
