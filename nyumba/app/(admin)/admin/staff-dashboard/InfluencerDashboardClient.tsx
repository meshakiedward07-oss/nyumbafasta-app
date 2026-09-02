'use client'
import { useState, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

type InfluencerProfile = {
  userId: string
  fullName: string | null
  referralCode: string
  isActive: boolean
  socialHandle: string | null
  platform: string | null
  createdAt: string
}

type Referral = {
  id: string
  referredUserId: string
  fullName: string | null
  referralCode: string
  signedUpAt: string
}

type PayoutStage = {
  id: string
  referredUserId: string
  referredName: string | null
  stage: number
  stageLabel: string
  amountTzs: number
  status: 'hold' | 'earned' | 'paid'
  holdUntil: string | null
  triggeredAt: string
  paidAt: string | null
}

type PayoutSummary = {
  totalEarned: number
  totalPaid: number
  totalPending: number
  balance: number
}

const APP_URL = 'https://www.nyumbafasta.co'

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `Tsh ${n.toLocaleString('sw-TZ')}`
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (d < 3600)  return `${Math.floor(d / 60)}dk`
  if (d < 86400) return `${Math.floor(d / 3600)}saa`
  return `${Math.floor(d / 86400)} siku`
}

const STATUS_STYLE: Record<string, string> = {
  hold:   'bg-amber-50 text-amber-700 border-amber-200',
  earned: 'bg-green-50 text-green-700 border-green-200',
  paid:   'bg-blue-50 text-blue-700 border-blue-200',
}
const STATUS_LABEL: Record<string, string> = {
  hold:   'Hold',
  earned: 'Imepatikana',
  paid:   'Imelipwa',
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function InfluencerDashboardClient() {
  const [profile,  setProfile]  = useState<InfluencerProfile | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [payouts,  setPayouts]  = useState<PayoutStage[]>([])
  const [summary,  setSummary]  = useState<PayoutSummary | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [copied,   setCopied]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [profileRes, referralsRes, payoutsRes] = await Promise.all([
        fetch('/api/v1/influencer/me'),
        fetch('/api/v1/influencer/me/referrals'),
        fetch('/api/v1/influencer/me/payouts'),
      ])
      if (profileRes.ok)   { const j = await profileRes.json();   setProfile(j.influencer) }
      if (referralsRes.ok) { const j = await referralsRes.json(); setReferrals(j.referrals ?? []) }
      if (payoutsRes.ok)   { const j = await payoutsRes.json();   setPayouts(j.payouts ?? []); setSummary(j.summary ?? null) }
    } catch { /* silent */ }
    finally  { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function copyLink() {
    if (!profile) return
    // role=dalali — this program refers dalali specifically (every payout
    // stage is tied to a dalali action: signup, listing approval, etc. —
    // see lib/influencer/payoutTriggers.ts). Without it the link defaulted
    // to role=client (register/page.tsx's fallback), so a referred dalali
    // had to manually re-select "Dalali" on step 1. Found 2026-09-02.
    const link = `${APP_URL}/register?role=dalali&ref=${profile.referralCode}`
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const referralLink = profile ? `${APP_URL}/register?role=dalali&ref=${profile.referralCode}` : ''

  // Build a map of referredUserId → their earned payout stages
  const payoutMap: Record<string, PayoutStage[]> = {}
  for (const p of payouts) {
    if (!payoutMap[p.referredUserId]) payoutMap[p.referredUserId] = []
    payoutMap[p.referredUserId].push(p)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
          <i className="ti ti-users-group text-xl text-pink-600" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            {profile?.fullName ?? 'Brand Ambassador'}
          </h1>
          <p className="text-xs text-gray-400">Influencer Dashboard</p>
        </div>
      </div>

      {/* ── Referral link card ── */}
      <div className="bg-gradient-to-br from-pink-50 to-fuchsia-50 border border-pink-100 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-semibold text-pink-700 uppercase tracking-wider">Kiungo Chako cha Rufaa</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white border border-pink-200 rounded-xl px-3 py-2 text-sm font-mono text-gray-700 truncate select-all">
            {referralLink}
          </div>
          <button
            onClick={copyLink}
            className="flex-shrink-0 px-3 py-2 bg-pink-500 text-white text-sm rounded-xl active:opacity-80 transition-opacity"
          >
            {copied ? <i className="ti ti-check" /> : <i className="ti ti-copy" />}
          </button>
        </div>
        <p className="text-xs text-pink-600">
          Kiungo hiki kikitumiwa na dalali mpya kusajili, utapata zawadi mara anapotimiza masharti.
        </p>
      </div>

      {/* ── Earnings summary ── */}
      {summary && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">Jumla Imepatikana</p>
            <p className="text-lg font-bold text-green-600">{fmt(summary.totalEarned)}</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">Salio (Haijalipiwa)</p>
            <p className="text-lg font-bold text-gray-800">{fmt(summary.balance)}</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">Imesimamishwa (Hold)</p>
            <p className="text-lg font-bold text-amber-600">{fmt(summary.totalPending)}</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">Imelipwa</p>
            <p className="text-lg font-bold text-blue-600">{fmt(summary.totalPaid)}</p>
          </div>
        </div>
      )}

      {/* ── Referrals list ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Wasajili Wako ({referrals.length})</h2>
          <button onClick={load} className="text-xs text-primary-500">
            <i className="ti ti-refresh" />
          </button>
        </div>

        {referrals.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            Bado hakuna mtu aliyesajili kupitia kiungo chako.
          </div>
        ) : (
          <div className="space-y-3">
            {referrals.map(r => {
              const stages = payoutMap[r.referredUserId] ?? []
              return (
                <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{r.fullName ?? 'Mtumiaji'}</p>
                      <p className="text-xs text-gray-400">Alisajili {timeAgo(r.signedUpAt)} iliyopita</p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(r.signedUpAt).toLocaleDateString('sw-TZ')}
                    </span>
                  </div>

                  {/* Payout stage badges for this referral */}
                  {stages.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-gray-50">
                      {[1, 2, 3].map(stageNum => {
                        const stage = stages.find(s => s.stage === stageNum)
                        if (!stage) {
                          return (
                            <span key={stageNum} className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-300 border border-gray-100">
                              Stage {stageNum}
                            </span>
                          )
                        }
                        return (
                          <span
                            key={stageNum}
                            className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[stage.status]}`}
                          >
                            S{stageNum} · {fmt(stage.amountTzs)} · {STATUS_LABEL[stage.status]}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── How it works ── */}
      <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Jinsi Inavyofanya Kazi</p>
        {[
          { stage: 1, amt: 'Tsh 300', desc: 'Dalali anapoidhinishwa listings 3 za kwanza' },
          { stage: 2, amt: 'Tsh 700', desc: 'Dalali analipa subscription yake ya kwanza' },
          { stage: 3, amt: 'Tsh 1,000', desc: 'Dalali analipa subscription yake ya pili' },
        ].map(s => (
          <div key={s.stage} className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-pink-100 text-pink-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
              {s.stage}
            </div>
            <div className="flex-1">
              <span className="text-sm font-semibold text-gray-800">{s.amt}</span>
              <span className="text-xs text-gray-500"> — {s.desc}</span>
            </div>
          </div>
        ))}
        <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
          Masharti yote lazima yatimizwe ndani ya siku 100 tangu dalali asajili.
          Malipo huthibitishwa na admin.
        </p>
      </div>

    </div>
  )
}
