'use client'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type {
  AdminListing, AdminUser, AdminUnlock, AdminSubscription,
  AdminVerification, AdminDalaliDetailed, AdminClientDetailed,
} from '@/app/(admin)/admin/page'
import { PLAN_BADGES, getPlan } from '@/lib/config/subscription-plans'

const WA_PATH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z'

function waNum(raw: string) { return raw.replace(/[^0-9]/g, '') }

type Tab = 'overview' | 'listings' | 'users' | 'mapato' | 'verify' | 'reports'
type UserSubTab = 'all' | 'madalali' | 'wateja'

type Stats = {
  pendingCount: number
  activeCount: number
  totalListings: number
  totalUsers: number
  clientCount: number
  dalaliCount: number
  verifiedCount: number
  premiumCount: number
  totalUnlockRevenue: number
  totalSubRevenue: number
  totalBoostRevenue: number
  totalRevenue: number
  unlocksCount: number
  activeBoostsCount: number
  activeTrials?: number
  expiredTrials?: number
  convertedTrials?: number
  totalTrials?: number
}

type ReportItem = {
  id: string
  reason: string
  details: string | null
  status: string
  created_at: string
  reporter: { id: string; full_name: string } | null
  dalali: {
    id: string
    full_name: string
    email: string | null
    dalali_profiles: { whatsapp_number: string | null } | null
  } | null
  listing: { id: string; title: string; type: string; district: string } | null
}

type Props = {
  pendingListings: AdminListing[]
  allListings: AdminListing[]
  users: AdminUser[]
  unlocks: AdminUnlock[]
  subscriptions: AdminSubscription[]
  pendingVerifications: AdminVerification[]
  madalaliDetailed: AdminDalaliDetailed[]
  watejaDetailed: AdminClientDetailed[]
  savedListings: { client_id: string }[]
  stats: Stats
  reports?: ReportItem[]
  regionStats?: [string, number][]
  initialTab?: Tab
}

const typeLabel: Record<string, string> = {
  chumba: 'Chumba', apartment: 'Apartment', nyumba: 'Nyumba', studio: 'Studio',
}

function formatTsh(n: number) {
  if (n >= 1_000_000) return `Tsh ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `Tsh ${(n / 1_000).toFixed(0)}k`
  return `Tsh ${n}`
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `dakika ${mins} zilizopita`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `saa ${hrs} zilizopita`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `siku ${days} zilizopita`
  return new Date(dateStr).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

function VerifBadge({ status }: { status?: string | null }) {
  if (status === 'approved') return <span className="text-[10px] bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded-full font-medium">✓ Verified</span>
  if (status === 'pending')  return <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">⏳ Pending</span>
  return <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full font-medium">✗ None</span>
}

function SubBadge({ subscriptions }: { subscriptions: AdminDalaliDetailed['subscriptions'] }) {
  const active = subscriptions?.find(s => s.status === 'active')
  if (!active) return <span className="text-[10px] text-gray-400">Hakuna</span>
  const badge = PLAN_BADGES[active.plan] ?? PLAN_BADGES['free']
  const plan  = getPlan(active.plan)
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white"
      style={{ backgroundColor: badge.color }}>
      {plan.emoji} {badge.label}
    </span>
  )
}

export default function AdminDashboard({
  pendingListings, allListings, users, unlocks, subscriptions,
  pendingVerifications, madalaliDetailed, watejaDetailed, savedListings, stats, reports = [], regionStats = [],
  initialTab = 'overview',
}: Props) {
  const router = useRouter()

  // ── Main tabs ─────────────────────────────────────────
  const [tab, setTab]   = useState<Tab>(initialTab)
  const [listings, setListings] = useState(pendingListings)
  const [listingStatusFilter, setListingStatusFilter] = useState<string>('pending')
  const [loadingId, setLoadingId]   = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  // ── Verification ──────────────────────────────────────
  const [verifications, setVerifications] = useState(pendingVerifications)
  const [rejectReason, setRejectReason]   = useState('')
  const [verifyLoading, setVerifyLoading] = useState<string | null>(null)

  // ── Users tab ─────────────────────────────────────────
  const [userSubTab, setUserSubTab] = useState<UserSubTab>('all')
  const [userSearch, setUserSearch] = useState('')
  const [madalaliList, setMadalaliList] = useState(madalaliDetailed)
  const [watejaList, setWatejaList]     = useState(watejaDetailed)
  const [userActionLoading, setUserActionLoading] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId]     = useState<string | null>(null)
  const [deleteReason, setDeleteReason]           = useState('')
  const [deleteNotify, setDeleteNotify]           = useState(true)
  const [reportsList, setReportsList]             = useState<ReportItem[]>(reports)
  const [reportActionLoading, setReportActionLoading] = useState<string | null>(null)
  const [cronRunning, setCronRunning]             = useState(false)
  const [cronResults, setCronResults]             = useState<string[]>([])
  const [cronErrors, setCronErrors]               = useState<string[]>([])
  const [cronLastRun, setCronLastRun]             = useState<string | null>(null)

  // ── Derived counts ───────────────────────────────────
  const dalaliListingCounts = useMemo(() => {
    const m: Record<string, number> = {}
    allListings.forEach(l => { if (l.dalali?.id) m[l.dalali.id] = (m[l.dalali.id] ?? 0) + 1 })
    return m
  }, [allListings])

  const clientUnlockCounts = useMemo(() => {
    const m: Record<string, number> = {}
    unlocks.forEach(u => { if (u.client_id) m[u.client_id] = (m[u.client_id] ?? 0) + 1 })
    return m
  }, [unlocks])

  const clientSavedCounts = useMemo(() => {
    const m: Record<string, number> = {}
    savedListings.forEach(s => { if (s.client_id) m[s.client_id] = (m[s.client_id] ?? 0) + 1 })
    return m
  }, [savedListings])

  // ── Revenue chart — computed client-only to avoid hydration mismatch ────
  const [revenueByDay, setRevenueByDay] = useState<{ key: string; label: string; amount: number }[]>([])
  const [maxRevDay, setMaxRevDay]       = useState(1)

  useEffect(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const key = d.toISOString().slice(0, 10)
      const amount = unlocks
        .filter(u => u.created_at.slice(0, 10) === key)
        .reduce((sum, u) => sum + u.amount_paid, 0)
      return { key, label: d.toLocaleDateString('sw-TZ', { weekday: 'short' }), amount }
    })
    setRevenueByDay(days)
    setMaxRevDay(Math.max(...days.map(r => r.amount), 1))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Approve / Reject listing ─────────────────────────
  async function handleAction(id: string, action: 'approve' | 'reject') {
    setLoadingId(id)
    setActionError('')
    try {
      const res = await fetch(`/api/v1/admin/listings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Imeshindwa')
      setListings(prev => prev.filter(l => l.id !== id))
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Hitilafu imetokea')
    } finally {
      setLoadingId(null)
    }
  }

  // ── Suspend / Activate user ──────────────────────────
  async function handleUserAction(userId: string, action: 'suspend' | 'activate') {
    setUserActionLoading(userId)
    setActionError('')
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Imeshindwa')
      const isActive = action === 'activate'
      setMadalaliList(prev => prev.map(u => u.id === userId ? { ...u, is_active: isActive } : u))
      setWatejaList(prev => prev.map(u => u.id === userId ? { ...u, is_active: isActive } : u))
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Hitilafu imetokea')
    } finally {
      setUserActionLoading(null)
    }
  }

  // ── Delete user ──────────────────────────────────────
  async function handleUserDelete(userId: string) {
    setUserActionLoading(userId)
    setConfirmDeleteId(null)
    setActionError('')
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason || 'Admin deletion', notify: deleteNotify }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Imeshindwa')
      setMadalaliList(prev => prev.filter(u => u.id !== userId))
      setWatejaList(prev => prev.filter(u => u.id !== userId))
      setDeleteReason('')
      setDeleteNotify(true)
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Hitilafu imetokea')
    } finally {
      setUserActionLoading(null)
    }
  }

  // ── Run cron manually ────────────────────────────────
  async function runCron(type: 'daily' | 'hourly' = 'daily') {
    setCronRunning(true)
    setCronResults([])
    setCronErrors([])
    try {
      const res = await fetch('/api/v1/admin/run-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cron: type }),
      })
      const data = await res.json()
      setCronResults(data.results ?? [])
      setCronErrors(data.errors ?? [])
      setCronLastRun(new Date().toLocaleTimeString('sw-TZ'))
    } catch (err) {
      setCronErrors([`Hitilafu: ${String(err)}`])
    } finally {
      setCronRunning(false)
    }
  }

  // ── Mark report reviewed/dismissed ───────────────────
  async function handleReportAction(reportId: string, status: 'reviewed' | 'dismissed') {
    setReportActionLoading(reportId)
    try {
      await fetch('/api/v1/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: reportId, status }),
      })
      setReportsList(prev => prev.map(r => r.id === reportId ? { ...r, status } : r))
    } finally {
      setReportActionLoading(null)
    }
  }

  // ── Users tab filtered lists ─────────────────────────
  const q = userSearch.toLowerCase()
  const filteredMadalali = madalaliList.filter(u =>
    !q || u.full_name.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)
  )
  const filteredWateja = watejaList.filter(u =>
    !q || u.full_name.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)
  )
  const filteredAll = users.filter(u =>
    !q || u.full_name.toLowerCase().includes(q) || (u.phone ?? '').includes(q)
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* ── Header — hidden on desktop (AdminShell sidebar provides branding) ── */}
      <div className="bg-primary-800 px-4 pt-10 pb-5 lg:hidden">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-white text-xl font-bold">⚙️ Admin Panel</h1>
            <p className="text-green-200 text-xs mt-0.5">NyumbaFasta · Usimamizi wa Mfumo</p>
          </div>
          <button onClick={() => router.push('/')} className="text-green-200 text-xs hover:text-white">
            ← Tovuti
          </button>
        </div>
      </div>

      {/* ── Desktop page title ── */}
      <div className="hidden lg:flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white">
        <div>
          <h1 className="text-xl font-bold text-gray-900">⚙️ Dashboard</h1>
          <p className="text-xs text-gray-400 mt-0.5">NyumbaFasta · Usimamizi wa Mfumo</p>
        </div>
      </div>

      {/* ── Main tab nav ── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex overflow-x-auto scrollbar-none">
          {([
            { key: 'overview', label: 'Muhtasari',                                                          icon: '📊' },
            { key: 'listings', label: `Zinasubiri (${listings.length})`,                                  icon: '🏠' },
            { key: 'verify',   label: `Uthibitisho (${verifications.length})`,                            icon: '🪪' },
            { key: 'users',    label: 'Watumiaji',                                                        icon: '👥' },
            { key: 'mapato',   label: 'Mapato',                                                           icon: '💰' },
            { key: 'reports',  label: `Ripoti (${reportsList.filter(r => r.status === 'pending').length})`, icon: '🚨' },
          ] as { key: Tab; label: string; icon: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-400'
              }`}
            >
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
          {/* External links — hidden on desktop (sidebar handles these) */}
          <div className="contents lg:hidden">
            <Link
              href="/admin/crm"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 border-transparent text-gray-400 hover:text-primary-600 transition-colors"
            >
              <span>🎯</span><span>CRM</span>
            </Link>
            <Link
              href="/admin/crm/analytics"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 border-transparent text-gray-400 hover:text-primary-600 transition-colors"
            >
              <span>📊</span><span>Analytics</span>
            </Link>
            <Link
              href="/admin/crm/assign"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 border-transparent text-gray-400 hover:text-primary-600 transition-colors"
            >
              <span>👥</span><span>Assign</span>
            </Link>
            <Link
              href="/admin/crm/reports"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 border-transparent text-gray-400 hover:text-primary-600 transition-colors"
            >
              <span>📋</span><span>Reports</span>
            </Link>
            <Link
              href="/admin/crm/commission"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 border-transparent text-gray-400 hover:text-primary-600 transition-colors"
            >
              <span>💼</span><span>Commission</span>
            </Link>
            <Link
              href="/admin/crm/templates"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 border-transparent text-gray-400 hover:text-primary-600 transition-colors"
            >
              <span>💬</span><span>WA Templates</span>
            </Link>
            <Link
              href="/admin/leads"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 border-transparent text-gray-400 hover:text-primary-600 transition-colors"
            >
              <span>🤖</span><span>Leads</span>
            </Link>
            <Link
              href="/admin/facebook-groups"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 border-transparent text-gray-400 hover:text-primary-600 transition-colors"
            >
              <span>👥</span><span>FB Groups</span>
            </Link>
            <Link
              href="/admin/instagram-profiles"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 border-transparent text-gray-400 hover:text-primary-600 transition-colors"
            >
              <span>📸</span><span>IG Profiles</span>
            </Link>
            <Link
              href="/admin/accounting"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 border-transparent text-gray-400 hover:text-primary-600 transition-colors"
            >
              <span>💰</span><span>Hesabu</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6 pt-4 space-y-4">

        {/* ══════════════════════════════════════════════
            TAB: Overview
        ══════════════════════════════════════════════ */}
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Zinasubiri',       value: stats.pendingCount,                icon: '⏳', urgent: stats.pendingCount > 0 },
                { label: 'Listings active',  value: stats.activeCount,                 icon: '✅', urgent: false },
                { label: 'Watumiaji',        value: stats.totalUsers,                  icon: '👥', urgent: false },
                { label: 'Mapato (unlocks)', value: formatTsh(stats.totalRevenue),     icon: '💰', urgent: false },
              ].map(s => (
                <div key={s.label} className={`rounded-2xl p-4 shadow-sm border ${s.urgent ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{s.icon}</span>
                    {s.urgent && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                  </div>
                  <p className={`text-2xl font-bold ${s.urgent ? 'text-amber-700' : 'text-gray-900'}`}>{s.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Mgawanyiko wa Watumiaji</h3>
              <div className="flex gap-4">
                <div className="flex-1 text-center bg-primary-50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-primary-700">{stats.clientCount}</p>
                  <p className="text-xs text-primary-500 mt-0.5">🔍 Wateja</p>
                </div>
                <div className="flex-1 text-center bg-amber-50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-amber-700">{stats.dalaliCount}</p>
                  <p className="text-xs text-amber-500 mt-0.5">🏢 Madalali</p>
                </div>
              </div>
            </div>

            {/* Region stats */}
            {regionStats.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-3">📍 Listings Kwa Mkoa (Top 10)</h3>
                <div className="space-y-2">
                  {regionStats.map(([region, count], i) => {
                    const maxCount = regionStats[0][1]
                    const pct = Math.round((count / maxCount) * 100)
                    return (
                      <div key={region}>
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-xs text-gray-600 truncate flex-1 mr-2">
                            {i + 1}. {region}
                          </span>
                          <span className="text-xs font-semibold text-gray-800 flex-shrink-0">{count}</span>
                        </div>
                        <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-primary-400 h-full rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {listings.length > 0 && (
              <button onClick={() => setTab('listings')}
                className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    {listings.length} listing{listings.length > 1 ? 's' : ''} zinasubiri idhini yako
                  </p>
                  <p className="text-xs text-amber-600">Bonyeza hapa kukagua →</p>
                </div>
              </button>
            )}

            {/* Trial stats */}
            {(stats.totalTrials ?? 0) > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-3">🎉 Trial Overview</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-primary-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-primary-700">{stats.activeTrials ?? 0}</p>
                    <p className="text-xs text-primary-500">Active trials</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-green-700">{stats.convertedTrials ?? 0}</p>
                    <p className="text-xs text-green-500">Walilipa ({stats.totalTrials ? Math.round(((stats.convertedTrials ?? 0) / stats.totalTrials) * 100) : 0}%)</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-red-600">{stats.expiredTrials ?? 0}</p>
                    <p className="text-xs text-red-400">Ziliisha bila kulipa</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-gray-700">{stats.totalTrials ?? 0}</p>
                    <p className="text-xs text-gray-400">Jumla ya trials</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Mapato Kwa Jumla</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Contact unlocks ({stats.unlocksCount})</span>
                  <span className="font-semibold text-gray-800">{formatTsh(stats.totalUnlockRevenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subscriptions</span>
                  <span className="font-semibold text-gray-800">{formatTsh(stats.totalSubRevenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">🚀 Boosts ({stats.activeBoostsCount} active)</span>
                  <span className="font-semibold text-gray-800">{formatTsh(stats.totalBoostRevenue)}</span>
                </div>
                <div className="border-t border-gray-100 pt-2 flex justify-between text-sm font-bold">
                  <span className="text-gray-700">Jumla</span>
                  <span className="text-primary-600">{formatTsh(stats.totalRevenue)}</span>
                </div>
              </div>
            </div>

            {/* ── Cron Jobs card ── */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-3">⚙️ Cron Jobs</h3>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Daily cron:</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    Kila siku 6 AM ✅
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Hourly cron:</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    Kila saa ✅
                  </span>
                </div>
                {cronLastRun && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Mara ya mwisho:</span>
                    <span className="text-xs text-gray-500">{cronLastRun}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => runCron('daily')}
                  disabled={cronRunning}
                  className="flex-1 bg-primary-50 text-primary-700 py-2.5 rounded-xl text-xs font-semibold
                             border border-primary-100 disabled:opacity-50 active:scale-[0.97] transition-all"
                >
                  {cronRunning ? (
                    <span className="flex items-center justify-center gap-1">
                      <span className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                      Inaendesha...
                    </span>
                  ) : '▶️ Run Daily Tasks'}
                </button>
                <button
                  onClick={() => runCron('hourly')}
                  disabled={cronRunning}
                  className="flex-1 bg-gray-50 text-gray-600 py-2.5 rounded-xl text-xs font-semibold
                             border border-gray-100 disabled:opacity-50 active:scale-[0.97] transition-all"
                >
                  ⚡ Run Hourly
                </button>
              </div>

              {cronResults.length > 0 && (
                <div className="space-y-1">
                  {cronResults.map((r, i) => (
                    <p key={i} className="text-xs text-gray-600">{r}</p>
                  ))}
                </div>
              )}
              {cronErrors.length > 0 && (
                <div className="space-y-1 mt-2">
                  {cronErrors.map((e, i) => (
                    <p key={i} className="text-xs text-red-500">{e}</p>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════
            TAB: Listings
        ══════════════════════════════════════════════ */}
        {tab === 'listings' && (
          <>
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
              {[
                { key: 'all',      label: `Zote (${allListings.length})` },
                { key: 'pending',  label: `Zinasubiri (${allListings.filter(l=>l.status==='pending').length})` },
                { key: 'active',   label: `Zinapatikana (${allListings.filter(l=>l.status==='active').length})` },
                { key: 'taken',    label: `Zimepangishwa (${allListings.filter(l=>l.status==='taken').length})` },
                { key: 'rejected', label: `Zilikataliwa (${allListings.filter(l=>l.status==='rejected').length})` },
                { key: 'expired',  label: `Zimeisha (${allListings.filter(l=>l.status==='expired').length})` },
              ].map(f => (
                <button key={f.key} onClick={() => setListingStatusFilter(f.key)}
                  className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                    listingStatusFilter === f.key ? 'bg-primary-500 text-white' : 'bg-white border border-gray-200 text-gray-600'
                  }`}>{f.label}</button>
              ))}
            </div>

            {actionError && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">{actionError}</div>
            )}

            {(() => {
              const filtered = listingStatusFilter === 'all' ? allListings : allListings.filter(l => l.status === listingStatusFilter)
              return filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="text-sm font-semibold text-gray-600">Hakuna listings katika filter hii</p>
                </div>
              ) : filtered.map(listing => (
                <div key={listing.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {listing.images?.length > 0 && (
                    <div className="flex gap-1 h-28 overflow-hidden">
                      {listing.images.slice(0, 3).map((src, i) => (
                        <div key={i} className="relative flex-1 overflow-hidden">
                          <Image fill src={src} alt="" className="object-cover" sizes="33vw" />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          {typeLabel[listing.type] || listing.type} — {listing.district}, {listing.region}
                        </p>
                        <p className="text-primary-600 font-bold text-sm" suppressHydrationWarning>
                          Tsh {listing.price_monthly.toLocaleString()} / mwezi
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0" suppressHydrationWarning>{timeAgo(listing.created_at)}</span>
                    </div>
                    {listing.description && (
                      <p className="text-xs text-gray-500 mb-2 leading-relaxed line-clamp-2">{listing.description}</p>
                    )}
                    {listing.amenities?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {listing.amenities.slice(0, 4).map(a => (
                          <span key={a} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{a}</span>
                        ))}
                        {listing.amenities.length > 4 && <span className="text-xs text-gray-400">+{listing.amenities.length - 4}</span>}
                      </div>
                    )}
                    <div className="bg-gray-50 rounded-xl p-2.5 mb-3 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold flex-shrink-0">
                        {listing.dalali?.full_name?.[0] ?? 'D'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{listing.dalali?.full_name}</p>
                        <p className="text-xs text-gray-400">{listing.dalali?.phone ?? '—'}</p>
                      </div>
                      {listing.dalali?.dalali_profiles?.is_premium_verified && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex-shrink-0">Premium</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAction(listing.id, 'reject')} disabled={loadingId === listing.id}
                        className="flex-1 py-2.5 rounded-xl border-2 border-red-200 text-red-600 text-sm font-semibold disabled:opacity-40 active:scale-95 transition-all">
                        {loadingId === listing.id ? '...' : '✕ Kataa'}
                      </button>
                      <button onClick={() => handleAction(listing.id, 'approve')} disabled={loadingId === listing.id}
                        className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold disabled:opacity-40 active:scale-95 transition-all">
                        {loadingId === listing.id ? '...' : '✓ Idhibiti'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            })()}
          </>
        )}

        {/* ══════════════════════════════════════════════
            TAB: Verification
        ══════════════════════════════════════════════ */}
        {tab === 'verify' && (
          <div className="space-y-4">
            {verifications.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                <div className="text-4xl mb-2">✅</div>
                <p className="text-sm text-gray-500">Hakuna maombi ya uthibitisho yanayosubiri</p>
              </div>
            ) : verifications.map(v => (
              <VerifyCard
                key={v.user_id}
                v={v}
                loading={verifyLoading === v.user_id}
                rejectReason={rejectReason}
                onRejectReasonChange={setRejectReason}
                onApprove={async () => {
                  setVerifyLoading(v.user_id)
                  await fetch('/api/v1/admin/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dalali_user_id: v.user_id, action: 'approve' }),
                  })
                  setVerifications(prev => prev.filter(x => x.user_id !== v.user_id))
                  setVerifyLoading(null)
                }}
                onReject={async () => {
                  if (!rejectReason.trim()) return
                  setVerifyLoading(v.user_id)
                  await fetch('/api/v1/admin/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dalali_user_id: v.user_id, action: 'reject', reason: rejectReason }),
                  })
                  setVerifications(prev => prev.filter(x => x.user_id !== v.user_id))
                  setRejectReason('')
                  setVerifyLoading(null)
                }}
              />
            ))}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: Users (redesigned)
        ══════════════════════════════════════════════ */}
        {tab === 'users' && (
          <>
            {/* Stats bar */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Madalali', value: stats.dalaliCount,   bg: 'bg-amber-50',   text: 'text-amber-700'   },
                { label: 'Verified', value: stats.verifiedCount, bg: 'bg-primary-50', text: 'text-primary-700' },
                { label: 'Premium',  value: stats.premiumCount,  bg: 'bg-yellow-50',  text: 'text-yellow-700'  },
                { label: 'Wateja',   value: stats.clientCount,   bg: 'bg-blue-50',    text: 'text-blue-700'    },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-2xl p-3 text-center`}>
                  <p className={`text-xl font-bold ${s.text}`}>{s.value}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Sub-tabs */}
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
              {([
                { key: 'all',      label: `Wote (${madalaliList.length + watejaList.length})` },
                { key: 'madalali', label: `Madalali (${madalaliList.length})` },
                { key: 'wateja',   label: `Wateja (${watejaList.length})` },
              ] as { key: UserSubTab; label: string }[]).map(t => (
                <button key={t.key} onClick={() => setUserSubTab(t.key)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                    userSubTab === t.key ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input
                type="text"
                placeholder={userSubTab === 'all' ? 'Tafuta jina, simu...' : 'Tafuta jina au email...'}
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>

            {actionError && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">{actionError}</div>
            )}

            {/* ── TAB: WOTE ── */}
            {userSubTab === 'all' && (
              <div className="space-y-2">
                {filteredAll.length === 0 && (
                  <p className="text-center py-8 text-sm text-gray-400">Hakuna watumiaji wanaolingana</p>
                )}
                {filteredAll.map(user => (
                  <div key={user.id} className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-3 shadow-sm">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      user.role === 'admin'  ? 'bg-red-100 text-red-700' :
                      user.role === 'dalali' ? 'bg-amber-100 text-amber-700' :
                                              'bg-primary-100 text-primary-700'
                    }`}>
                      {user.full_name?.[0] ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{user.full_name}</p>
                      <p className="text-xs text-gray-400 truncate">{user.phone ?? '—'}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        user.role === 'admin'  ? 'bg-red-50 text-red-600' :
                        user.role === 'dalali' ? 'bg-amber-50 text-amber-700' :
                                                'bg-blue-50 text-blue-700'
                      }`}>
                        {user.role === 'admin' ? '🛡️ Admin' : user.role === 'dalali' ? '🏢 Dalali' : '🔍 Mteja'}
                      </span>
                      <p className="text-xs text-gray-300 mt-0.5" suppressHydrationWarning>{timeAgo(user.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── TAB: MADALALI ── */}
            {userSubTab === 'madalali' && (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Dalali</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">Email</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">WhatsApp</th>
                        <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Verified</th>
                        <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Sub</th>
                        <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Listings</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">Alijiunga</th>
                        <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredMadalali.length === 0 && (
                        <tr><td colSpan={8} className="text-center py-8 text-sm text-gray-400">Hakuna madalali wanaolingana</td></tr>
                      )}
                      {filteredMadalali.map(d => (
                        <tr key={d.id} className={`hover:bg-gray-50 ${d.is_active === false ? 'opacity-60' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-bold flex-shrink-0">
                                {d.full_name?.[0] ?? '?'}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 truncate max-w-[120px]">{d.full_name}</p>
                                {d.is_active === false && <span className="text-[10px] text-red-500">Imesimamishwa</span>}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-500 max-w-[140px] truncate">{d.email ?? '—'}</td>
                          <td className="px-3 py-3">
                            {d.dalali_profiles?.whatsapp_number ? (
                              <a
                                href={`https://wa.me/${waNum(d.dalali_profiles.whatsapp_number)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 bg-[#25D366] text-white text-[10px] px-2 py-1 rounded-lg hover:bg-green-600 transition-colors"
                                title={d.dalali_profiles.whatsapp_number}
                              >
                                <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white flex-shrink-0"><path d={WA_PATH}/></svg>
                                {d.dalali_profiles.whatsapp_number}
                              </a>
                            ) : (
                              <span className="text-xs text-gray-300 italic">Haijawekwa</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center"><VerifBadge status={d.dalali_profiles?.verification_status} /></td>
                          <td className="px-3 py-3 text-center"><SubBadge subscriptions={d.subscriptions ?? []} /></td>
                          <td className="px-3 py-3 text-center text-xs font-bold text-gray-900">{dalaliListingCounts[d.id] ?? 0}</td>
                          <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap" suppressHydrationWarning>{timeAgo(d.created_at)}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1 justify-center flex-wrap">
                              <Link
                                href={`/admin/users/${d.id}`}
                                className="text-[10px] px-2 py-1 rounded-lg bg-primary-50 text-primary-600 font-semibold"
                              >
                                Angalia →
                              </Link>
                              <button
                                onClick={() => handleUserAction(d.id, d.is_active === false ? 'activate' : 'suspend')}
                                disabled={userActionLoading === d.id}
                                className={`text-[10px] px-2 py-1 rounded-lg font-semibold ${
                                  d.is_active === false ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-700'
                                } disabled:opacity-40`}
                              >
                                {userActionLoading === d.id ? '...' : d.is_active === false ? 'Washa' : 'Simamisha'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(d.id)}
                                disabled={userActionLoading === d.id}
                                className="text-[10px] px-2 py-1 rounded-lg bg-red-50 text-red-600 font-semibold disabled:opacity-40"
                              >
                                Futa
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden space-y-3">
                  {filteredMadalali.length === 0 && (
                    <p className="text-center py-8 text-sm text-gray-400">Hakuna madalali wanaolingana</p>
                  )}
                  {filteredMadalali.map(d => (
                    <div key={d.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${d.is_active === false ? 'border-red-100 opacity-75' : 'border-gray-100'}`}>
                      {/* Header */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold flex-shrink-0">
                          {d.full_name?.[0] ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-sm font-semibold text-gray-900">{d.full_name}</p>
                            {d.is_active === false && (
                              <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">Imesimamishwa</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{d.email ?? '—'}</p>
                          {/* WhatsApp quick button */}
                          {d.dalali_profiles?.whatsapp_number ? (
                            <a
                              href={`https://wa.me/${waNum(d.dalali_profiles.whatsapp_number)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 bg-[#25D366] text-white text-[10px] px-2 py-0.5 rounded-md mt-1"
                            >
                              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white flex-shrink-0"><path d={WA_PATH}/></svg>
                              {d.dalali_profiles.whatsapp_number}
                            </a>
                          ) : (
                            <p className="text-[10px] text-gray-300 italic mt-0.5">WA haijawekwa</p>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-300 flex-shrink-0" suppressHydrationWarning>{timeAgo(d.created_at)}</p>
                      </div>
                      {/* Info grid */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-gray-50 rounded-xl p-2 text-center">
                          <p className="text-[10px] text-gray-400 mb-0.5">Uthibitisho</p>
                          <VerifBadge status={d.dalali_profiles?.verification_status} />
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2 text-center">
                          <p className="text-[10px] text-gray-400 mb-0.5">Subscription</p>
                          <SubBadge subscriptions={d.subscriptions ?? []} />
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2 text-center">
                          <p className="text-[10px] text-gray-400 mb-0.5">Listings</p>
                          <p className="text-xs font-bold text-gray-900">{dalaliListingCounts[d.id] ?? 0}</p>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex gap-2">
                        <Link
                          href={`/admin/users/${d.id}`}
                          className="flex items-center justify-center px-3 py-2.5 rounded-xl text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-100"
                        >
                          Angalia →
                        </Link>
                        <button
                          onClick={() => handleUserAction(d.id, d.is_active === false ? 'activate' : 'suspend')}
                          disabled={userActionLoading === d.id}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.97] ${
                            d.is_active === false ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                          } disabled:opacity-40`}
                        >
                          {userActionLoading === d.id ? '...' : d.is_active === false ? '✅ Washa' : '⏸️ Simamisha'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(d.id)}
                          disabled={userActionLoading === d.id}
                          className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-red-50 text-red-600 disabled:opacity-40 active:scale-[0.97] transition-all"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── TAB: WATEJA ── */}
            {userSubTab === 'wateja' && (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Mteja</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">Email</th>
                        <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Unlocks</th>
                        <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Saved</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">Alijiunga</th>
                        <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredWateja.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-8 text-sm text-gray-400">Hakuna wateja wanaolingana</td></tr>
                      )}
                      {filteredWateja.map(c => (
                        <tr key={c.id} className={`hover:bg-gray-50 ${c.is_active === false ? 'opacity-60' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                                {c.full_name?.[0] ?? '?'}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 truncate max-w-[120px]">{c.full_name}</p>
                                {c.is_active === false && <span className="text-[10px] text-red-500">Imesimamishwa</span>}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-500 max-w-[160px] truncate">{c.email ?? '—'}</td>
                          <td className="px-3 py-3 text-center text-xs font-bold text-gray-900">{clientUnlockCounts[c.id] ?? 0}</td>
                          <td className="px-3 py-3 text-center text-xs font-bold text-gray-900">{clientSavedCounts[c.id] ?? 0}</td>
                          <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap" suppressHydrationWarning>{timeAgo(c.created_at)}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1 justify-center">
                              <button
                                onClick={() => handleUserAction(c.id, c.is_active === false ? 'activate' : 'suspend')}
                                disabled={userActionLoading === c.id}
                                className={`text-[10px] px-2 py-1 rounded-lg font-semibold ${
                                  c.is_active === false ? 'bg-primary-50 text-primary-600' : 'bg-amber-50 text-amber-700'
                                } disabled:opacity-40`}
                              >
                                {userActionLoading === c.id ? '...' : c.is_active === false ? 'Washa' : 'Simamisha'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(c.id)}
                                disabled={userActionLoading === c.id}
                                className="text-[10px] px-2 py-1 rounded-lg bg-red-50 text-red-600 font-semibold disabled:opacity-40"
                              >
                                Futa
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden space-y-3">
                  {filteredWateja.length === 0 && (
                    <p className="text-center py-8 text-sm text-gray-400">Hakuna wateja wanaolingana</p>
                  )}
                  {filteredWateja.map(c => (
                    <div key={c.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${c.is_active === false ? 'border-red-100 opacity-75' : 'border-gray-100'}`}>
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold flex-shrink-0">
                          {c.full_name?.[0] ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-sm font-semibold text-gray-900">{c.full_name}</p>
                            {c.is_active === false && (
                              <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">Imesimamishwa</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{c.email ?? '—'}</p>
                          <p className="text-xs text-gray-400">{c.phone ?? '—'}</p>
                        </div>
                        <p className="text-[10px] text-gray-300 flex-shrink-0" suppressHydrationWarning>{timeAgo(c.created_at)}</p>
                      </div>
                      {/* Info grid */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-gray-50 rounded-xl p-2 text-center">
                          <p className="text-[10px] text-gray-400 mb-0.5">Unlocks (malipo)</p>
                          <p className="text-sm font-bold text-gray-900">{clientUnlockCounts[c.id] ?? 0}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2 text-center">
                          <p className="text-[10px] text-gray-400 mb-0.5">Saved listings</p>
                          <p className="text-sm font-bold text-gray-900">{clientSavedCounts[c.id] ?? 0}</p>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUserAction(c.id, c.is_active === false ? 'activate' : 'suspend')}
                          disabled={userActionLoading === c.id}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.97] ${
                            c.is_active === false ? 'bg-primary-50 text-primary-700' : 'bg-amber-50 text-amber-700'
                          } disabled:opacity-40`}
                        >
                          {userActionLoading === c.id ? '...' : c.is_active === false ? '✅ Washa' : '⏸️ Simamisha'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(c.id)}
                          disabled={userActionLoading === c.id}
                          className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-50 text-red-600 disabled:opacity-40 active:scale-[0.97] transition-all"
                        >
                          🗑️ Futa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════
            TAB: Mapato
        ══════════════════════════════════════════════ */}
        {tab === 'mapato' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">Unlocks (contacts)</p>
                <p className="text-xl font-bold text-gray-900">{formatTsh(stats.totalUnlockRevenue)}</p>
                <p className="text-xs text-primary-500 mt-0.5">{stats.unlocksCount} malipo</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">Subscriptions</p>
                <p className="text-xl font-bold text-gray-900">{formatTsh(stats.totalSubRevenue)}</p>
                <p className="text-xs text-amber-500 mt-0.5">
                  {subscriptions.filter(s => s.status === 'active').length} active
                </p>
              </div>
              <div className="bg-yellow-50 rounded-2xl border border-yellow-100 p-4 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">🚀 Boost Revenue</p>
                <p className="text-xl font-bold text-gray-900">{formatTsh(stats.totalBoostRevenue)}</p>
                <p className="text-xs text-yellow-600 mt-0.5">{stats.activeBoostsCount} boosted sasa</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">Jumla (wiki hii)</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatTsh(stats.totalUnlockRevenue + stats.totalSubRevenue + stats.totalBoostRevenue)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Sources 3</p>
              </div>
            </div>
            <div className="bg-primary-500 rounded-2xl p-4 text-center">
              <p className="text-green-100 text-xs mb-1">Mapato Yote</p>
              <p className="text-white text-3xl font-bold">{formatTsh(stats.totalRevenue)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-4">Unlocks — siku 7 zilizopita</h3>
              <div className="flex items-end gap-2 h-24">
                {revenueByDay.map(day => (
                  <div key={day.key} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-primary-500 rounded-t-md transition-all"
                      style={{ height: `${(day.amount / maxRevDay) * 80}px`, minHeight: day.amount > 0 ? '4px' : '0' }} />
                    <span className="text-xs text-gray-400">{day.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <h3 className="text-sm font-bold text-gray-800">Subscriptions za Hivi Karibuni</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {subscriptions.slice(0, 15).map(sub => (
                  <div key={sub.id} className="px-4 py-3 flex items-center gap-3">
                    <span className="text-lg">{sub.plan === 'premium' ? '⭐' : '📦'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 capitalize">{sub.plan}</p>
                      <p className="text-xs text-gray-400" suppressHydrationWarning>{timeAgo(sub.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-gray-800">
                        {formatTsh(sub.plan === 'premium' ? 25_000 : 10_000)}
                      </p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        sub.status === 'active' ? 'bg-primary-50 text-primary-600' : 'bg-gray-100 text-gray-400'
                      }`}>{sub.status}</span>
                    </div>
                  </div>
                ))}
                {subscriptions.length === 0 && (
                  <p className="text-center py-6 text-xs text-gray-400">Hakuna subscriptions bado</p>
                )}
              </div>
            </div>
          </>
        )}

      </div>

      {/* ── Enhanced Delete confirmation ── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-white w-full rounded-t-3xl px-6 pt-4 pb-10 shadow-xl max-h-[80vh] overflow-y-auto"
               onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4" />
            <div className="text-3xl text-center mb-2">🚫</div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-4">Futa Akaunti ya Mtumiaji</h3>

            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Sababu ya kufuta:</p>
            <div className="space-y-2 mb-4">
              {[
                { v: 'Scam — anatoa fake listings', icon: '🚨' },
                { v: 'Unyanyasaji wa wateja',       icon: '🚨' },
                { v: 'Taarifa za uongo',            icon: '🚨' },
                { v: 'Uvunjaji wa masharti',        icon: '🚨' },
                { v: 'Sababu nyingine',             icon: '📝' },
              ].map(r => (
                <button key={r.v} onClick={() => setDeleteReason(r.v)}
                  className={`w-full flex items-center gap-2 p-3 rounded-xl border-2 text-left text-sm transition-all ${
                    deleteReason === r.v ? 'border-red-400 bg-red-50 text-red-800' : 'border-gray-100 text-gray-700'
                  }`}
                >
                  <span>{r.icon}</span><span>{r.v}</span>
                </button>
              ))}
            </div>

            {/* Notify toggle */}
            <button
              onClick={() => setDeleteNotify(n => !n)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 mb-5 transition-all ${
                deleteNotify ? 'border-primary-300 bg-primary-50' : 'border-gray-100'
              }`}
            >
              <span className="text-sm text-gray-700">Tuma arifa kwa mtumiaji?</span>
              <div className={`w-10 h-5 rounded-full transition-colors ${deleteNotify ? 'bg-primary-500' : 'bg-gray-200'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${deleteNotify ? 'translate-x-5' : ''}`} />
              </div>
            </button>

            <div className="flex gap-3">
              <button onClick={() => { setConfirmDeleteId(null); setDeleteReason('') }}
                className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-700 font-semibold text-sm">
                Ghairi
              </button>
              <button
                onClick={() => handleUserDelete(confirmDeleteId)}
                disabled={!deleteReason || !!userActionLoading}
                className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-bold text-sm disabled:opacity-40"
              >
                {userActionLoading ? '...' : '🗑️ Futa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reports tab content (outside main grid) ── */}
      {tab === 'reports' && (
        <div className="px-4 pt-4 pb-20 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-800">🚨 Ripoti za Scam</p>
            <div className="flex gap-1.5">
              {['pending', 'reviewed', 'dismissed'].map(s => (
                <span key={s} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  s === 'pending' ? 'bg-red-100 text-red-700' :
                  s === 'reviewed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {reportsList.filter(r => r.status === s).length} {s}
                </span>
              ))}
            </div>
          </div>

          {reportsList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <p className="text-gray-400 text-sm">Hakuna ripoti bado</p>
            </div>
          ) : reportsList.map(report => (
            <div key={report.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
              report.status === 'pending' ? 'border-red-100' : 'border-gray-100'
            }`}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900">
                        {report.dalali?.full_name ?? 'Dalali'}
                      </p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        report.status === 'pending' ? 'bg-red-100 text-red-700' :
                        report.status === 'reviewed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {report.status}
                      </span>
                    </div>
                    {report.listing && (
                      <p className="text-xs text-gray-400">
                        {report.listing.type} — {report.listing.district}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 flex-shrink-0" suppressHydrationWarning>{timeAgo(report.created_at)}</p>
                </div>

                <div className="bg-red-50 rounded-xl px-3 py-2 mb-3">
                  <p className="text-xs font-semibold text-red-700">🚨 {report.reason}</p>
                  {report.details && <p className="text-xs text-red-600 mt-0.5">{report.details}</p>}
                </div>

                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-400">
                    Imeripotiwa na: <span className="text-gray-600 font-medium">{report.reporter?.full_name ?? 'Mteja'}</span>
                  </p>
                  {report.dalali?.dalali_profiles?.whatsapp_number && (
                    <a
                      href={`https://wa.me/${waNum(report.dalali.dalali_profiles.whatsapp_number)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 bg-[#25D366] text-white text-[10px] px-2 py-1 rounded-lg"
                    >
                      <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white"><path d={WA_PATH}/></svg>
                      WA
                    </a>
                  )}
                </div>

                {report.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReportAction(report.id, 'reviewed')}
                      disabled={reportActionLoading === report.id}
                      className="flex-1 py-2 rounded-xl bg-primary-50 text-primary-700 text-xs font-semibold border border-primary-100 disabled:opacity-40"
                    >
                      ✅ Imeangaliwa
                    </button>
                    <button
                      onClick={() => { setConfirmDeleteId(report.dalali?.id ?? null) }}
                      className="flex-1 py-2 rounded-xl bg-red-50 text-red-700 text-xs font-semibold border border-red-100"
                    >
                      🗑️ Futa Dalali
                    </button>
                    <button
                      onClick={() => handleReportAction(report.id, 'dismissed')}
                      disabled={reportActionLoading === report.id}
                      className="flex-1 py-2 rounded-xl bg-gray-50 text-gray-500 text-xs border border-gray-100 disabled:opacity-40"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Verification Card ─────────────────────────────────────
function VerifyCard({
  v, loading, rejectReason, onRejectReasonChange, onApprove, onReject,
}: {
  v: AdminVerification
  loading: boolean
  rejectReason: string
  onRejectReasonChange: (s: string) => void
  onApprove: () => void
  onReject: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="font-semibold text-gray-900 text-sm">{v.user?.full_name ?? 'Dalali'}</p>
            <p className="text-xs text-gray-400">{v.user?.phone ?? ''}</p>
            {v.nida_number && (
              <p className="text-xs text-gray-500 mt-0.5">NIDA: <span className="font-mono">{v.nida_number}</span></p>
            )}
            {v.verification_submitted_at && (
              <p className="text-xs text-gray-400" suppressHydrationWarning>{timeAgo(v.verification_submitted_at)}</p>
            )}
          </div>
          <button onClick={() => setExpanded(e => !e)} className="text-xs text-primary-600 font-medium">
            {expanded ? 'Ficha' : 'Ona Picha'}
          </button>
        </div>

        {expanded && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[v.nida_image_front, v.nida_image_back, v.selfie_image].map((src, i) => (
              src ? (
                <a key={i} href={src} target="_blank" rel="noreferrer"
                  className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 block">
                  <Image fill src={src} alt="" className="object-cover" sizes="120px" unoptimized />
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5">
                    {['Mbele', 'Nyuma', 'Selfie'][i]}
                  </span>
                </a>
              ) : (
                <div key={i} className="aspect-square rounded-xl bg-gray-100 flex items-center justify-center text-gray-300 text-xs">
                  Hakuna
                </div>
              )
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onApprove} disabled={loading}
            className="flex-1 bg-primary-500 text-white text-xs font-semibold py-2.5 rounded-xl disabled:opacity-50 active:scale-95 transition-all">
            {loading ? '...' : '✅ Thibitisha'}
          </button>
          <button onClick={onReject} disabled={loading || !rejectReason.trim()}
            className="flex-1 bg-red-500 text-white text-xs font-semibold py-2.5 rounded-xl disabled:opacity-50 active:scale-95 transition-all">
            ❌ Kataa
          </button>
        </div>

        <input
          type="text"
          placeholder="Sababu ya kukataa (lazima kabla ya kukataa)"
          value={rejectReason}
          onChange={e => onRejectReasonChange(e.target.value)}
          className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-200"
        />
      </div>
    </div>
  )
}
