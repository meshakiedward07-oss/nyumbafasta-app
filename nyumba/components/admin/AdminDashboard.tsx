'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type {
  AdminListing,
  AdminVerification,
} from '@/app/(admin)/admin/page'

const WA_PATH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z'

function waNum(raw: string) { return raw.replace(/[^0-9]/g, '') }

type Tab = 'overview' | 'listings' | 'verify' | 'reports'

type Stats = {
  pendingCount: number
  activeCount: number
  totalListings: number
  totalUsers: number
  clientCount: number
  dalaliCount: number
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
  pendingVerifications: AdminVerification[]
  stats: Stats
  reports?: ReportItem[]
  regionStats?: [string, number][]
  initialTab?: Tab
}

const typeLabel: Record<string, string> = {
  chumba: 'Chumba', apartment: 'Apartment', nyumba: 'Nyumba', studio: 'Studio', duka: 'Duka',
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

export default function AdminDashboard({
  pendingListings, allListings,
  pendingVerifications, stats, reports = [], regionStats = [],
  initialTab = 'overview',
}: Props) {
  // ── Main tabs ─────────────────────────────────────────
  const [tab, setTab]   = useState<Tab>(initialTab)
  const [listings, setListings] = useState(pendingListings)
  const [allListingsState, setAllListingsState] = useState(allListings)
  const [listingStatusFilter, setListingStatusFilter] = useState<string>('pending')
  const [loadingId, setLoadingId]   = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [rejectListingId, setRejectListingId]         = useState<string | null>(null)
  const [listingRejectReason, setListingRejectReason] = useState('')

  // ── Verification ──────────────────────────────────────
  const [verifications, setVerifications] = useState(pendingVerifications)
  const [verifyLoading, setVerifyLoading] = useState<string | null>(null)

  // ── Reports ───────────────────────────────────────────
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

  // ── Inbox unread count (personal messages flagged for owner) ──
  const [inboxUnread, setInboxUnread] = useState(0)
  useEffect(() => {
    function fetchInboxStats() {
      fetch('/api/v1/inbox/stats')
        .then(r => r.ok ? r.json() : null)
        .then((d: { flagged?: number } | null) => { if (d) setInboxUnread(d.flagged ?? 0) })
        .catch(() => {})
    }
    fetchInboxStats()
    const iv = setInterval(fetchInboxStats, 60_000)
    return () => clearInterval(iv)
  }, [])


  // ── Approve / Reject listing ─────────────────────────
  async function handleAction(id: string, action: 'approve' | 'reject', reason?: string) {
    setLoadingId(id)
    setActionError('')
    try {
      const res = await fetch(`/api/v1/admin/listings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Imeshindwa')
      const newStatus = action === 'approve' ? 'active' : 'rejected'
      setListings(prev => prev.filter(l => l.id !== id))
      setAllListingsState(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l))
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Hitilafu imetokea')
    } finally {
      setLoadingId(null)
    }
  }

  // ── Delete user (used from reports tab) ─────────────
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* ── Desktop page title ── */}
      <div className="hidden lg:flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-1.5"><i className="ti ti-settings" aria-hidden="true" /> Dashibodi</h1>
          <p className="text-xs text-gray-400 mt-0.5">NyumbaFasta · Usimamizi wa Mfumo</p>
        </div>
        <div className="flex items-center gap-2">
          {listings.length > 0 && (
            <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full font-semibold">
              <i className="ti ti-home" aria-hidden="true" /> {listings.length} zinasubiri
            </span>
          )}
          {verifications.length > 0 && (
            <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-semibold">
              <i className="ti ti-id-badge" aria-hidden="true" /> {verifications.length} uthibitisho
            </span>
          )}
          {reportsList.filter(r => r.status === 'pending').length > 0 && (
            <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-full font-semibold">
              <i className="ti ti-alert-octagon" aria-hidden="true" /> {reportsList.filter(r => r.status === 'pending').length} ripoti
            </span>
          )}
        </div>
      </div>

      {/* ── Main tab nav ── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex overflow-x-auto scrollbar-none">
          {([
            { key: 'overview', label: 'Muhtasari',                                                          icon: 'chart-bar' },
            { key: 'listings', label: `Zinasubiri (${listings.length})`,                                  icon: 'home' },
            { key: 'verify',   label: `Uthibitisho (${verifications.length})`,                            icon: 'id-badge' },
            { key: 'reports',  label: `Ripoti (${reportsList.filter(r => r.status === 'pending').length})`, icon: 'alert-octagon' },
          ] as { key: Tab; label: string; icon: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-400'
              }`}
            >
              <i className={`ti ti-${t.icon}`} aria-hidden="true" /><span>{t.label}</span>
            </button>
          ))}
          {/* External links — hidden on desktop (sidebar handles these) */}
          <div className="contents lg:hidden">
            <Link
              href="/admin/inbox"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 border-transparent text-gray-400 hover:text-primary-600 transition-colors relative"
            >
              <i className="ti ti-mail" aria-hidden="true" /><span>Inbox</span>
              {inboxUnread > 0 && (
                <span className="absolute top-1.5 right-0 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {inboxUnread > 9 ? '9+' : inboxUnread}
                </span>
              )}
            </Link>
            <Link
              href="/admin/crm"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 border-transparent text-gray-400 hover:text-primary-600 transition-colors"
            >
              <i className="ti ti-target" aria-hidden="true" /><span>CRM</span>
            </Link>
            <Link
              href="/admin/crm/analytics"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 border-transparent text-gray-400 hover:text-primary-600 transition-colors"
            >
              <i className="ti ti-chart-bar" aria-hidden="true" /><span>Takwimu</span>
            </Link>
            <Link
              href="/admin/crm/assign"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 border-transparent text-gray-400 hover:text-primary-600 transition-colors"
            >
              <i className="ti ti-users" aria-hidden="true" /><span>Mgawanyo</span>
            </Link>
            <Link
              href="/admin/crm/reports"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 border-transparent text-gray-400 hover:text-primary-600 transition-colors"
            >
              <i className="ti ti-list" aria-hidden="true" /><span>Ripoti</span>
            </Link>
            <Link
              href="/admin/crm/commission"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 border-transparent text-gray-400 hover:text-primary-600 transition-colors"
            >
              <i className="ti ti-briefcase" aria-hidden="true" /><span>Kamisheni</span>
            </Link>
            <Link
              href="/admin/crm/templates"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 border-transparent text-gray-400 hover:text-primary-600 transition-colors"
            >
              <i className="ti ti-message-circle" aria-hidden="true" /><span>Violezo WA</span>
            </Link>
            <Link
              href="/admin/leads"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 border-transparent text-gray-400 hover:text-primary-600 transition-colors"
            >
              <i className="ti ti-robot" aria-hidden="true" /><span>Leads</span>
            </Link>
            <Link
              href="/admin/facebook-groups"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 border-transparent text-gray-400 hover:text-primary-600 transition-colors"
            >
              <i className="ti ti-brand-facebook" aria-hidden="true" /><span>Vikundi FB</span>
            </Link>
            <Link
              href="/admin/instagram-profiles"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 border-transparent text-gray-400 hover:text-primary-600 transition-colors"
            >
              <i className="ti ti-brand-instagram" aria-hidden="true" /><span>Wasifu IG</span>
            </Link>
            <Link
              href="/admin/accounting"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs font-medium
                border-b-2 border-transparent text-gray-400 hover:text-primary-600 transition-colors"
            >
              <i className="ti ti-coin" aria-hidden="true" /><span>Hesabu</span>
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
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Zinasubiri',      value: stats.pendingCount, icon: 'loader-2', urgent: stats.pendingCount > 0 },
                { label: 'Matangazo Hai',   value: stats.activeCount,  icon: 'circle-check', urgent: false },
                { label: 'Watumiaji',       value: stats.totalUsers,   icon: 'users', urgent: false },
              ].map(s => (
                <div key={s.label} className={`rounded-2xl p-4 shadow-sm border ${s.urgent ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <i className={`ti ti-${s.icon} text-xl`} aria-hidden="true" />
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
                  <p className="text-xs text-primary-500 mt-0.5 flex items-center justify-center gap-0.5"><i className="ti ti-search" aria-hidden="true" /> Wateja</p>
                </div>
                <div className="flex-1 text-center bg-amber-50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-amber-700">{stats.dalaliCount}</p>
                  <p className="text-xs text-amber-500 mt-0.5 flex items-center justify-center gap-0.5"><i className="ti ti-building" aria-hidden="true" /> Madalali</p>
                </div>
              </div>
            </div>

            {/* Region stats */}
            {regionStats.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5"><i className="ti ti-map-pin" aria-hidden="true" /> Listings Kwa Mkoa (Top 10)</h3>
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
                <i className="ti ti-alert-triangle text-2xl text-amber-600" aria-hidden="true" />
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
                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5"><i className="ti ti-confetti" aria-hidden="true" /> Muhtasari wa Majaribio</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-primary-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-primary-700">{stats.activeTrials ?? 0}</p>
                    <p className="text-xs text-primary-500">Majaribio hai</p>
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

            {/* ── Inbox shortcut (shows badge when personal messages pending) ── */}
            <Link href="/admin/inbox"
              className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
              <div>
                <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
                  <i className="ti ti-mailbox" aria-hidden="true" /> Kisanduku cha Ujumbe
                  {inboxUnread > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                      {inboxUnread} mapya
                    </span>
                  )}
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {inboxUnread > 0
                    ? `Ujumbe ${inboxUnread} wa kibinafsi unasubiri jibu lako →`
                    : 'Amina anashughulikia biashara — wewe unashughulikia kibinafsi →'}
                </p>
              </div>
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            <Link href="/admin/accounting"
              className="flex items-center justify-between bg-green-50 border border-green-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div>
                <p className="text-sm font-bold text-green-800 flex items-center gap-1.5"><i className="ti ti-coin" aria-hidden="true" /> Hesabu za NyumbaFasta</p>
                <p className="text-xs text-green-600 mt-0.5">Mapato, matumizi, na faida yote kwa pamoja →</p>
              </div>
              <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            {/* ── Cron Jobs card ── */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5"><i className="ti ti-settings" aria-hidden="true" /> Kazi za Otomatiki</h3>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Kila siku:</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    Kila siku 6 AM <i className="ti ti-circle-check" aria-hidden="true" />
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Kila saa:</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    Kila saa <i className="ti ti-circle-check" aria-hidden="true" />
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
                  ) : <><i className="ti ti-player-play" aria-hidden="true" /> Endesha Kazi za Kila Siku</>}
                </button>
                <button
                  onClick={() => runCron('hourly')}
                  disabled={cronRunning}
                  className="flex-1 bg-gray-50 text-gray-600 py-2.5 rounded-xl text-xs font-semibold
                             border border-gray-100 disabled:opacity-50 active:scale-[0.97] transition-all"
                >
                  <i className="ti ti-bolt" aria-hidden="true" /> Kila Saa
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
                { key: 'all',      label: `Zote (${allListingsState.length})` },
                { key: 'pending',  label: `Zinasubiri (${allListingsState.filter(l=>l.status==='pending').length})` },
                { key: 'active',   label: `Zinapatikana (${allListingsState.filter(l=>l.status==='active').length})` },
                { key: 'taken',    label: `Zimepangishwa (${allListingsState.filter(l=>l.status==='taken').length})` },
                { key: 'rejected', label: `Zilikataliwa (${allListingsState.filter(l=>l.status==='rejected').length})` },
                { key: 'expired',  label: `Zimeisha (${allListingsState.filter(l=>l.status==='expired').length})` },
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
              const filtered = listingStatusFilter === 'all' ? allListingsState : allListingsState.filter(l => l.status === listingStatusFilter)
              return filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                  <div className="text-4xl mb-3"><i className="ti ti-circle-check text-4xl text-green-400" aria-hidden="true" /></div>
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
                      <button onClick={() => { setRejectListingId(listing.id); setListingRejectReason('') }} disabled={loadingId === listing.id}
                        className="flex-1 py-2.5 rounded-xl border-2 border-red-200 text-red-600 text-sm font-semibold disabled:opacity-40 active:scale-95 transition-all">
                        {loadingId === listing.id ? '...' : <><i className="ti ti-x" aria-hidden="true" /> Kataa</>}
                      </button>
                      <button onClick={() => handleAction(listing.id, 'approve')} disabled={loadingId === listing.id}
                        className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold disabled:opacity-40 active:scale-95 transition-all">
                        {loadingId === listing.id ? '...' : <><i className="ti ti-check" aria-hidden="true" /> Idhibiti</>}
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
                <div className="text-4xl mb-2"><i className="ti ti-circle-check text-4xl text-green-400" aria-hidden="true" /></div>
                <p className="text-sm text-gray-500">Hakuna maombi ya uthibitisho yanayosubiri</p>
              </div>
            ) : verifications.map(v => (
              <VerifyCard
                key={v.user_id}
                v={v}
                loading={verifyLoading === v.user_id}
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
                onReject={async (reason: string) => {
                  setVerifyLoading(v.user_id)
                  await fetch('/api/v1/admin/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dalali_user_id: v.user_id, action: 'reject', reason }),
                  })
                  setVerifications(prev => prev.filter(x => x.user_id !== v.user_id))
                  setVerifyLoading(null)
                }}
              />
            ))}
          </div>
        )}

      </div>

      {/* ── Enhanced Delete confirmation ── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-white w-full rounded-t-3xl px-6 pt-4 pb-10 shadow-xl max-h-[80vh] overflow-y-auto"
               onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4" />
            <div className="text-3xl text-center mb-2"><i className="ti ti-ban text-3xl text-red-400" aria-hidden="true" /></div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-4">Futa Akaunti ya Mtumiaji</h3>

            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Sababu ya kufuta:</p>
            <div className="space-y-2 mb-4">
              {[
                { v: 'Scam — anatoa fake listings', icon: 'alert-octagon' },
                { v: 'Unyanyasaji wa wateja',       icon: 'alert-octagon' },
                { v: 'Taarifa za uongo',            icon: 'alert-octagon' },
                { v: 'Uvunjaji wa masharti',        icon: 'alert-octagon' },
                { v: 'Sababu nyingine',             icon: 'pencil' },
              ].map(r => (
                <button key={r.v} onClick={() => setDeleteReason(r.v)}
                  className={`w-full flex items-center gap-2 p-3 rounded-xl border-2 text-left text-sm transition-all ${
                    deleteReason === r.v ? 'border-red-400 bg-red-50 text-red-800' : 'border-gray-100 text-gray-700'
                  }`}
                >
                  <i className={`ti ti-${r.icon}`} aria-hidden="true" /><span>{r.v}</span>
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
                {userActionLoading ? '...' : <><i className="ti ti-trash" aria-hidden="true" /> Futa</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Listing rejection modal ── */}
      {rejectListingId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setRejectListingId(null)}>
          <div className="bg-white w-full rounded-t-3xl px-5 pt-4 pb-10 shadow-xl max-h-[70vh] overflow-y-auto"
               onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4" />
            <div className="text-3xl text-center mb-2"><i className="ti ti-ban text-3xl text-red-400" aria-hidden="true" /></div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-4">Sababu ya Kukataa Listing</h3>
            <div className="space-y-2 mb-5">
              {[
                { v: 'Picha bandia au hazifanyi',  icon: 'camera-off' },
                { v: 'Bei au taarifa za uongo',     icon: 'coin-off' },
                { v: 'Eneo au anwani si sahihi',    icon: 'map-pin-off' },
                { v: 'Maudhui yasiyofaa',           icon: 'alert-triangle' },
                { v: 'Sababu nyingine',             icon: 'pencil' },
              ].map(r => (
                <button key={r.v} onClick={() => setListingRejectReason(r.v)}
                  className={`w-full flex items-center gap-2 p-3 rounded-xl border-2 text-left text-sm transition-all ${
                    listingRejectReason === r.v ? 'border-red-400 bg-red-50 text-red-800' : 'border-gray-100 text-gray-700'
                  }`}
                >
                  <i className={`ti ti-${r.icon}`} aria-hidden="true" /><span>{r.v}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRejectListingId(null)}
                className="flex-1 py-3 border-2 border-gray-200 rounded-2xl text-sm font-semibold text-gray-600">
                Ghairi
              </button>
              <button
                onClick={() => { handleAction(rejectListingId, 'reject', listingRejectReason); setRejectListingId(null) }}
                disabled={!listingRejectReason}
                className="flex-1 py-3 bg-red-500 text-white rounded-2xl text-sm font-bold disabled:opacity-40">
                <i className="ti ti-x" aria-hidden="true" /> Kataa Listing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reports tab content (outside main grid) ── */}
      {tab === 'reports' && (
        <div className="px-4 pt-4 pb-20 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5"><i className="ti ti-alert-octagon" aria-hidden="true" /> Ripoti za Scam</p>
            <div className="flex gap-1.5">
              {(['pending', 'reviewed', 'dismissed'] as const).map(s => (
                <span key={s} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  s === 'pending' ? 'bg-red-100 text-red-700' :
                  s === 'reviewed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {reportsList.filter(r => r.status === s).length} {
                    s === 'pending' ? 'zinasubiri' : s === 'reviewed' ? 'zilizoangaliwa' : 'zilizopita'
                  }
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
                        {report.status === 'pending' ? 'Inasubiri' : report.status === 'reviewed' ? 'Imeangaliwa' : 'Imepita'}
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
                  <p className="text-xs font-semibold text-red-700 flex items-center gap-1"><i className="ti ti-alert-octagon" aria-hidden="true" /> {report.reason}</p>
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
                      <i className="ti ti-circle-check" aria-hidden="true" /> Imeangaliwa
                    </button>
                    <button
                      onClick={() => { setConfirmDeleteId(report.dalali?.id ?? null) }}
                      className="flex-1 py-2 rounded-xl bg-red-50 text-red-700 text-xs font-semibold border border-red-100"
                    >
                      <i className="ti ti-trash" aria-hidden="true" /> Futa Dalali
                    </button>
                    <button
                      onClick={() => handleReportAction(report.id, 'dismissed')}
                      disabled={reportActionLoading === report.id}
                      className="flex-1 py-2 rounded-xl bg-gray-50 text-gray-500 text-xs border border-gray-100 disabled:opacity-40"
                    >
                      Pitisha
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
  v, loading, onApprove, onReject,
}: {
  v: AdminVerification
  loading: boolean
  onApprove: () => void
  onReject: (reason: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

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
            {loading ? '...' : 'Thibitisha'}
          </button>
          <button onClick={() => onReject(rejectReason)} disabled={loading || !rejectReason.trim()}
            className="flex-1 bg-red-500 text-white text-xs font-semibold py-2.5 rounded-xl disabled:opacity-50 active:scale-95 transition-all">
            <i className="ti ti-circle-x" aria-hidden="true" /> Kataa
          </button>
        </div>

        <input
          type="text"
          placeholder="Sababu ya kukataa (lazima kabla ya kukataa)"
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
          className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-200"
        />
      </div>
    </div>
  )
}
