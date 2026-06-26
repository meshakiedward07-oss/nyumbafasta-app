'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type { DalaliDetail } from '@/app/(admin)/admin/users/[id]/page'
import { PLAN_BADGES, getPlan } from '@/lib/config/subscription-plans'

const WA_PATH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z'

function waNumber(raw: string) {
  return raw.replace(/[^0-9]/g, '')
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Leo'
  if (days < 30) return `Siku ${days} zilizopita`
  const months = Math.floor(days / 30)
  return `Miezi ${months} iliyopita`
}

export default function DalaliDetailClient({ dalali }: { dalali: DalaliDetail }) {
  const router = useRouter()
  const [actionLoading, setActionLoading] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteNotify, setDeleteNotify] = useState(true)
  const [isActive, setIsActive] = useState(dalali.is_active !== false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const activeSub = dalali.subscriptions?.find(s => s.status === 'active')
  const planBadge = PLAN_BADGES[activeSub?.plan ?? 'free'] ?? PLAN_BADGES['free']
  const planData  = getPlan(activeSub?.plan)
  const profile   = dalali.dalali_profiles
  const waNum     = profile?.whatsapp_number ? waNumber(profile.whatsapp_number) : null
  const waMessage = encodeURIComponent(`Habari ${dalali.full_name}, ninawasiliana nawe kutoka NyumbaFasta Admin.`)

  async function handleToggleActive() {
    setActionLoading(true)
    setError('')
    try {
      const action = isActive ? 'suspend' : 'activate'
      const res = await fetch(`/api/v1/admin/users/${dalali.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Imeshindwa')
      setIsActive(!isActive)
      setSuccess(action === 'suspend' ? 'Dalali amesimamishwa.' : 'Dalali ameamilishwa.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Hitilafu imetokea')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleVerify() {
    setVerifyLoading(true)
    setError('')
    try {
      const res = await fetch('/api/v1/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dalali_user_id: dalali.id, action: 'approve' }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Imeshindwa')
      setSuccess('Dalali amethibitishwa!')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Hitilafu imetokea')
    } finally {
      setVerifyLoading(false)
    }
  }

  async function handleDelete() {
    setActionLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/v1/admin/users/${dalali.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason || 'Admin deletion', notify: deleteNotify }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Imeshindwa')
      router.push('/admin')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Hitilafu imetokea')
      setShowDeleteModal(false)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* Desktop header */}
      <div className="hidden lg:flex items-center gap-3 px-6 py-5 border-b border-gray-100 bg-white">
        <button onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-gray-100 text-gray-600 text-lg transition-colors">
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{dalali.full_name}</h1>
          <p className="text-xs text-gray-400 mt-0.5">Maelezo ya Dalali · Admin Panel</p>
        </div>
      </div>

      {/* Mobile header */}
      <div className="lg:hidden bg-primary-800 px-4 pt-10 pb-5 flex items-center gap-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white text-lg">
          ←
        </button>
        <div>
          <h1 className="text-white font-bold text-base">Maelezo ya Dalali</h1>
          <p className="text-green-200 text-xs">Admin Panel</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Feedback */}
        {error   && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">{success}</div>}

        {/* ── Profile card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-primary-100 flex-shrink-0">
              {dalali.avatar_url ? (
                <Image src={dalali.avatar_url} alt="" width={64} height={64} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-primary-600">
                  {dalali.full_name?.[0] ?? '?'}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg text-gray-900 leading-tight">{dalali.full_name}</p>
              <p className="text-gray-500 text-xs truncate">{dalali.email ?? '—'}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {isActive ? '● Active' : '● Suspended'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                  style={{ backgroundColor: planBadge.color }}>
                  {planData.emoji} {planBadge.label}
                </span>
                {profile?.is_premium_verified && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    ✓ Imethibitishwa
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── WhatsApp — button kubwa ya kijani ── */}
          {waNum ? (
            <a
              href={`https://wa.me/${waNum}?text=${waMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-[#25D366] text-white p-3.5 rounded-xl mb-3 active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                    <path d={WA_PATH} />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-sm">💬 Piga WhatsApp</p>
                  <p className="text-green-100 text-xs">{profile!.whatsapp_number}</p>
                </div>
              </div>
              <span className="text-white text-xl font-light">→</span>
            </a>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-3 mb-3 text-center">
              <p className="text-gray-400 text-sm">⚠️ WhatsApp haijawekwa na dalali huyu</p>
            </div>
          )}

          {/* Email */}
          {dalali.email && (
            <a
              href={`mailto:${dalali.email}`}
              className="flex items-center justify-between bg-blue-50 border border-blue-200 p-3 rounded-xl active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-2">
                <span className="text-blue-500 text-lg">✉️</span>
                <div>
                  <p className="font-medium text-sm text-blue-800">Tuma Email</p>
                  <p className="text-blue-500 text-xs truncate max-w-[200px]">{dalali.email}</p>
                </div>
              </div>
              <span className="text-blue-400">→</span>
            </a>
          )}
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Listings', value: dalali.listings_count, color: 'text-primary-600' },
            { label: 'Leads',    value: dalali.leads_count,    color: 'text-blue-600'    },
            { label: 'Rating',   value: profile?.rating_avg?.toFixed(1) ?? '—', color: 'text-amber-500' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-3 border border-gray-100 text-center shadow-sm">
              <p className={`font-bold text-xl ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Profile details ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Maelezo</p>
          {[
            { label: 'Simu', value: dalali.phone ?? '—' },
            { label: 'Verification', value: profile?.verification_status ?? 'Haijafanywa' },
            { label: 'Rating count', value: `${profile?.rating_count ?? 0} maoni` },
            { label: 'Alijiunga', value: timeAgo(dalali.created_at) },
            { label: 'Views zote', value: dalali.total_views.toLocaleString() },
          ].map(r => (
            <div key={r.label} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
              <span className="text-xs text-gray-500">{r.label}</span>
              <span className="text-xs font-medium text-gray-800">{r.value}</span>
            </div>
          ))}
          {profile?.bio && (
            <div className="pt-2">
              <p className="text-xs text-gray-400 mb-1">Bio</p>
              <p className="text-xs text-gray-700 leading-relaxed">{profile.bio}</p>
            </div>
          )}
        </div>

        {/* ── Subscription history ── */}
        {dalali.subscriptions?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Historia ya Subscription</p>
            </div>
            <div className="divide-y divide-gray-50">
              {dalali.subscriptions.slice(0, 5).map((sub, i) => {
                const pd = getPlan(sub.plan)
                return (
                  <div key={i} className="px-4 py-3 flex items-center gap-3">
                    <span className="text-lg">{pd.emoji}</span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-800">{pd.name}</p>
                      <p className="text-xs text-gray-400">
                        {sub.expires_at ? `Inaisha: ${new Date(sub.expires_at).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Daima bure'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        sub.status === 'active' ? 'bg-primary-50 text-primary-600' :
                        sub.status === 'grace_period' ? 'bg-yellow-50 text-yellow-700' :
                        'bg-gray-100 text-gray-400'
                      }`}>{sub.status}</span>
                      {sub.amount_paid != null && sub.amount_paid > 0 && (
                        <p className="text-[10px] text-gray-400 mt-0.5">Tsh {sub.amount_paid.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Admin actions ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">⚙️ Admin Actions</p>
          <div className="space-y-2">

            {/* Suspend / Activate */}
            <button
              onClick={handleToggleActive}
              disabled={actionLoading}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-40 ${
                isActive
                  ? 'bg-orange-50 text-orange-700 border border-orange-200'
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}
            >
              {actionLoading ? '...' : isActive ? '⏸️ Simamisha Dalali' : '▶️ Amsha Dalali'}
            </button>

            {/* Verify (if not yet verified) */}
            {!profile?.is_premium_verified && (
              <button
                onClick={handleVerify}
                disabled={verifyLoading}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-primary-50 text-primary-700 border border-primary-200 active:scale-[0.98] transition-all disabled:opacity-40"
              >
                {verifyLoading ? '...' : '✅ Thibitisha (NIDA Verified)'}
              </button>
            )}

            {/* View all listings — public profile opens in new tab */}
            <Link
              href={`/dalali/${dalali.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full py-3 rounded-xl text-sm font-semibold bg-gray-50 text-gray-700 border border-gray-200"
            >
              🏠 Ona Listings ({dalali.listings_count}) →
            </Link>

            {/* Delete */}
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={actionLoading}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-red-50 text-red-700 border border-red-200 active:scale-[0.98] transition-all disabled:opacity-40"
            >
              🗑️ Futa Akaunti
            </button>
          </div>
        </div>

      </div>

      {/* ── Delete confirmation modal ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white w-full rounded-t-3xl px-6 pt-4 pb-10 shadow-xl max-h-[85vh] overflow-y-auto"
               onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <div className="text-3xl text-center mb-2">🚫</div>
            <h3 className="font-bold text-center text-gray-900 mb-4">Futa Akaunti</h3>
            <p className="text-xs text-gray-500 text-center mb-4">{dalali.full_name} — {dalali.email}</p>

            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Sababu:</p>
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

            <button onClick={() => setDeleteNotify(n => !n)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 mb-5 transition-all ${
                deleteNotify ? 'border-primary-300 bg-primary-50' : 'border-gray-100'
              }`}>
              <span className="text-sm text-gray-700">Tuma arifa kwa mtumiaji?</span>
              <div className={`w-10 h-5 rounded-full transition-colors ${deleteNotify ? 'bg-primary-500' : 'bg-gray-200'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${deleteNotify ? 'translate-x-5' : ''}`} />
              </div>
            </button>

            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeleteReason('') }}
                className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-700 font-semibold text-sm">
                Ghairi
              </button>
              <button onClick={handleDelete}
                disabled={!deleteReason || actionLoading}
                className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-bold text-sm disabled:opacity-40">
                {actionLoading ? '...' : '🗑️ Futa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
