'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/shared/BottomNav'

type Props = {
  fullName: string
  email: string | null
  phone: string | null
  role: string
  joinedAt: string
  savedCount: number
  unlocksCount?: number
  totalSpent?: number
}

export default function AccountClient({ fullName, email, phone, role, joinedAt, savedCount, unlocksCount = 0, totalSpent = 0 }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(fullName)
  const [saving, setSaving] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [joinDate, setJoinDate] = useState('')

  useEffect(() => {
    setJoinDate(new Date(joinedAt).toLocaleDateString('sw-TZ', {
      day: 'numeric', month: 'long', year: 'numeric',
    }))
  }, [joinedAt])

  const isAdmin  = role === 'admin'
  const isDalali = role === 'dalali'

  async function handleSaveName() {
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/v1/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setSuccess('Jina limehifadhiwa!')
      setEditing(false)
      setTimeout(() => setSuccess(''), 5000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Imeshindwa kuhifadhi')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">

      {/* ── Header ── */}
      <div className="bg-primary-500 px-4 pt-10 pb-8">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 text-white text-lg">
            ←
          </button>
          <h1 className="text-white text-lg font-bold">Akaunti Yangu</h1>
        </div>

        {/* Avatar + name + role */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white text-2xl font-bold shrink-0">
            {name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base truncate">{name}</p>
            {email && <p className="text-white/70 text-xs truncate">{email}</p>}
            <span className={`inline-block mt-1 text-xs px-2.5 py-0.5 rounded-full font-semibold ${
              isAdmin  ? 'bg-red-400 text-white' :
              isDalali ? 'bg-amber-400 text-white' :
                         'bg-white/20 text-white'
            }`}>
              {isAdmin ? '🛡️ Admin' : isDalali ? '🏢 Dalali' : '🔍 Mteja'}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ── Flash messages ── */}
        {success && (
          <div className="bg-primary-50 border border-primary-100 text-primary-700 text-sm px-4 py-3 rounded-xl">
            ✅ {success}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* ── NAVIGATION cards — admin/dalali only ── */}
        {isAdmin && (
          <Link href="/admin">
            <div className="flex items-center justify-between p-4 bg-red-50 border border-red-100 rounded-xl active:scale-[0.97] transition-transform">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-lg">🛡️</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Admin Panel</p>
                  <p className="text-xs text-gray-500">Simamia platform yote</p>
                </div>
              </div>
              <span className="text-gray-400 text-lg">→</span>
            </div>
          </Link>
        )}

        {(isAdmin || isDalali) && (
          <Link href="/dashboard">
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-100 rounded-xl active:scale-[0.97] transition-transform">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-lg">📊</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Dalali Dashboard</p>
                  <p className="text-xs text-gray-500">Simamia listings zako</p>
                </div>
              </div>
              <span className="text-gray-400 text-lg">→</span>
            </div>
          </Link>
        )}

        {/* ── Taarifa zangu (profile card) ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-50 flex justify-between items-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Taarifa Zangu</p>
            {!editing ? (
              <button onClick={() => setEditing(true)}
                className="text-xs text-primary-600 font-semibold">
                ✏️ Hariri
              </button>
            ) : (
              <div className="flex gap-3">
                <button onClick={() => { setEditing(false); setName(fullName) }}
                  className="text-xs text-gray-400 font-medium">Ghairi</button>
                <button onClick={handleSaveName} disabled={saving}
                  className="text-xs text-primary-600 font-semibold disabled:opacity-50">
                  {saving ? 'Inahifadhi...' : 'Hifadhi'}
                </button>
              </div>
            )}
          </div>

          <div className="divide-y divide-gray-50">
            <div className="px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">Jina kamili</p>
              {editing ? (
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              ) : (
                <p className="text-sm font-medium text-gray-800">{name}</p>
              )}
            </div>
            {email && (
              <div className="px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">Barua pepe</p>
                <p className="text-sm text-gray-800">{email}</p>
              </div>
            )}
            {phone && (
              <div className="px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">Nambari ya simu</p>
                <p className="text-sm text-gray-800">{phone}</p>
              </div>
            )}
            <div className="px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">Alijiunga</p>
              <p className="text-sm text-gray-800">{joinDate}</p>
            </div>
          </div>
        </div>

        {/* ── Stats quick cards ── */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/saved"
            className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3 active:scale-[0.97] transition-transform">
            <span className="text-2xl">❤️</span>
            <div>
              <p className="text-lg font-bold text-gray-900">{savedCount}</p>
              <p className="text-xs text-gray-400">Zilizohifadhiwa</p>
            </div>
          </Link>
          {!isDalali && !isAdmin ? (
            <Link href="/account/contacts"
              className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3 active:scale-[0.97] transition-transform">
              <span className="text-2xl">💬</span>
              <div>
                <p className="text-lg font-bold text-gray-900">{unlocksCount}</p>
                <p className="text-xs text-gray-400">Mawasiliano</p>
              </div>
            </Link>
          ) : isDalali ? (
            <Link href="/dashboard/profile"
              className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3 active:scale-[0.97] transition-transform">
              <span className="text-2xl">⚙️</span>
              <div>
                <p className="text-sm font-bold text-gray-900">Wasifu</p>
                <p className="text-xs text-gray-400">Dalali profile</p>
              </div>
            </Link>
          ) : null}
        </div>

        {/* ── Contact history link (client only) ── */}
        {!isDalali && !isAdmin && unlocksCount > 0 && (
          <Link href="/account/contacts"
            className="flex items-center justify-between p-4 bg-green-50 border border-green-100 rounded-2xl active:scale-[0.97] transition-transform">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-lg">📋</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Historia ya Mawasiliano</p>
                <p className="text-xs text-gray-500">
                  {unlocksCount} dalali · Jumla Tsh {totalSpent.toLocaleString()} uliotumia
                </p>
              </div>
            </div>
            <span className="text-green-500 font-bold text-lg">→</span>
          </Link>
        )}

        {/* ── AKAUNTI section ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-50">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Akaunti</p>
          </div>
          <Link href="/notifications"
            className="flex items-center gap-3 px-4 py-4 border-b border-gray-50 hover:bg-gray-50 active:scale-[0.98] transition-all">
            <span className="text-xl">🔔</span>
            <span className="text-sm text-gray-700 flex-1">Mipangilio ya Arifa</span>
            <span className="text-gray-300 text-lg">›</span>
          </Link>
          <Link href="/saved"
            className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 active:scale-[0.98] transition-all">
            <span className="text-xl">❤️</span>
            <span className="text-sm text-gray-700 flex-1">Listings Zilizohifadhiwa</span>
            <span className="text-gray-300 text-lg">›</span>
          </Link>
        </div>

        {/* ── MSAADA section ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-50">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Msaada</p>
          </div>
          <Link href="/terms"
            className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 active:scale-[0.98] transition-all">
            <span className="text-xl">📋</span>
            <span className="text-sm text-gray-700 flex-1">Masharti ya Matumizi</span>
            <span className="text-gray-300 text-lg">›</span>
          </Link>
        </div>

        {/* ── Sign Out button ── */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl
                     bg-red-50 border border-red-100 text-red-500 font-semibold
                     hover:bg-red-100 active:scale-[0.98] transition-all text-sm">
          🚪 Toka — Sign Out
        </button>

        <div className="h-2" />
      </div>

      {/* ── Logout confirmation bottom sheet ── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowLogoutConfirm(false)}>
          <div
            className="bg-white w-full rounded-t-3xl px-6 pt-6 pb-10 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />
            <h3 className="text-base font-bold text-gray-900 mb-2">Una uhakika unataka kutoka?</h3>
            <p className="text-sm text-gray-500 mb-7">
              Utahitaji kuingia tena kuendelea kutumia akaunti yako.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-700 font-semibold text-sm active:scale-[0.97] transition-transform">
                Ghairi
              </button>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-bold text-sm
                           disabled:opacity-60 active:scale-[0.97] transition-transform">
                {loggingOut ? 'Inatoka...' : '🚪 Ndio, Toka'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav role={role} />
    </div>
  )
}
