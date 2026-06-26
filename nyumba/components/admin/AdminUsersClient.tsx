'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PLAN_BADGES, getPlan } from '@/lib/config/subscription-plans'

// ── Types ─────────────────────────────────────────────────────────────────────
type RoleFilter   = 'all' | 'client' | 'dalali' | 'staff' | 'dalali_activity'
type StatusFilter = 'all' | 'active' | 'suspended'
type SortOption   = 'newest' | 'oldest' | 'name'

type SummaryStats = {
  total: number
  clients: number
  dalali: number
  staff: number
  active: number
  suspended: number
  verified_dalali: number
}

type UserRow = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  role: string
  avatar_url: string | null
  is_active: boolean | null
  created_at: string
  dalali_profiles: {
    whatsapp_number: string | null
    verification_status: string | null
    is_premium_verified: boolean
    rating_avg: number | null
  } | null
  subscriptions: { plan: string; status: string; expires_at: string | null }[]
}

type Counts = { all: number; client: number; dalali: number; staff: number }

// ── Helpers ───────────────────────────────────────────────────────────────────
const WA_PATH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z'

function waNum(raw: string) { return raw.replace(/[^0-9]/g, '') }

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

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    admin:  { label: '🛡️ Admin',    cls: 'bg-red-50 text-red-600'        },
    dalali: { label: '🏢 Dalali',   cls: 'bg-amber-50 text-amber-700'    },
    client: { label: '🔍 Mteja',    cls: 'bg-blue-50 text-blue-700'      },
    staff:  { label: '👨‍💼 Wafanyakazi', cls: 'bg-purple-50 text-purple-700' },
  }
  const b = map[role] ?? { label: role, cls: 'bg-gray-100 text-gray-500' }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.cls}`}>{b.label}</span>
}

function VerifBadge({ status }: { status?: string | null }) {
  if (status === 'approved') return <span className="text-xs bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded-full font-medium">✓ Imethibitishwa</span>
  if (status === 'pending')  return <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">⏳ Inasubiri</span>
  return <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full font-medium">✗ Hakuna</span>
}

function SubBadge({ subscriptions }: { subscriptions: UserRow['subscriptions'] }) {
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

// ── Action Menu (dropdown for table rows) ─────────────────────────────────────
function ActionMenu({ user, onView, onSuspend, onBan, onDelete, loading }: {
  user: UserRow
  onView?: string
  onSuspend: () => void
  onBan: () => void
  onDelete: () => void
  loading: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const waNum = user.dalali_profiles?.whatsapp_number?.replace(/\D/g, '') ?? ''

  return (
    <div className="relative flex justify-center" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        disabled={loading}
        title="Vitendo"
        className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-xl transition-colors disabled:opacity-40 ${
          open ? 'bg-gray-200 text-gray-700' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'
        }`}
      >
        {loading ? <span className="text-xs font-normal">...</span> : '⋮'}
      </button>

      {open && (
        <div
          className="absolute right-0 top-9 z-30 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 min-w-[185px]"
          onClick={e => e.stopPropagation()}
        >
          {onView && (
            <Link
              href={onView}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-primary-700 hover:bg-primary-50 transition-colors w-full"
            >
              <span>👁️</span>
              <span className="font-medium">Angalia Profaili</span>
            </Link>
          )}
          <button
            onClick={() => { onSuspend(); setOpen(false) }}
            className={`flex items-center gap-2.5 px-3 py-2.5 text-sm w-full text-left transition-colors ${
              user.is_active === false ? 'text-green-700 hover:bg-green-50' : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            <span>{user.is_active === false ? '✅' : '⏸️'}</span>
            <span className="font-medium">{user.is_active === false ? 'Washa Akaunti' : 'Simamisha'}</span>
          </button>
          {user.is_active !== false && (
            <button
              onClick={() => { onBan(); setOpen(false) }}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-orange-700 w-full text-left hover:bg-orange-50 transition-colors"
            >
              <span>🚫</span>
              <span className="font-medium">Ban Mtumiaji</span>
            </button>
          )}
          {waNum && (
            <a
              href={`https://wa.me/${waNum}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm w-full hover:bg-green-50 transition-colors"
              style={{ color: '#128C7E' }}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" style={{ fill: '#128C7E' }}>
                <path d={WA_PATH} />
              </svg>
              <span className="font-medium">Tuma WhatsApp</span>
            </a>
          )}
          <div className="border-t border-gray-100 mt-1 pt-1">
            <button
              onClick={() => { onDelete(); setOpen(false) }}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 w-full text-left hover:bg-red-50 transition-colors"
            >
              <span>🗑️</span>
              <span className="font-medium">Futa Akaunti</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminUsersClient() {
  const [roleFilter,   setRoleFilter]   = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortBy,       setSortBy]       = useState<SortOption>('newest')
  const [search, setSearch]             = useState('')
  const [debouncedQ, setDebouncedQ]     = useState('')
  const [page, setPage]                 = useState(1)

  const [users, setUsers]   = useState<UserRow[]>([])
  const [counts, setCounts] = useState<Counts>({ all: 0, client: 0, dalali: 0, staff: 0 })
  const [total, setTotal]   = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  const [summary, setSummary]           = useState<SummaryStats | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)

  // Action state
  const [actionLoading, setActionLoading]       = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId]   = useState<string | null>(null)
  const [deleteReason, setDeleteReason]         = useState('')
  const [deleteNotify, setDeleteNotify]         = useState(true)
  const [actionError, setActionError]           = useState('')
  const [newUserBanner, setNewUserBanner]       = useState<string | null>(null)

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setDebouncedQ(search)
      setPage(1)
    }, 350)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [search])

  // Reset page when any filter changes
  useEffect(() => { setPage(1) }, [roleFilter, statusFilter, sortBy])

  // Fetch summary stats once on mount
  useEffect(() => {
    fetch('/api/v1/admin/users/summary')
      .then(r => r.json())
      .then(d => setSummary(d))
      .catch(() => {})
  }, [])

  // Fetch users
  const fetchUsers = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        role:     roleFilter,
        q:        debouncedQ,
        status:   statusFilter,
        sort:     sortBy,
        page:     String(page),
        per_page: '50',
      })
      const res  = await fetch(`/api/v1/admin/users?${params}`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Imeshindwa kupakia')
      const data = await res.json()
      setUsers(data.users)
      setCounts(data.counts)
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Hitilafu imetokea')
    } finally {
      setLoading(false)
    }
  }, [roleFilter, debouncedQ, statusFilter, sortBy, page])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // Realtime subscription — listen for new users and updates
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('admin-users-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'users' },
        (payload) => {
          const u = payload.new as UserRow
          setNewUserBanner(`Mtumiaji mpya: ${u.full_name ?? 'Mpya'} (${u.role})`)
          setTimeout(() => setNewUserBanner(null), 8_000)
          // Refresh silently
          fetchUsers({ silent: true })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users' },
        () => { fetchUsers({ silent: true }) }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchUsers])

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleBan(userId: string) {
    setActionLoading(userId)
    setActionError('')
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ban' }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Imeshindwa')
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: false } : u))
      setSummary(prev => prev ? { ...prev, active: Math.max(0, prev.active - 1), suspended: prev.suspended + 1 } : prev)
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Hitilafu imetokea')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSuspendActivate(userId: string, action: 'suspend' | 'activate') {
    setActionLoading(userId)
    setActionError('')
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Imeshindwa')
      const isActive = action === 'activate'
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: isActive } : u))
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Hitilafu imetokea')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(userId: string) {
    setActionLoading(userId)
    setConfirmDeleteId(null)
    setActionError('')
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason || 'Admin deletion', notify: deleteNotify }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Imeshindwa')
      setUsers(prev => prev.filter(u => u.id !== userId))
      setCounts(prev => ({
        ...prev,
        all: Math.max(0, prev.all - 1),
      }))
      setDeleteReason('')
      setDeleteNotify(true)
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Hitilafu imetokea')
    } finally {
      setActionLoading(null)
    }
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabs: { key: RoleFilter; label: string; count: number }[] = [
    { key: 'all',              label: 'Wote',          count: counts.all    },
    { key: 'client',           label: 'Wateja',        count: counts.client },
    { key: 'dalali',           label: 'Madalali',      count: counts.dalali },
    { key: 'staff',            label: 'Wafanyakazi',   count: counts.staff  },
    { key: 'dalali_activity',  label: '📊 Shughuli',   count: 0             },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* ── Header ── */}
      <div className="hidden lg:flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white">
        <div>
          <h1 className="text-xl font-bold text-gray-900">👥 Watumiaji</h1>
          <p className="text-xs text-gray-400 mt-0.5">Jumla: {counts.all.toLocaleString()} watumiaji</p>
        </div>
        <button
          onClick={() => fetchUsers()}
          className="text-xs bg-primary-50 text-primary-700 px-3 py-2 rounded-xl font-semibold border border-primary-100"
        >
          ↺ Onyesha Upya
        </button>
      </div>

      {/* ── Mobile header ── */}
      <div className="lg:hidden bg-primary-800 px-4 pt-10 pb-5">
        <h1 className="text-white text-xl font-bold">👥 Watumiaji</h1>
        <p className="text-green-200 text-xs mt-0.5">Jumla: {counts.all.toLocaleString()} watumiaji</p>
      </div>

      {/* ── New user banner ── */}
      {newUserBanner && (
        <div className="mx-4 mt-3 bg-primary-500 text-white text-sm font-medium px-4 py-3 rounded-2xl flex items-center gap-2 shadow-sm">
          <span className="text-lg">🔔</span>
          <span>{newUserBanner}</span>
          <button onClick={() => setNewUserBanner(null)} aria-label="Funga" className="ml-auto text-primary-100 hover:text-white">✕</button>
        </div>
      )}

      <div className="px-4 lg:px-6 pt-4 space-y-4">

        {/* ── Summary stat cards ── */}
        {summary && roleFilter !== 'dalali_activity' && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {[
              { label: 'Wote',       value: summary.total,           bg: 'bg-gray-50',     text: 'text-gray-800'    },
              { label: 'Wateja',     value: summary.clients,         bg: 'bg-blue-50',     text: 'text-blue-700'    },
              { label: 'Madalali',   value: summary.dalali,          bg: 'bg-amber-50',    text: 'text-amber-700'   },
              { label: 'Wafanyakazi',value: summary.staff,           bg: 'bg-purple-50',   text: 'text-purple-700'  },
              { label: 'Wanaotumia', value: summary.active,          bg: 'bg-green-50',    text: 'text-green-700'   },
              { label: 'Waliozuiliwa',value: summary.suspended,      bg: 'bg-red-50',      text: 'text-red-600'     },
              { label: 'Verified',   value: summary.verified_dalali, bg: 'bg-primary-50',  text: 'text-primary-700' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-2xl p-3 text-center`}>
                <p className={`text-lg font-bold ${s.text}`}>{s.value.toLocaleString()}</p>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Role tabs ── */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1 overflow-x-auto scrollbar-none">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setRoleFilter(t.key)}
              className={`flex-shrink-0 flex-1 min-w-[80px] py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                roleFilter === t.key ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-400'
              }`}
            >
              {t.label} {t.key !== 'dalali_activity' && <span className="text-[10px] opacity-70">({t.count})</span>}
            </button>
          ))}
        </div>

        {/* ── Search ── */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Tafuta jina, email, simu..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
            >
              ✕
            </button>
          )}
        </div>

        {/* ── Status filter + Sort (hidden for dalali_activity) ── */}
        {roleFilter !== 'dalali_activity' && (
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex gap-1">
              {([
                { key: 'all',       label: 'Wote'        },
                { key: 'active',    label: '✅ Wanaotumia'},
                { key: 'suspended', label: '⛔ Waliozuiliwa' },
              ] as { key: StatusFilter; label: string }[]).map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                    statusFilter === f.key
                      ? 'bg-gray-800 text-white border-gray-800'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-gray-400">Panga:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortOption)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none"
              >
                <option value="newest">Wapya Kwanza</option>
                <option value="oldest">Wakongwe Kwanza</option>
                <option value="name">Jina A–Z</option>
              </select>
            </div>
          </div>
        )}

        {/* ── Dalali Activity View ── */}
        {roleFilter === 'dalali_activity' && <DalaliActivityView />}

        {/* ── Error ── */}
        {roleFilter !== 'dalali_activity' && (error || actionError) && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
            {error || actionError}
          </div>
        )}

        {/* ── Loading ── */}
        {roleFilter !== 'dalali_activity' && loading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 h-20 animate-pulse" />
            ))}
          </div>
        )}

        {/* ── User list ── */}
        {roleFilter !== 'dalali_activity' && !loading && users.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <div className="text-4xl mb-2">👥</div>
            <p className="text-sm text-gray-500">
              {debouncedQ ? `Hakuna watumiaji wanaolingana na "${debouncedQ}"` : 'Hakuna watumiaji katika kundi hili'}
            </p>
          </div>
        )}

        {roleFilter !== 'dalali_activity' && !loading && users.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Mtumiaji</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">Email</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">Jukumu</th>
                    {roleFilter === 'dalali' || roleFilter === 'all' ? (
                      <>
                        <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Uthibitisho</th>
                        <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Subscription</th>
                      </>
                    ) : null}
                    <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">Alijiunga</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Vitendo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map(u => (
                    <tr
                      key={u.id}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${u.is_active === false ? 'opacity-60' : ''}`}
                      onClick={() => setSelectedUser(u)}
                    >
                      {/* Name + phone */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            u.role === 'admin'  ? 'bg-red-100 text-red-700' :
                            u.role === 'dalali' ? 'bg-amber-100 text-amber-700' :
                            u.role === 'staff'  ? 'bg-purple-100 text-purple-700' :
                                                  'bg-blue-100 text-blue-700'
                          }`}>
                            {u.full_name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate max-w-[130px]">{u.full_name}</p>
                            <p className="text-xs text-gray-400">{u.phone ?? '—'}</p>
                            {u.is_active === false && (
                              <span className="text-[10px] text-red-500">Imesimamishwa</span>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Email */}
                      <td className="px-3 py-3 text-xs text-gray-500 max-w-[160px] truncate">{u.email ?? '—'}</td>
                      {/* Role */}
                      <td className="px-3 py-3"><RoleBadge role={u.role} /></td>
                      {/* Dalali-specific columns */}
                      {(roleFilter === 'dalali' || roleFilter === 'all') ? (
                        <>
                          <td className="px-3 py-3 text-center">
                            {u.role === 'dalali' ? <VerifBadge status={u.dalali_profiles?.verification_status} /> : <span className="text-xs text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {u.role === 'dalali' ? <SubBadge subscriptions={u.subscriptions ?? []} /> : <span className="text-xs text-gray-300">—</span>}
                          </td>
                        </>
                      ) : null}
                      {/* Joined */}
                      <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap" suppressHydrationWarning>{timeAgo(u.created_at)}</td>
                      {/* Actions */}
                      <td className="px-2 py-3">
                        {u.role !== 'admin' ? (
                          <ActionMenu
                            user={u}
                            onView={u.role === 'dalali' ? `/admin/users/${u.id}` : undefined}
                            onSuspend={() => handleSuspendActivate(u.id, u.is_active === false ? 'activate' : 'suspend')}
                            onBan={() => handleBan(u.id)}
                            onDelete={() => setConfirmDeleteId(u.id)}
                            loading={actionLoading === u.id}
                          />
                        ) : (
                          <span className="block text-center text-xs text-gray-300">Admin</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {users.map(u => (
                <div key={u.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${u.is_active === false ? 'border-red-100 opacity-75' : 'border-gray-100'}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
                      u.role === 'admin'  ? 'bg-red-100 text-red-700' :
                      u.role === 'dalali' ? 'bg-amber-100 text-amber-700' :
                      u.role === 'staff'  ? 'bg-purple-100 text-purple-700' :
                                            'bg-blue-100 text-blue-700'
                    }`}>
                      {u.full_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-sm font-semibold text-gray-900">{u.full_name}</p>
                        {u.is_active === false && (
                          <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">Imesimamishwa</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{u.email ?? '—'}</p>
                      <p className="text-xs text-gray-400">{u.phone ?? '—'}</p>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <RoleBadge role={u.role} />
                        {u.role === 'dalali' && <VerifBadge status={u.dalali_profiles?.verification_status} />}
                        {u.role === 'dalali' && <SubBadge subscriptions={u.subscriptions ?? []} />}
                      </div>
                      {u.role === 'dalali' && u.dalali_profiles?.whatsapp_number && (
                        <a
                          href={`https://wa.me/${waNum(u.dalali_profiles.whatsapp_number)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 bg-[#25D366] text-white text-[10px] px-2 py-0.5 rounded-md mt-1"
                        >
                          <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white flex-shrink-0"><path d={WA_PATH}/></svg>
                          +{waNum(u.dalali_profiles.whatsapp_number)}
                        </a>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-300 flex-shrink-0" suppressHydrationWarning>{timeAgo(u.created_at)}</p>
                  </div>
                  {u.role !== 'admin' && (
                    <div className="flex gap-2 flex-wrap pt-1">
                      {u.role === 'dalali' && (
                        <Link href={`/admin/users/${u.id}`}
                          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-100">
                          👁️ Angalia
                        </Link>
                      )}
                      <button
                        onClick={() => handleSuspendActivate(u.id, u.is_active === false ? 'activate' : 'suspend')}
                        disabled={actionLoading === u.id}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.97] disabled:opacity-40 ${
                          u.is_active === false ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {actionLoading === u.id ? '...' : u.is_active === false ? '✅ Washa' : '⏸️ Simamisha'}
                      </button>
                      {u.is_active !== false && (
                        <button
                          onClick={() => handleBan(u.id)}
                          disabled={actionLoading === u.id}
                          className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-orange-50 text-orange-700 disabled:opacity-40 active:scale-[0.97] transition-all"
                          title="Ban Mtumiaji"
                        >
                          🚫
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmDeleteId(u.id)}
                        disabled={actionLoading === u.id}
                        className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-red-50 text-red-600 disabled:opacity-40 active:scale-[0.97] transition-all"
                        title="Futa Akaunti"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-gray-400">
                  Ukurasa {page} / {totalPages} · Watumiaji {total.toLocaleString()}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="text-xs px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
                  >
                    ← Nyuma
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="text-xs px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
                  >
                    Mbele →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Delete confirmation modal ── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setConfirmDeleteId(null)}>
          <div
            className="bg-white w-full rounded-t-3xl px-6 pt-4 pb-10 shadow-xl max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
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
              <button
                onClick={() => { setConfirmDeleteId(null); setDeleteReason('') }}
                className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-700 font-semibold text-sm"
              >
                Ghairi
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={!deleteReason || !!actionLoading}
                className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-bold text-sm disabled:opacity-40"
              >
                {actionLoading ? '...' : '🗑️ Futa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── User detail modal ── */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onSuspend={() => { handleSuspendActivate(selectedUser.id, selectedUser.is_active === false ? 'activate' : 'suspend'); setSelectedUser(null) }}
          onBan={() => { handleBan(selectedUser.id); setSelectedUser(null) }}
          onDelete={() => { setConfirmDeleteId(selectedUser.id); setSelectedUser(null) }}
        />
      )}
    </div>
  )
}

// ── User Detail Modal ─────────────────────────────────────────────────────────

function UserDetailModal({
  user, onClose, onSuspend, onBan, onDelete,
}: {
  user: UserRow
  onClose: () => void
  onSuspend: () => void
  onBan: () => void
  onDelete: () => void
}) {
  const ROLE_COLOR: Record<string, string> = {
    admin:  'bg-red-100 text-red-700',
    dalali: 'bg-amber-100 text-amber-700',
    staff:  'bg-purple-100 text-purple-700',
    client: 'bg-blue-100 text-blue-700',
  }
  const ROLE_LABEL: Record<string, string> = {
    admin: '🛡️ Admin', dalali: '🏢 Dalali',
    staff: '👨‍💼 Wafanyakazi', client: '🔍 Mteja',
  }
  const waNum = (user.dalali_profiles?.whatsapp_number ?? '').replace(/\D/g, '')

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl px-5 pt-4 pb-10 sm:pb-5 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4 sm:hidden" />

        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold flex-shrink-0 ${ROLE_COLOR[user.role] ?? 'bg-gray-100 text-gray-700'}`}>
            {user.full_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-base leading-tight">{user.full_name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLOR[user.role] ?? 'bg-gray-100 text-gray-500'}`}>
              {ROLE_LABEL[user.role] ?? user.role}
            </span>
          </div>
          <button aria-label="Funga" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg flex-shrink-0">✕</button>
        </div>

        {/* Info rows */}
        <div className="space-y-2 mb-4 text-sm">
          {[
            { label: 'Email',   value: user.email   ?? '—' },
            { label: 'Simu',    value: user.phone   ?? '—' },
            { label: 'Hali',    value: user.is_active === false ? '⛔ Imezuiliwa' : '✅ Inatumika' },
            { label: 'Alijiunga', value: new Date(user.created_at).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' }) },
          ].map(r => (
            <div key={r.label} className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span className="text-gray-500 text-xs">{r.label}</span>
              <span className="text-gray-800 font-medium text-xs text-right max-w-[200px] truncate">{r.value}</span>
            </div>
          ))}

          {/* Dalali-specific */}
          {user.role === 'dalali' && user.dalali_profiles && (
            <>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                <span className="text-gray-500 text-xs">Uthibitisho</span>
                <span className="text-xs font-medium">
                  {user.dalali_profiles.verification_status === 'approved' ? '✓ Imethibitishwa'
                    : user.dalali_profiles.verification_status === 'pending' ? '⏳ Inasubiri'
                    : '✗ Hakuna'}
                </span>
              </div>
              {user.subscriptions?.find(s => s.status === 'active') && (
                <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                  <span className="text-gray-500 text-xs">Subscription</span>
                  <span className="text-xs font-medium capitalize">
                    {user.subscriptions.find(s => s.status === 'active')?.plan ?? '—'}
                  </span>
                </div>
              )}
              {user.dalali_profiles.rating_avg != null && (
                <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                  <span className="text-gray-500 text-xs">Rating</span>
                  <span className="text-xs font-medium">⭐ {user.dalali_profiles.rating_avg.toFixed(1)}</span>
                </div>
              )}
              {waNum && (
                <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                  <span className="text-gray-500 text-xs">WhatsApp</span>
                  <a
                    href={`https://wa.me/${waNum}`}
                    target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="inline-flex items-center gap-1 bg-[#25D366] text-white text-[10px] px-2 py-0.5 rounded-md"
                  >
                    <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    {user.dalali_profiles.whatsapp_number}
                  </a>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        {user.role !== 'admin' && (
          <div className="flex flex-wrap gap-2">
            {user.role === 'dalali' && (
              <Link
                href={`/admin/users/${user.id}`}
                onClick={onClose}
                className="flex-1 text-center py-2.5 rounded-xl text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-100"
              >
                Profaili →
              </Link>
            )}
            <button
              onClick={onSuspend}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold ${
                user.is_active === false ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {user.is_active === false ? '✅ Washa' : '⏸️ Simamisha'}
            </button>
            {user.is_active !== false && (
              <button
                onClick={onBan}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-orange-50 text-orange-700"
              >
                🚫 Ban
              </button>
            )}
            <button
              onClick={onDelete}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-50 text-red-600"
            >
              🗑️
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// DALALI ACTIVITY VIEW
// ══════════════════════════════════════════════════════════════════════════════

type DalaliActivity = {
  id: string
  name: string
  email: string | null
  phone: string | null
  registered_at: string
  last_listing_at: string | null
  listing_warnings_count: number | null
  listing_deadline_days: number | null
  account_deletion_scheduled_at: string | null
  is_active: boolean | null
  whatsapp_number: string | null
  subscription_plan: string | null
  days_since_registration: number
  days_since_last_listing: number | null
  total_listings_ever: number
  active_listings: number
  days_before_deletion: number | null
  risk_level: 'safe' | 'new' | 'at_risk' | 'critical' | 'overdue'
}

type ActivityReport = {
  dalali: DalaliActivity[]
  total: number
  summary: { safe: number; new: number; atRisk: number; critical: number; overdue: number }
}

function DalaliActivityView() {
  const [report, setReport]       = useState<ActivityReport | null>(null)
  const [riskFilter, setRiskFilter] = useState('all')
  const [daysFilter, setDaysFilter] = useState('')
  const [loading, setLoading]     = useState(true)
  const [extendModal, setExtendModal] = useState<DalaliActivity | null>(null)

  const loadReport = async (risk = riskFilter, days = daysFilter) => {
    setLoading(true)
    const params = new URLSearchParams({ risk })
    if (days) params.set('days', days)
    const res = await fetch(`/api/v1/admin/dalali/activity?${params}`)
    const data = await res.json()
    setReport(data)
    setLoading(false)
  }

  useEffect(() => { loadReport() }, [riskFilter, daysFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const RISK_CARDS = [
    { key: 'safe',     label: 'Salama',     desc: 'Ana listings',    color: 'green',  count: report?.summary.safe     ?? 0 },
    { key: 'new',      label: 'Wapya',      desc: 'Chini ya siku 30', color: 'blue',  count: report?.summary.new      ?? 0 },
    { key: 'at_risk',  label: 'Hatarini',   desc: 'Siku 30–60',      color: 'amber',  count: report?.summary.atRisk   ?? 0 },
    { key: 'critical', label: 'Hatari Sana',desc: 'Siku 60–85',      color: 'orange', count: report?.summary.critical ?? 0 },
    { key: 'overdue',  label: 'Imepita',    desc: 'Siku 85+',        color: 'red',    count: report?.summary.overdue  ?? 0 },
  ] as const

  const colorMap = {
    green:  { active: 'border-green-500 bg-green-50',   text: 'text-green-600'  },
    blue:   { active: 'border-blue-500 bg-blue-50',     text: 'text-blue-600'   },
    amber:  { active: 'border-amber-500 bg-amber-50',   text: 'text-amber-600'  },
    orange: { active: 'border-orange-500 bg-orange-50', text: 'text-orange-600' },
    red:    { active: 'border-red-500 bg-red-50',       text: 'text-red-600'    },
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {RISK_CARDS.map(card => {
          const c = colorMap[card.color]
          const active = riskFilter === card.key
          return (
            <button
              key={card.key}
              onClick={() => setRiskFilter(active ? 'all' : card.key)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                active ? c.active : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <p className={`text-2xl font-bold ${c.text}`}>{card.count}</p>
              <p className="text-xs font-medium text-gray-700">{card.label}</p>
              <p className="text-[10px] text-gray-400">{card.desc}</p>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={() => setRiskFilter('all')}
          className={`text-sm px-3 py-1.5 rounded-lg border ${
            riskFilter === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'text-gray-600 border-gray-200'
          }`}
        >
          Wote
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-gray-500">Siku bila listing zaidi ya:</label>
          <select
            value={daysFilter}
            onChange={e => setDaysFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          >
            <option value="">Chagua...</option>
            <option value="7">Siku 7+</option>
            <option value="14">Siku 14+</option>
            <option value="30">Siku 30+</option>
            <option value="60">Siku 60+</option>
            <option value="80">Siku 80+</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Dalali</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">Hali</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">Alijisajili</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">Listings</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">Muda Uliosalia</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Maonyo</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-4 py-3">
                        <div className="h-5 bg-gray-100 animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                : (report?.dalali ?? []).map(d => (
                    <DalaliActivityRow key={d.id} dalali={d} onExtend={() => setExtendModal(d)} />
                  ))}
            </tbody>
          </table>
        </div>
        {!loading && (report?.dalali ?? []).length === 0 && (
          <div className="py-8 text-center text-gray-400 text-sm">
            Hakuna madalali wanaolingana na filter
          </div>
        )}
      </div>

      {extendModal && (
        <ExtendDeadlineModal
          dalali={extendModal}
          onClose={() => setExtendModal(null)}
          onExtended={() => { setExtendModal(null); loadReport() }}
        />
      )}
    </div>
  )
}

const RISK_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  safe:     { bg: 'bg-green-50',  text: 'text-green-700',  label: '✅ Salama'      },
  new:      { bg: 'bg-blue-50',   text: 'text-blue-700',   label: '🆕 Mpya'       },
  at_risk:  { bg: 'bg-amber-50',  text: 'text-amber-700',  label: '⚠️ Hatarini'   },
  critical: { bg: 'bg-orange-50', text: 'text-orange-700', label: '🔴 Hatari Sana' },
  overdue:  { bg: 'bg-red-50',    text: 'text-red-700',    label: '🚨 Imepita'    },
}

function DalaliActivityRow({ dalali, onExtend }: { dalali: DalaliActivity; onExtend: () => void }) {
  const risk = RISK_CONFIG[dalali.risk_level] ?? RISK_CONFIG.new
  const waNum = (dalali.whatsapp_number ?? dalali.phone ?? '').replace(/\D/g, '')

  return (
    <tr className={dalali.risk_level === 'overdue' ? 'bg-red-50/30' : ''}>
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-gray-900">{dalali.name}</p>
        <p className="text-xs text-gray-400">{dalali.phone}</p>
        <p className="text-xs text-gray-400 truncate max-w-[140px]">{dalali.email}</p>
      </td>
      <td className="px-3 py-3">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${risk.bg} ${risk.text}`}>
          {risk.label}
        </span>
      </td>
      <td className="px-3 py-3">
        <p className="text-xs text-gray-600 whitespace-nowrap">
          {new Date(dalali.registered_at).toLocaleDateString('sw-TZ')}
        </p>
        <p className="text-xs text-gray-400">Siku {dalali.days_since_registration} zilizopita</p>
      </td>
      <td className="px-3 py-3">
        {dalali.total_listings_ever > 0 ? (
          <div>
            <p className="text-sm font-medium text-green-600">{dalali.total_listings_ever} listings</p>
            <p className="text-xs text-gray-400">{dalali.active_listings} hai</p>
            {dalali.days_since_last_listing !== null && (
              <p className={`text-xs ${dalali.days_since_last_listing > 30 ? 'text-amber-500' : 'text-gray-400'}`}>
                Siku {dalali.days_since_last_listing} zilizopita
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm font-medium text-red-500">0 listings</p>
        )}
      </td>
      <td className="px-3 py-3">
        {dalali.risk_level !== 'safe' && dalali.days_before_deletion !== null ? (
          <div>
            <p className={`text-sm font-bold ${
              dalali.days_before_deletion <= 0  ? 'text-red-700'
              : dalali.days_before_deletion <= 7  ? 'text-red-600'
              : dalali.days_before_deletion <= 14 ? 'text-orange-500'
              : 'text-amber-500'
            }`}>
              {dalali.days_before_deletion <= 0 ? 'IMEPITA!' : `Siku ${dalali.days_before_deletion}`}
            </p>
            <p className="text-[10px] text-gray-400">kabla ya kufutwa</p>
          </div>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-center">
        <p className="text-sm font-medium">{dalali.listing_warnings_count ?? 0}</p>
        <p className="text-[10px] text-gray-400">maonyo</p>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5 justify-end">
          {dalali.risk_level !== 'safe' && (
            <button
              onClick={onExtend}
              className="text-xs px-2.5 py-1.5 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50"
            >
              + Muda
            </button>
          )}
          {waNum && (
            <a
              href={`https://wa.me/${waNum}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-2.5 py-1.5 border border-green-200 text-green-600 rounded-lg hover:bg-green-50"
            >
              WA
            </a>
          )}
        </div>
      </td>
    </tr>
  )
}

function ExtendDeadlineModal({
  dalali,
  onClose,
  onExtended,
}: {
  dalali: DalaliActivity
  onClose: () => void
  onExtended: () => void
}) {
  const [days, setDays]     = useState(30)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  async function handleExtend() {
    setSaving(true)
    setErr('')
    const res = await fetch(`/api/v1/admin/dalali/${dalali.id}/extend`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ days, reason }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setErr(d.error ?? 'Imeshindwa')
      setSaving(false)
      return
    }
    onExtended()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="font-semibold text-gray-900 mb-0.5">Panua Muda — {dalali.name}</h2>
        <p className="text-xs text-gray-500 mb-4">Siku za ziada kabla ya akaunti kufutwa</p>

        {err && <p className="text-xs text-red-600 mb-3">{err}</p>}

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Siku za Ziada</label>
            <div className="flex gap-2">
              {[7, 14, 30, 60].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={`flex-1 py-2 text-sm rounded-xl border transition-all ${
                    days === d ? 'bg-primary-500 text-white border-primary-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  +{d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Sababu (optional)</label>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
              placeholder="mfano: Ana uhakika wa kuweka listing"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm text-gray-700">
            Ghairi
          </button>
          <button
            onClick={handleExtend}
            disabled={saving}
            className="btn-primary flex-1 py-2.5"
          >
            {saving ? 'Inapanua...' : `Panua Siku ${days}`}
          </button>
        </div>
      </div>
    </div>
  )
}
