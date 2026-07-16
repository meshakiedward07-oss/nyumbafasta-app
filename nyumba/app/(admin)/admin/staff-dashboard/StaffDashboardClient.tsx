'use client'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import type { PermissionKey } from '@/lib/staff/permissions'

// ── Types ──────────────────────────────────────────────────────────────────

type StaffInfo = {
  id: string
  full_name: string
  staff_title: string | null
  role_template: string | null
  role: string
}

type Stats = {
  pendingListings: number
  openReports: number
  pendingVerifications: number
  usersToReview: number
  expiringSubs: number
  myActiveLeads: number
  completedToday: number
  completedThisWeek: number
  completedThisMonth: number
  myAssignmentsTotal: number
  myAssignmentsCompleted: number
  pendingAssignments: number
}

type PendingListing = {
  id: string
  title: string
  type: string
  region: string
  district: string
  price_monthly: number
  images: string[]
  created_at: string
  dalali: { id: string; full_name: string; phone: string } | null
}

type Report = {
  id: string
  reason: string
  details: string | null
  status: string
  created_at: string
  reporter: { id: string; full_name: string } | null
  dalali: { id: string; full_name: string } | null
}

type UserRow = {
  id: string
  full_name: string
  phone: string | null
  role: string
  is_active: boolean
  account_status: string | null
  created_at: string
}

type SubRow = {
  id: string
  plan: string
  status: string
  expires_at: string
  dalali: { id: string; full_name: string; phone: string } | null
}

type VerifRow = {
  id: string
  full_name: string
  phone: string | null
  created_at: string
  dalali_profiles: { is_premium_verified: boolean; nida_number: string | null; business_license_url: string | null }[]
}

type ActivityEntry = {
  id: string
  action_type: string
  resource_type: string | null
  description: string
  created_at: string
}

type Assignment = {
  id: string
  title: string
  description: string | null
  category: string
  priority: string
  status: string
  ref_type: string | null
  ref_id: string | null
  due_date: string | null
  completed_at: string | null
  created_at: string
  assigned_by_user: { full_name: string } | null
}

type DashboardData = {
  staff: StaffInfo
  permissions: PermissionKey[]
  hasAdminTasks: boolean
  stats: Stats
  listings: PendingListing[]
  reports: Report[]
  verifications: VerifRow[]
  users: UserRow[]
  subscriptions: SubRow[]
  recentActivity: ActivityEntry[]
  assignments: Assignment[]
}

type LegalInfo = {
  id: string
  nida_number: string | null
  date_of_birth: string | null
  nationality: string | null
  marital_status: string | null
  tin_number: string | null
  nssf_number: string | null
  nhif_number: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relation: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_branch: string | null
  mobile_money_network: string | null
  mobile_money_number: string | null
  verification_status: string
  verified_at: string | null
  rejection_reason: string | null
  admin_notes: string | null
  updated_at: string | null
}

type StaffDocument = {
  id: string
  document_type: string
  document_name: string
  document_url: string
  file_type: string | null
  file_size_kb: number | null
  is_verified: boolean
  uploaded_at: string
}

type PayrollData = {
  basic_salary: number
  house_allowance: number
  transport_allowance: number
  meal_allowance: number
  phone_allowance: number
  other_allowances: number
  other_allowances_notes: string | null
  nssf_employee: number
  nhif_employee: number
  paye_tax: number
  other_deductions: number
  other_deductions_notes: string | null
  effective_from: string
  payment_method: string
  notes: string | null
}

type Tab = 'overview' | 'listings' | 'users' | 'reports' | 'verifications' | 'subscriptions' | 'assignments' | 'profile'

// ── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)   return 'sasa hivi'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400)return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysLeft(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

const ACTION_ICONS: Record<string, string> = {
  approve_listing: '✅', reject_listing: '❌',
  resolve_report: '🔍', dismiss_report: '🚫',
  activate_user: '🟢', deactivate_user: '⛔',
  approve_verification: '🏅', reject_verification: '❌',
  extend_subscription: '📅', suspend_subscription: '⏸',
}

const PRIORITY_STYLES: Record<string, string> = {
  low:    'bg-gray-100 text-gray-600',
  normal: 'bg-blue-50 text-blue-700',
  high:   'bg-amber-50 text-amber-700',
  urgent: 'bg-red-50 text-red-700',
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function StaffDashboardClient() {
  const [data,        setData]        = useState<DashboardData | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState<Tab>('overview')
  const [actionLoading, setActLoading]= useState<string | null>(null)
  const [toast,       setToast]       = useState<{ msg: string; ok: boolean } | null>(null)
  const [rejectId,    setRejectId]    = useState<string | null>(null)
  const [rejectReason,setRejectReason]= useState('')
  const [rejectFor,   setRejectFor]   = useState<'listing' | 'verification'>('listing')

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/v1/staff/dashboard')
      const json = await res.json()
      if (res.ok) setData(json)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function doAction(type: string, id: string, extra?: Record<string, unknown>) {
    setActLoading(`${type}:${id}`)
    try {
      const res  = await fetch('/api/v1/staff/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, ...extra }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Hitilafu')
      showToast(json.message ?? 'Imefanikiwa')
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Hitilafu imetokea', false)
    } finally {
      setActLoading(null)
    }
  }

  async function updateAssignment(id: string, status: string) {
    try {
      const res = await fetch('/api/v1/staff/assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) {
        const j = await res.json()
        showToast(j.error ?? 'Imeshindwa kubadilisha hali ya kazi', false)
        return
      }
      await load()
    } catch {
      showToast('Hitilafu imetokea', false)
    }
  }

  if (loading) return <LoadingSkeleton />

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-500 text-sm">Imeshindwa kupakua data. Jaribu tena.</p>
          <button onClick={load} className="mt-3 px-4 py-2 bg-primary-500 text-white rounded-xl text-sm">
            Jaribu Tena
          </button>
        </div>
      </div>
    )
  }

  const { staff, permissions, stats, listings, reports, verifications, users, subscriptions, recentActivity, assignments } = data
  const has = (p: PermissionKey) => permissions.includes(p) || staff.role === 'admin'

  // Dynamic tabs based on permissions
  const tabs: { key: Tab; label: string; icon: string; count?: number; show: boolean }[] = ([
    { key: 'overview'       as Tab, label: 'Muhtasari',   icon: 'chart-bar',     count: undefined,                       show: true },
    { key: 'listings'       as Tab, label: 'Matangazo',   icon: 'home-check',    count: stats.pendingListings,           show: has('approve_listings') },
    { key: 'users'          as Tab, label: 'Watumiaji',   icon: 'users-group',   count: stats.usersToReview,             show: has('manage_users') },
    { key: 'reports'        as Tab, label: 'Ripoti',      icon: 'flag',          count: stats.openReports,               show: has('handle_reports') },
    { key: 'verifications'  as Tab, label: 'Uthibitisho', icon: 'id-badge',      count: stats.pendingVerifications,      show: has('manage_verifications') },
    { key: 'subscriptions'  as Tab, label: 'Usajili',     icon: 'credit-card',   count: stats.expiringSubs,              show: has('manage_subscriptions') },
    { key: 'assignments'    as Tab, label: 'Kazi Zangu',  icon: 'clipboard-list',count: assignments.filter(a => a.status !== 'completed').length, show: true },
    { key: 'profile'        as Tab, label: 'Taarifa Zangu', icon: 'user-circle', count: undefined, show: true },
  ] as { key: Tab; label: string; icon: string; count?: number; show: boolean }[]).filter(t => t.show)

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Habari za asubuhi'
    if (h < 17) return 'Habari za mchana'
    return 'Habari za jioni'
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[200] px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white max-w-xs animate-in slide-in-from-top-2 ${toast.ok ? 'bg-primary-600' : 'bg-red-500'}`}>
          {toast.ok ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRejectId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-base font-bold text-gray-900 mb-1">Sababu ya Kukataa</h3>
            <p className="text-xs text-gray-500 mb-4">Hii itatumwa kwa {rejectFor === 'listing' ? 'dalali' : 'mwanachama'} kupitia notification.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Andika sababu (si lazima)..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setRejectId(null); setRejectReason('') }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600">
                Ghairi
              </button>
              <button
                onClick={async () => {
                  const actionType = rejectFor === 'listing' ? 'reject_listing' : 'reject_verification'
                  await doAction(actionType, rejectId, { reason: rejectReason })
                  setRejectId(null); setRejectReason('')
                }}
                disabled={!!actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-40">
                Kataa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 lg:px-6">
          {/* Top bar */}
          <div className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">{staff.full_name?.[0]?.toUpperCase() ?? 'S'}</span>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm leading-tight">{greeting()}, {staff.full_name?.split(' ')[0]}!</p>
                <p className="text-xs text-gray-400">{staff.staff_title ?? 'Mfanyakazi'} · NyumbaFasta</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 bg-primary-50 px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                <span className="text-xs font-semibold text-primary-700">
                  {stats.completedToday} kazi leo · {stats.completedThisWeek} wiki hii
                </span>
              </div>
              <button onClick={load} className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                <i className="ti ti-refresh text-base" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Tab navigation */}
          <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide -mx-1 px-1">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-t-xl whitespace-nowrap border-b-2 transition-all flex-shrink-0 ${
                  tab === t.key
                    ? 'border-primary-500 text-primary-600 bg-primary-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <i className={`ti ti-${t.icon} text-base`} aria-hidden="true" />
                <span>{t.label}</span>
                {(t.count ?? 0) > 0 && (
                  <span className={`min-w-[18px] h-[18px] text-[10px] font-bold rounded-full px-1 flex items-center justify-center ${
                    tab === t.key ? 'bg-primary-500 text-white' : 'bg-red-500 text-white'
                  }`}>
                    {t.count! > 99 ? '99+' : t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 lg:px-6 py-6">

        {/* ── OVERVIEW TAB ────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-6">

            {/* ── Personal Performance Card ── */}
            <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-3xl p-5 text-white relative overflow-hidden">
              {/* bg decoration */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white" />
                <div className="absolute -bottom-10 -left-10 w-56 h-56 rounded-full bg-white" />
              </div>

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-primary-100 text-xs font-medium uppercase tracking-wider mb-0.5">Utendaji Wangu</p>
                    <h2 className="text-xl font-bold">{staff.full_name}</h2>
                    {staff.staff_title && (
                      <span className="inline-block mt-1 bg-white/20 text-white text-[11px] font-semibold px-3 py-0.5 rounded-full">
                        {staff.staff_title}
                      </span>
                    )}
                  </div>
                  {/* assignment completion ring */}
                  {stats.myAssignmentsTotal > 0 && (
                    <div className="relative w-16 h-16 flex-shrink-0">
                      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
                        <circle
                          cx="32" cy="32" r="26" fill="none"
                          stroke="white" strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 26}`}
                          strokeDashoffset={`${2 * Math.PI * 26 * (1 - (stats.myAssignmentsCompleted / stats.myAssignmentsTotal))}`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-sm font-bold leading-none">
                          {Math.round((stats.myAssignmentsCompleted / stats.myAssignmentsTotal) * 100)}%
                        </span>
                        <span className="text-[9px] text-primary-200 leading-none mt-0.5">Kazi</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Today / Week / Month */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Leo',       value: stats.completedToday,      icon: 'sun' },
                    { label: 'Wiki Hii',  value: stats.completedThisWeek,   icon: 'calendar-week' },
                    { label: 'Mwezi Huu', value: stats.completedThisMonth,  icon: 'calendar-month' },
                  ].map(m => (
                    <div key={m.label} className="bg-white/15 rounded-2xl p-3 text-center">
                      <i className={`ti ti-${m.icon} text-base text-primary-200`} aria-hidden="true" />
                      <p className="text-2xl font-bold mt-0.5">{m.value}</p>
                      <p className="text-[10px] text-primary-200 font-medium">{m.label}</p>
                    </div>
                  ))}
                </div>

                {/* Assignments progress bar */}
                {stats.myAssignmentsTotal > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-[11px] text-primary-200 mb-1.5">
                      <span>Kazi za Admin: {stats.myAssignmentsCompleted}/{stats.myAssignmentsTotal} zimekamilika</span>
                      {stats.pendingAssignments > 0 && (
                        <span className="text-amber-300 font-semibold">{stats.pendingAssignments} zinasubiri</span>
                      )}
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-2">
                      <div
                        className="bg-white rounded-full h-2 transition-all duration-500"
                        style={{ width: `${Math.round((stats.myAssignmentsCompleted / stats.myAssignmentsTotal) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Platform work queue counts */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {has('approve_listings') && (
                <StatCard icon="home" label="Matangazo Yanayongoja" value={stats.pendingListings} color="amber" onClick={() => setTab('listings')} />
              )}
              {has('handle_reports') && (
                <StatCard icon="flag" label="Ripoti Wazi" value={stats.openReports} color="red" onClick={() => setTab('reports')} />
              )}
              {has('manage_users') && (
                <StatCard icon="user-x" label="Watumiaji Wanaohitaji Msaada" value={stats.usersToReview} color="orange" onClick={() => setTab('users')} />
              )}
              {has('manage_verifications') && (
                <StatCard icon="id-badge" label="Uthibitisho Unaongoja" value={stats.pendingVerifications} color="blue" onClick={() => setTab('verifications')} />
              )}
              {has('leads') && (
                <StatCard icon="target" label="Leads Zangu Hai" value={stats.myActiveLeads} color="green" />
              )}
              {has('manage_subscriptions') && (
                <StatCard icon="credit-card" label="Usajili Unaoisha" value={stats.expiringSubs} color="purple" onClick={() => setTab('subscriptions')} />
              )}
            </div>

            {/* Quick pending items (top 5 of each) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Pending listings quick preview */}
              {has('approve_listings') && listings.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                        <i className="ti ti-home text-amber-600 text-sm" aria-hidden="true" />
                      </div>
                      <span className="text-sm font-semibold text-gray-800">Matangazo Yanayongoja</span>
                      <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">{stats.pendingListings}</span>
                    </div>
                    <button onClick={() => setTab('listings')} className="text-xs text-primary-600 font-semibold hover:underline">Angalia Zote</button>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {listings.slice(0, 4).map(l => (
                      <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 relative">
                          {l.images?.[0] ? (
                            <Image src={l.images[0]} alt={l.title} fill className="object-cover" sizes="40px" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                              <i className="ti ti-home text-lg" aria-hidden="true" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{l.title}</p>
                          <p className="text-[11px] text-gray-400">{l.district} · {l.dalali?.full_name ?? '—'}</p>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => doAction('approve_listing', l.id)}
                            disabled={actionLoading === `approve_listing:${l.id}`}
                            className="px-2.5 py-1 rounded-lg bg-primary-50 text-primary-700 text-[11px] font-semibold hover:bg-primary-100 disabled:opacity-40 transition-colors"
                          >✓</button>
                          <button
                            onClick={() => { setRejectId(l.id); setRejectFor('listing') }}
                            className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-[11px] font-semibold hover:bg-red-100 transition-colors"
                          >✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Open reports quick preview */}
              {has('handle_reports') && reports.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                        <i className="ti ti-flag text-red-500 text-sm" aria-hidden="true" />
                      </div>
                      <span className="text-sm font-semibold text-gray-800">Ripoti Wazi</span>
                      <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">{stats.openReports}</span>
                    </div>
                    <button onClick={() => setTab('reports')} className="text-xs text-primary-600 font-semibold hover:underline">Angalia Zote</button>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {reports.slice(0, 4).map(r => (
                      <div key={r.id} className="flex items-start gap-3 px-4 py-2.5">
                        <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <i className="ti ti-alert-triangle text-red-500 text-sm" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{r.reason}</p>
                          <p className="text-[11px] text-gray-400">Kutoka: {r.reporter?.full_name ?? '—'} · {timeAgo(r.created_at)}</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => doAction('resolve_report', r.id)}
                            disabled={actionLoading === `resolve_report:${r.id}`}
                            className="px-2.5 py-1 rounded-lg bg-primary-50 text-primary-700 text-[11px] font-semibold hover:bg-primary-100 disabled:opacity-40 transition-colors"
                          >✓</button>
                          <button
                            onClick={() => doAction('dismiss_report', r.id)}
                            disabled={actionLoading === `dismiss_report:${r.id}`}
                            className="px-2.5 py-1 rounded-lg bg-gray-50 text-gray-500 text-[11px] font-semibold hover:bg-gray-100 disabled:opacity-40 transition-colors"
                          >✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Assignments quick view */}
              {assignments.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                        <i className="ti ti-clipboard-list text-blue-600 text-sm" aria-hidden="true" />
                      </div>
                      <span className="text-sm font-semibold text-gray-800">Kazi Zilizopewa</span>
                    </div>
                    <button onClick={() => setTab('assignments')} className="text-xs text-primary-600 font-semibold hover:underline">Angalia Zote</button>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {assignments.slice(0, 3).map(a => (
                      <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${PRIORITY_STYLES[a.priority]}`}>
                          {a.priority.toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800">{a.title}</p>
                          {a.due_date && <p className="text-[11px] text-amber-600">📅 {formatDate(a.due_date)}</p>}
                        </div>
                        <button
                          onClick={() => updateAssignment(a.id, 'completed')}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-primary-50 text-primary-700 font-semibold hover:bg-primary-100"
                        >Maliza</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                      <i className="ti ti-history text-gray-500 text-sm" aria-hidden="true" />
                    </div>
                    <span className="text-sm font-semibold text-gray-800">Shughuli Zangu za Hivi Karibuni</span>
                  </div>
                </div>
                {recentActivity.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-xs text-gray-400">Bado hakuna shughuli. Anza kufanya kazi!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {recentActivity.slice(0, 6).map(a => (
                      <div key={a.id} className="flex items-start gap-3 px-4 py-2.5">
                        <span className="text-base leading-none mt-0.5">{ACTION_ICONS[a.action_type] ?? '📌'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700 leading-relaxed">{a.description}</p>
                        </div>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(a.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ── LISTINGS TAB ─────────────────────────────────── */}
        {tab === 'listings' && has('approve_listings') && (
          <div className="space-y-3">
            <SectionHeader icon="home-check" label="Matangazo Yanayongoja Idhini" count={stats.pendingListings} color="amber" />
            {listings.length === 0 ? (
              <EmptyState icon="home-check" label="Matangazo yote yameshughulikiwa!" sub="Hakuna matangazo yanayosubiri idhini sasa hivi." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {listings.map(l => (
                  <div key={l.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    {/* Image */}
                    <div className="relative h-36 bg-gray-100">
                      {l.images?.[0] ? (
                        <Image src={l.images[0]} alt={l.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                          <i className="ti ti-home text-4xl" aria-hidden="true" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                        <span className="text-white font-bold text-sm drop-shadow">{l.title}</span>
                        <span className="text-[10px] bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded-full capitalize">{l.type}</span>
                      </div>
                    </div>
                    {/* Info */}
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs text-gray-500">{l.district}, {l.region}</p>
                          {l.price_monthly > 0 && (
                            <p className="text-sm font-bold text-primary-600">Tsh {l.price_monthly.toLocaleString()}/mwezi</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-semibold text-gray-700">{l.dalali?.full_name ?? '—'}</p>
                          <p className="text-[10px] text-gray-400">{l.dalali?.phone ?? ''}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 mb-3">Iliwasilishwa {timeAgo(l.created_at)}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => doAction('approve_listing', l.id)}
                          disabled={actionLoading === `approve_listing:${l.id}`}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary-500 text-white text-xs font-semibold hover:bg-primary-600 disabled:opacity-40 transition-colors"
                        >
                          {actionLoading === `approve_listing:${l.id}` ? '...' : <><i className="ti ti-check" aria-hidden="true" />Idhinisha</>}
                        </button>
                        <button
                          onClick={() => { setRejectId(l.id); setRejectFor('listing') }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors border border-red-100"
                        >
                          <i className="ti ti-x" aria-hidden="true" />Kataa
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── USERS TAB ────────────────────────────────────── */}
        {tab === 'users' && has('manage_users') && (
          <div className="space-y-3">
            <SectionHeader icon="users-group" label="Watumiaji Wanaohitaji Hatua" count={stats.usersToReview} color="orange" />
            {users.length === 0 ? (
              <EmptyState icon="users-group" label="Watumiaji wote wako sawa!" sub="Hakuna akaunti zinazohitaji hatua saa hii." />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="divide-y divide-gray-50">
                  {(users as UserRow[]).map(u => (
                    <div key={u.id} className="flex items-center gap-3 p-4">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold flex-shrink-0">
                        {u.full_name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">{u.full_name}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${u.role === 'dalali' ? 'bg-primary-50 text-primary-700' : 'bg-blue-50 text-blue-700'}`}>
                            {u.role === 'dalali' ? 'Dalali' : 'Mteja'}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            !u.is_active || u.account_status === 'suspended'
                              ? 'bg-red-50 text-red-600'
                              : 'bg-primary-50 text-primary-700'
                          }`}>
                            {!u.is_active ? 'Imezimwa' : u.account_status === 'suspended' ? 'Imesimamishwa' : 'Hai'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">{u.phone ?? '—'} · Alisajili {timeAgo(u.created_at)}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {(!u.is_active || u.account_status === 'suspended' || u.account_status === 'banned') ? (
                          <button
                            onClick={() => doAction('activate_user', u.id)}
                            disabled={actionLoading === `activate_user:${u.id}`}
                            className="px-3 py-1.5 rounded-xl bg-primary-50 text-primary-700 text-xs font-semibold hover:bg-primary-100 disabled:opacity-40 transition-colors"
                          >
                            {actionLoading === `activate_user:${u.id}` ? '...' : 'Fungua'}
                          </button>
                        ) : (
                          <button
                            onClick={() => doAction('deactivate_user', u.id)}
                            disabled={actionLoading === `deactivate_user:${u.id}`}
                            className="px-3 py-1.5 rounded-xl bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 disabled:opacity-40 transition-colors"
                          >
                            {actionLoading === `deactivate_user:${u.id}` ? '...' : 'Simamisha'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── REPORTS TAB ──────────────────────────────────── */}
        {tab === 'reports' && has('handle_reports') && (
          <div className="space-y-3">
            <SectionHeader icon="flag" label="Ripoti za Malalamiko Wazi" count={stats.openReports} color="red" />
            {reports.length === 0 ? (
              <EmptyState icon="flag" label="Ripoti zote zimeshughulikiwa!" sub="Hakuna malalamiko yanayosubiri hatua saa hii." />
            ) : (
              <div className="space-y-3">
                {reports.map(r => (
                  <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                        <i className="ti ti-alert-triangle text-red-500" aria-hidden="true" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900">{r.reason}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          <span className="text-gray-700 font-medium">{r.reporter?.full_name ?? 'Mtumiaji'}</span>
                          {r.dalali && <> aliripoti <span className="text-gray-700 font-medium">{r.dalali.full_name}</span></>}
                        </p>
                      </div>
                      <span className="text-[11px] text-gray-400 flex-shrink-0">{timeAgo(r.created_at)}</span>
                    </div>
                    {r.details && (
                      <div className="bg-gray-50 rounded-xl px-3 py-2 mb-3">
                        <p className="text-xs text-gray-600 leading-relaxed">{r.details}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => doAction('resolve_report', r.id)}
                        disabled={actionLoading === `resolve_report:${r.id}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary-500 text-white text-xs font-semibold hover:bg-primary-600 disabled:opacity-40 transition-colors"
                      >
                        <i className="ti ti-check" aria-hidden="true" />Shughulikia
                      </button>
                      <button
                        onClick={() => doAction('dismiss_report', r.id)}
                        disabled={actionLoading === `dismiss_report:${r.id}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-50 text-gray-600 text-xs font-semibold hover:bg-gray-100 disabled:opacity-40 transition-colors border border-gray-100"
                      >
                        <i className="ti ti-x" aria-hidden="true" />Ondoa
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── VERIFICATIONS TAB ────────────────────────────── */}
        {tab === 'verifications' && has('manage_verifications') && (
          <div className="space-y-3">
            <SectionHeader icon="id-badge" label="Maombi ya Uthibitisho" count={stats.pendingVerifications} color="blue" />
            {verifications.length === 0 ? (
              <EmptyState icon="id-badge" label="Maombi yote yameshughulikiwa!" sub="Hakuna maombi ya uthibitisho yanayosubiri saa hii." />
            ) : (
              <div className="space-y-3">
                {(verifications as VerifRow[]).map(v => {
                  const prof = Array.isArray(v.dalali_profiles) ? v.dalali_profiles[0] : v.dalali_profiles
                  return (
                    <div key={v.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold flex-shrink-0">
                          {v.full_name?.[0]?.toUpperCase() ?? 'D'}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-900">{v.full_name}</p>
                          <p className="text-xs text-gray-400">{v.phone ?? '—'}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">Alisajili {timeAgo(v.created_at)}</p>
                        </div>
                      </div>
                      {prof?.nida_number && (
                        <div className="bg-blue-50 rounded-xl px-3 py-2 mb-3">
                          <p className="text-[11px] text-blue-600 font-semibold">NIDA: {prof.nida_number}</p>
                          {prof.business_license_url && (
                            <a href={prof.business_license_url} target="_blank" rel="noopener noreferrer"
                              className="text-[11px] text-blue-700 underline font-medium mt-0.5 block">
                              📄 Angalia Leseni ya Biashara
                            </a>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => doAction('approve_verification', v.id)}
                          disabled={actionLoading === `approve_verification:${v.id}`}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary-500 text-white text-xs font-semibold hover:bg-primary-600 disabled:opacity-40"
                        >
                          <i className="ti ti-medal" aria-hidden="true" />Idhinisha
                        </button>
                        <button
                          onClick={() => { setRejectId(v.id); setRejectFor('verification') }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 border border-red-100"
                        >
                          <i className="ti ti-x" aria-hidden="true" />Kataa
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SUBSCRIPTIONS TAB ────────────────────────────── */}
        {tab === 'subscriptions' && has('manage_subscriptions') && (
          <div className="space-y-3">
            <SectionHeader icon="credit-card" label="Usajili Unaoisha Hivi Karibuni" count={stats.expiringSubs} color="purple" />
            {subscriptions.length === 0 ? (
              <EmptyState icon="credit-card" label="Hakuna usajili unaoisha hivi karibuni!" sub="Madalali wote wana usajili wao salama." />
            ) : (
              <div className="space-y-3">
                {(subscriptions as SubRow[]).map(s => {
                  const dl = daysLeft(s.expires_at)
                  const isExpired = dl < 0
                  return (
                    <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isExpired ? 'bg-red-50' : dl <= 3 ? 'bg-amber-50' : 'bg-purple-50'}`}>
                          <i className={`ti ti-credit-card text-base ${isExpired ? 'text-red-500' : dl <= 3 ? 'text-amber-600' : 'text-purple-600'}`} aria-hidden="true" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-900">{s.dalali?.full_name ?? '—'}</p>
                          <p className="text-xs text-gray-500">{s.dalali?.phone ?? ''}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-bold uppercase">{s.plan}</span>
                            <span className={`text-[10px] font-bold ${isExpired ? 'text-red-600' : dl <= 3 ? 'text-amber-600' : 'text-gray-500'}`}>
                              {isExpired ? `Imeisha siku ${Math.abs(dl)} zilizopita` : `Siku ${dl} zimebaki`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => doAction('extend_subscription', s.id, { days: 30 })}
                          disabled={actionLoading === `extend_subscription:${s.id}`}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary-50 text-primary-700 text-xs font-semibold hover:bg-primary-100 disabled:opacity-40"
                        >
                          <i className="ti ti-calendar-plus" aria-hidden="true" />Ongeza Siku 30
                        </button>
                        <button
                          onClick={() => doAction('suspend_subscription', s.id)}
                          disabled={actionLoading === `suspend_subscription:${s.id}`}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 disabled:opacity-40 border border-red-100"
                        >
                          <i className="ti ti-pause" aria-hidden="true" />Simamisha
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ASSIGNMENTS TAB ──────────────────────────────── */}
        {tab === 'assignments' && (
          <div className="space-y-3">
            <SectionHeader icon="clipboard-list" label="Kazi Zilizonipiwa na Admin" count={assignments.filter(a => a.status !== 'completed').length} color="blue" />
            {assignments.length === 0 ? (
              <EmptyState icon="clipboard-list" label="Hakuna kazi zilizopewa!" sub="Admin atakupatia kazi kutoka kwenye admin panel yake." />
            ) : (
              <div className="space-y-3">
                {assignments.map(a => (
                  <div key={a.id} className={`bg-white rounded-2xl border overflow-hidden ${a.status === 'completed' ? 'opacity-60 border-gray-100' : 'border-gray-100'}`}>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          a.status === 'completed' ? 'bg-primary-50' :
                          a.priority === 'urgent' ? 'bg-red-50' :
                          a.priority === 'high' ? 'bg-amber-50' : 'bg-gray-50'
                        }`}>
                          <i className={`ti ti-${
                            a.status === 'completed' ? 'circle-check text-primary-600' :
                            a.priority === 'urgent' ? 'alert-circle text-red-500' :
                            a.priority === 'high' ? 'alert-triangle text-amber-600' :
                            'clipboard text-gray-500'
                          } text-base`} aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-bold text-gray-900">{a.title}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${PRIORITY_STYLES[a.priority]}`}>
                              {a.priority.toUpperCase()}
                            </span>
                          </div>
                          {a.description && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{a.description}</p>}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="text-[11px] text-gray-400">Kutoka: {a.assigned_by_user?.full_name ?? 'Admin'}</span>
                            {a.due_date && (
                              <span className={`text-[11px] font-medium ${daysLeft(a.due_date) < 0 ? 'text-red-600' : daysLeft(a.due_date) <= 1 ? 'text-amber-600' : 'text-gray-500'}`}>
                                📅 {daysLeft(a.due_date) < 0 ? `Imechelewa siku ${Math.abs(daysLeft(a.due_date))}` : `Siku ${daysLeft(a.due_date)} zimebaki`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {a.status !== 'completed' && (
                        <div className="flex gap-2 mt-3">
                          {a.status === 'pending' && (
                            <button
                              onClick={() => updateAssignment(a.id, 'in_progress')}
                              className="flex-1 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100"
                            >
                              Anza Kazi
                            </button>
                          )}
                          <button
                            onClick={() => updateAssignment(a.id, 'completed')}
                            className="flex-1 py-2 rounded-xl bg-primary-500 text-white text-xs font-semibold hover:bg-primary-600"
                          >
                            ✓ Kazi Imekamilika
                          </button>
                        </div>
                      )}
                      {a.status === 'completed' && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <i className="ti ti-circle-check text-primary-500 text-sm" aria-hidden="true" />
                          <span className="text-xs text-primary-600 font-medium">Imekamilika</span>
                          {a.completed_at && <span className="text-[11px] text-gray-400">· {timeAgo(a.completed_at)}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PROFILE TAB ─────────────────────────────────── */}
        {tab === 'profile' && (
          <ProfileTab staffId={staff.id} staffName={staff.full_name} showToast={showToast} />
        )}

      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color, onClick }: {
  icon: string; label: string; value: number; color: string; onClick?: () => void
}) {
  const colors: Record<string, { bg: string; icon: string; num: string }> = {
    green:  { bg: 'bg-primary-50',  icon: 'text-primary-600', num: 'text-primary-700' },
    amber:  { bg: 'bg-amber-50',    icon: 'text-amber-600',   num: 'text-amber-700'   },
    red:    { bg: 'bg-red-50',      icon: 'text-red-500',     num: 'text-red-600'     },
    orange: { bg: 'bg-orange-50',   icon: 'text-orange-500',  num: 'text-orange-600'  },
    blue:   { bg: 'bg-blue-50',     icon: 'text-blue-500',    num: 'text-blue-600'    },
    purple: { bg: 'bg-purple-50',   icon: 'text-purple-500',  num: 'text-purple-600'  },
  }
  const c = colors[color] ?? colors.green
  return (
    <button
      onClick={onClick}
      className={`${c.bg} rounded-2xl p-4 text-left transition-all hover:shadow-sm active:scale-[0.98] ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <i className={`ti ti-${icon} text-xl ${c.icon}`} aria-hidden="true" />
      <p className={`text-2xl font-bold mt-2 ${c.num}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
    </button>
  )
}

function SectionHeader({ icon, label, count, color }: {
  icon: string; label: string; count: number; color: string
}) {
  const colorMap: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700', purple: 'bg-purple-50 text-purple-700',
    orange: 'bg-orange-50 text-orange-700', green: 'bg-primary-50 text-primary-700',
  }
  return (
    <div className="flex items-center gap-3 mb-1">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
        <i className={`ti ti-${icon} text-base`} aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-base font-bold text-gray-900">{label}</h2>
        <p className="text-xs text-gray-400">{count} {count === 1 ? 'kipengele' : 'vipengele'} vinavyosubiri</p>
      </div>
    </div>
  )
}

function EmptyState({ icon, label, sub }: { icon: string; label: string; sub: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
        <i className={`ti ti-${icon} text-2xl text-gray-300`} aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-gray-600 mb-1">{label}</p>
      <p className="text-xs text-gray-400 max-w-xs mx-auto">{sub}</p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 h-[72px] animate-pulse" />
      <div className="max-w-6xl mx-auto px-4 lg:px-6 py-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-64 bg-gray-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── ProfileTab ───────────────────────────────────────────────────────────────

const MARITAL_STATUS = [
  { v: 'single',   l: 'Mwenye Biko' },
  { v: 'married',  l: 'Mwenye Ndoa' },
  { v: 'divorced', l: 'Aliyeachana' },
  { v: 'widowed',  l: 'Mjane/Mgane' },
]

const TANZANIA_BANKS = [
  'CRDB Bank', 'NBC (National Bank of Commerce)', 'NMB Bank',
  'Stanbic Bank', 'Standard Chartered', 'Absa Bank Tanzania',
  'Equity Bank Tanzania', 'DTB Tanzania', 'Akiba Commercial Bank',
  'Bank M Tanzania', 'Exim Bank Tanzania', 'TIB Development Bank', 'Nyingine',
]

const MOBILE_NETWORKS = ['M-Pesa (Vodacom)', 'Airtel Money', 'Tigo Pesa (Mixx)', 'Halopesa', 'T-Pesa (TTCL)']

const DOC_TYPES = [
  { v: 'nida_copy',       l: 'Nakala ya NIDA',              icon: 'id-badge',       required: true },
  { v: 'cv',              l: 'CV / Resume',                  icon: 'file-text',      required: true },
  { v: 'degree',          l: 'Cheti cha Shahada/Diploma',    icon: 'certificate',    required: false },
  { v: 'secondary_cert',  l: 'Cheti cha CSEE (Kidato cha 4)', icon: 'school',        required: false },
  { v: 'good_conduct',    l: 'Cheti cha Mwenendo Mzuri',     icon: 'shield-check',   required: false },
  { v: 'recommendation',  l: 'Barua ya Kupendekeza',         icon: 'mail',           required: false },
  { v: 'professional_cert', l: 'Cheti cha Kitaalamu',        icon: 'award',          required: false },
  { v: 'other',           l: 'Nyingine',                     icon: 'paperclip',      required: false },
]

function ProfileTab({
  staffId,
  staffName,
  showToast,
}: {
  staffId: string
  staffName: string
  showToast: (msg: string, ok?: boolean) => void
}) {
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const [deletingDoc,  setDeletingDoc]  = useState<string | null>(null)
  const [legalInfo,    setLegalInfo]    = useState<LegalInfo | null>(null)
  const [documents,    setDocuments]    = useState<StaffDocument[]>([])
  const [payroll,      setPayroll]      = useState<PayrollData | null>(null)
  const [section,      setSection]      = useState<'form' | 'docs' | 'payroll'>('form')

  const [form, setForm] = useState({
    nida_number: '', date_of_birth: '', marital_status: '',
    tin_number: '', nssf_number: '', nhif_number: '',
    bank_name: '', bank_account_number: '', bank_branch: '',
    mobile_money_network: '', mobile_money_number: '',
    emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '',
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/staff/legal')
      const d   = await res.json()
      if (d.legalInfo) {
        setLegalInfo(d.legalInfo)
        setForm({
          nida_number:               d.legalInfo.nida_number               ?? '',
          date_of_birth:             d.legalInfo.date_of_birth             ?? '',
          marital_status:            d.legalInfo.marital_status            ?? '',
          tin_number:                d.legalInfo.tin_number                ?? '',
          nssf_number:               d.legalInfo.nssf_number               ?? '',
          nhif_number:               d.legalInfo.nhif_number               ?? '',
          bank_name:                 d.legalInfo.bank_name                 ?? '',
          bank_account_number:       d.legalInfo.bank_account_number       ?? '',
          bank_branch:               d.legalInfo.bank_branch               ?? '',
          mobile_money_network:      d.legalInfo.mobile_money_network      ?? '',
          mobile_money_number:       d.legalInfo.mobile_money_number       ?? '',
          emergency_contact_name:    d.legalInfo.emergency_contact_name    ?? '',
          emergency_contact_phone:   d.legalInfo.emergency_contact_phone   ?? '',
          emergency_contact_relation:d.legalInfo.emergency_contact_relation ?? '',
        })
      }
      setDocuments(d.documents ?? [])
      setPayroll(d.payroll ?? null)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const isVerified = legalInfo?.verification_status === 'verified'
  const isRejected = legalInfo?.verification_status === 'rejected'

  async function saveForm(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res  = await fetch('/api/v1/staff/legal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Hitilafu')
      setLegalInfo(json.legalInfo)
      showToast('Taarifa zimehifadhiwa. Zinasubiri ukaguzi wa admin.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Hitilafu imetokea', false)
    } finally {
      setSaving(false)
    }
  }

  async function uploadDoc(docType: string, file: File) {
    setUploadingDoc(docType)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('document_type', docType)
      fd.append('document_name', DOC_TYPES.find(d => d.v === docType)?.l ?? docType)
      const res  = await fetch('/api/v1/staff/documents', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Imeshindwa kupakia')
      setDocuments(prev => [json.document, ...prev])
      showToast('Hati imepakiwa')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Imeshindwa kupakia faili', false)
    } finally {
      setUploadingDoc(null)
    }
  }

  async function deleteDoc(docId: string) {
    setDeletingDoc(docId)
    try {
      const res  = await fetch(`/api/v1/staff/documents?id=${docId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Imeshindwa kufuta')
      setDocuments(prev => prev.filter(d => d.id !== docId))
      showToast('Hati imefutwa')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Imeshindwa kufuta', false)
    } finally {
      setDeletingDoc(null)
    }
  }

  function fmtMoney(n: number) {
    return new Intl.NumberFormat('sw-TZ').format(n) + ' TZS'
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl h-32 animate-pulse border border-gray-100" />
        ))}
      </div>
    )
  }

  const gross = payroll
    ? payroll.basic_salary + payroll.house_allowance + payroll.transport_allowance +
      payroll.meal_allowance + payroll.phone_allowance + payroll.other_allowances
    : 0
  const totalDeductions = payroll
    ? payroll.nssf_employee + payroll.nhif_employee + payroll.paye_tax + payroll.other_deductions
    : 0
  const netSalary = gross - totalDeductions

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Status banner */}
      {legalInfo && (
        <div className={`rounded-2xl p-4 border flex items-start gap-3 ${
          isVerified ? 'bg-green-50 border-green-200' :
          isRejected ? 'bg-red-50 border-red-200' :
          'bg-amber-50 border-amber-200'
        }`}>
          <i className={`ti text-xl flex-shrink-0 mt-0.5 ${
            isVerified ? 'ti-circle-check text-green-600' :
            isRejected ? 'ti-circle-x text-red-500' :
            'ti-clock text-amber-500'
          }`} aria-hidden="true" />
          <div>
            <p className={`font-semibold text-sm ${
              isVerified ? 'text-green-800' : isRejected ? 'text-red-700' : 'text-amber-700'
            }`}>
              {isVerified ? 'Taarifa Zimethihibitiwa' :
               isRejected ? 'Taarifa Zimekataliwa — Tafadhali Sasishe' :
               'Zinasubiri Ukaguzi wa Admin'}
            </p>
            {isRejected && legalInfo.rejection_reason && (
              <p className="text-xs text-red-600 mt-0.5">{legalInfo.rejection_reason}</p>
            )}
            {legalInfo.admin_notes && (
              <p className="text-xs text-gray-500 mt-0.5">Maelezo ya Admin: {legalInfo.admin_notes}</p>
            )}
          </div>
        </div>
      )}

      {/* Section tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 p-1 flex gap-1">
        {([
          { key: 'form' as const,    label: 'Taarifa Binafsi',  icon: 'user' },
          { key: 'docs' as const,    label: 'Nyaraka',          icon: 'file-text' },
          { key: 'payroll' as const, label: 'Mshahara',         icon: 'coin' },
        ]).map(s => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              section === s.key ? 'bg-primary-500 text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}>
            <i className={`ti ti-${s.icon}`} aria-hidden="true" />
            {s.label}
          </button>
        ))}
      </div>

      {/* ── FORM SECTION ────────────────────────────────── */}
      {section === 'form' && (
        <form onSubmit={saveForm} className="space-y-4">

          {/* Personal Info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center">
                <i className="ti ti-user text-primary-600 text-sm" aria-hidden="true" />
              </span>
              Taarifa Binafsi
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">
                  Nambari ya NIDA <span className="text-red-400">*</span>
                </label>
                <input
                  value={form.nida_number}
                  onChange={e => setForm(f => ({ ...f, nida_number: e.target.value }))}
                  placeholder="e.g. 19900101-12345-12345-01"
                  disabled={isVerified}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Tarehe ya Kuzaliwa</label>
                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))}
                    disabled={isVerified}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Hali ya Ndoa</label>
                  <select
                    value={form.marital_status}
                    onChange={e => setForm(f => ({ ...f, marital_status: e.target.value }))}
                    disabled={isVerified}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:bg-gray-50"
                  >
                    <option value="">Chagua...</option>
                    {MARITAL_STATUS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Social Security & Tax */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <i className="ti ti-shield text-blue-600 text-sm" aria-hidden="true" />
              </span>
              Usalama wa Jamii na Kodi (TRA)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { key: 'nssf_number',  label: 'Nambari ya NSSF',  placeholder: 'Nambari ya NSSF' },
                { key: 'nhif_number',  label: 'Nambari ya NHIF',  placeholder: 'Nambari ya NHIF' },
                { key: 'tin_number',   label: 'TIN (TRA)',         placeholder: 'Nambari ya TIN' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">{f.label}</label>
                  <input
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    disabled={isVerified}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Bank & Payment */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                <i className="ti ti-building-bank text-green-600 text-sm" aria-hidden="true" />
              </span>
              Benki na Malipo
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Jina la Benki</label>
                <select
                  value={form.bank_name}
                  onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
                  disabled={isVerified}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:bg-gray-50"
                >
                  <option value="">Chagua benki...</option>
                  {TANZANIA_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Nambari ya Akaunti</label>
                  <input
                    value={form.bank_account_number}
                    onChange={e => setForm(f => ({ ...f, bank_account_number: e.target.value }))}
                    placeholder="Nambari ya akaunti"
                    disabled={isVerified}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Tawi</label>
                  <input
                    value={form.bank_branch}
                    onChange={e => setForm(f => ({ ...f, bank_branch: e.target.value }))}
                    placeholder="Tawi (branch)"
                    disabled={isVerified}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:bg-gray-50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Mtandao wa Pesa (Simu)</label>
                  <select
                    value={form.mobile_money_network}
                    onChange={e => setForm(f => ({ ...f, mobile_money_network: e.target.value }))}
                    disabled={isVerified}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:bg-gray-50"
                  >
                    <option value="">Si lazima</option>
                    {MOBILE_NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Nambari ya Simu (Pesa)</label>
                  <input
                    value={form.mobile_money_number}
                    onChange={e => setForm(f => ({ ...f, mobile_money_number: e.target.value }))}
                    placeholder="255XXXXXXXXX"
                    disabled={isVerified}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:bg-gray-50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                <i className="ti ti-phone-call text-red-500 text-sm" aria-hidden="true" />
              </span>
              Mtu wa Dharura
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { key: 'emergency_contact_name',     label: 'Jina Kamili',   placeholder: 'Jina la mtu wa dharura' },
                { key: 'emergency_contact_phone',    label: 'Nambari ya Simu', placeholder: '255XXXXXXXXX' },
                { key: 'emergency_contact_relation', label: 'Uhusiano',       placeholder: 'e.g. Mke, Baba, Kaka' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">{f.label}</label>
                  <input
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    disabled={isVerified}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
              ))}
            </div>
          </div>

          {!isVerified && (
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-primary-500 text-white py-3.5 rounded-2xl font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {saving
                ? <><i className="ti ti-loader-2 animate-spin" /> Inahifadhi...</>
                : <><i className="ti ti-device-floppy" /> Hifadhi Taarifa</>
              }
            </button>
          )}
          {isVerified && (
            <p className="text-center text-xs text-gray-400 pb-2">
              Taarifa zimethihibitiwa. Wasiliana na admin kufanya mabadiliko.
            </p>
          )}
        </form>
      )}

      {/* ── DOCUMENTS SECTION ───────────────────────────── */}
      {section === 'docs' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 text-sm mb-1">Pakia Nyaraka Zako</h3>
            <p className="text-xs text-gray-400 mb-4">PDF, JPG au PNG — kiwango cha juu 10MB kila moja</p>
            <div className="space-y-2">
              {DOC_TYPES.map(dt => {
                const existing = documents.find(d => d.document_type === dt.v)
                const uploading = uploadingDoc === dt.v
                return (
                  <div key={dt.v} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                    <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                      <i className={`ti ti-${dt.icon} text-gray-500 text-sm`} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                        {dt.l}
                        {dt.required && <span className="text-red-400 text-[10px]">*Lazima</span>}
                      </p>
                      {existing ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {existing.is_verified
                            ? <span className="text-[10px] text-green-600 font-medium flex items-center gap-0.5"><i className="ti ti-circle-check" /> Imethihibitiwa</span>
                            : <span className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5"><i className="ti ti-clock" /> Inasubiri ukaguzi</span>
                          }
                          <span className="text-[10px] text-gray-400">· {existing.file_size_kb}KB</span>
                        </div>
                      ) : (
                        <p className="text-[10px] text-gray-400 mt-0.5">Haijapakiwa</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {existing && (
                        <>
                          <a href={existing.document_url} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] text-blue-600 font-medium hover:underline">
                            Angalia
                          </a>
                          {!existing.is_verified && (
                            <button
                              onClick={() => deleteDoc(existing.id)}
                              disabled={deletingDoc === existing.id}
                              className="text-[10px] text-red-400 hover:text-red-600 disabled:opacity-40"
                            >
                              {deletingDoc === existing.id ? <i className="ti ti-loader-2 animate-spin text-xs" /> : 'Futa'}
                            </button>
                          )}
                        </>
                      )}
                      <label className={`cursor-pointer text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-all ${
                        uploading
                          ? 'bg-gray-100 text-gray-400 pointer-events-none'
                          : existing
                          ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          : 'bg-primary-500 text-white hover:bg-primary-600'
                      }`}>
                        {uploading
                          ? <><i className="ti ti-loader-2 animate-spin text-xs" /> Inapakia...</>
                          : existing ? 'Badilisha' : 'Pakia'
                        }
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          className="hidden"
                          disabled={uploading}
                          onChange={e => {
                            const f = e.target.files?.[0]
                            if (f) { uploadDoc(dt.v, f); e.target.value = '' }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── PAYROLL SECTION ─────────────────────────────── */}
      {section === 'payroll' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-2">
            <i className="ti ti-coin text-primary-500" aria-hidden="true" /> Muundo wa Mshahara
          </h3>
          <p className="text-xs text-gray-400 mb-5">
            Muundo uliowekwa na admin. Hesabu zinafuata sheria za TRA Tanzania.
          </p>

          {!payroll ? (
            <div className="text-center py-12">
              <i className="ti ti-coin-off text-4xl text-gray-300 block mb-3" aria-hidden="true" />
              <p className="text-sm font-semibold text-gray-500">Mshahara bado haujawekwa</p>
              <p className="text-xs text-gray-400 mt-1">Admin ataweka muundo wa mshahara wako hivi karibuni.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Gross breakdown */}
              <div className="bg-primary-50 rounded-2xl p-4">
                <p className="text-xs font-bold text-primary-700 uppercase tracking-wide mb-3">Mapato (Gross)</p>
                <div className="space-y-2">
                  {[
                    { label: 'Mshahara wa Msingi (Basic)',     value: payroll.basic_salary },
                    { label: 'Posho ya Nyumba',                value: payroll.house_allowance },
                    { label: 'Posho ya Usafiri',               value: payroll.transport_allowance },
                    { label: 'Posho ya Chakula',               value: payroll.meal_allowance },
                    { label: 'Posho ya Simu',                  value: payroll.phone_allowance },
                    { label: payroll.other_allowances_notes || 'Posho Nyingine', value: payroll.other_allowances },
                  ].filter(r => r.value > 0).map((r, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-primary-700">{r.label}</span>
                      <span className="font-semibold text-primary-800 tabular-nums">{fmtMoney(r.value)}</span>
                    </div>
                  ))}
                  <div className="border-t border-primary-200 pt-2 flex justify-between text-sm font-bold">
                    <span className="text-primary-800">Jumla ya Mapato</span>
                    <span className="text-primary-700 tabular-nums">{fmtMoney(gross)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div className="bg-red-50 rounded-2xl p-4">
                <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-3">Makato (Deductions)</p>
                <div className="space-y-2">
                  {[
                    { label: 'NSSF (10% ya Basic)',            value: payroll.nssf_employee },
                    { label: 'NHIF (4% ya Gross)',             value: payroll.nhif_employee },
                    { label: 'Kodi ya Mapato (PAYE - TRA)',    value: payroll.paye_tax },
                    { label: payroll.other_deductions_notes || 'Makato Mengine', value: payroll.other_deductions },
                  ].filter(r => r.value > 0).map((r, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-red-700">{r.label}</span>
                      <span className="font-semibold text-red-800 tabular-nums">- {fmtMoney(r.value)}</span>
                    </div>
                  ))}
                  <div className="border-t border-red-200 pt-2 flex justify-between text-sm font-bold">
                    <span className="text-red-800">Jumla ya Makato</span>
                    <span className="text-red-700 tabular-nums">- {fmtMoney(totalDeductions)}</span>
                  </div>
                </div>
              </div>

              {/* Net salary */}
              <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-4 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-primary-200 text-xs font-medium">Mshahara Halisi (Take-Home)</p>
                    <p className="text-2xl font-bold mt-0.5 tabular-nums">{fmtMoney(netSalary)}</p>
                  </div>
                  <i className="ti ti-wallet text-4xl text-white/30" aria-hidden="true" />
                </div>
                <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-primary-200">Njia ya Malipo</p>
                    <p className="font-semibold mt-0.5 capitalize">
                      {payroll.payment_method === 'bank' ? 'Benki' :
                       payroll.payment_method === 'mobile_money' ? 'Pesa ya Simu' : 'Taslimu'}
                    </p>
                  </div>
                  <div>
                    <p className="text-primary-200">Tarehe ya Kuanza</p>
                    <p className="font-semibold mt-0.5">
                      {new Date(payroll.effective_from).toLocaleDateString('sw-TZ', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                {payroll.notes && (
                  <p className="text-primary-200 text-xs mt-2 italic">{payroll.notes}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
