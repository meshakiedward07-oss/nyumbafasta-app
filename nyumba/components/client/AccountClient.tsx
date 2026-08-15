'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/shared/BottomNav'
import { useLanguage } from '@/lib/i18n/context'

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
  const { t } = useLanguage()
  const supabase = createClient()

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(fullName)
  const [saving, setSaving] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [loggingOutAll, setLoggingOutAll] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showLogoutAllConfirm, setShowLogoutAllConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
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
      setSuccess(t('cl_name_saved'))
      setEditing(false)
      setTimeout(() => setSuccess(''), 5000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common_error'))
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

  async function handleLogoutAllDevices() {
    setLoggingOutAll(true)
    try {
      await supabase.auth.signOut({ scope: 'global' })
      router.push('/?signed_out=1')
      router.refresh()
    } catch {
      setError(t('cl_confirm_logout_all'))
      setLoggingOutAll(false)
      setShowLogoutAllConfirm(false)
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText.toLowerCase() !== 'futa akaunti') return
    setDeleting(true)
    setError('')
    try {
      const res = await fetch('/api/v1/account/delete', { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(d.error ?? t('common_error'))
      }
      await supabase.auth.signOut()
      router.replace('/account-deleted')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common_error'))
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* ── Header ── */}
      <div className="relative gradient-primary overflow-hidden px-4 pb-8" style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top))' }}>
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/[0.06] pointer-events-none" />
        <div className="absolute top-4 right-16 w-20 h-20 rounded-full bg-white/[0.05] pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-black/[0.05] pointer-events-none" />

        <div className="relative flex items-center gap-3 mb-6">
          <button onClick={() => router.back()}
            aria-label={t('common_back')}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white/20 text-white">
            <i className="ti ti-arrow-left text-lg" aria-hidden="true" />
          </button>
          <h1 className="text-white text-lg font-bold">{t('cl_my_account')}</h1>
        </div>

        {/* Avatar + name + role */}
        <div className="relative flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-white text-2xl font-bold shrink-0">
            {name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base truncate">{name}</p>
            {email && <p className="text-white/70 text-xs truncate mt-0.5">{email}</p>}
            <span className={`inline-flex items-center gap-1 mt-1.5 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-white/20 backdrop-blur-sm ${
              isAdmin  ? 'bg-red-400/80 text-white' :
              isDalali ? 'bg-amber-400/80 text-white' :
                         'bg-white/20 text-white'
            }`}>
              {isAdmin ? <><i className="ti ti-shield text-[11px]" aria-hidden="true" /> Admin</> : isDalali ? <><i className="ti ti-building text-[11px]" aria-hidden="true" /> Dalali</> : <><i className="ti ti-search text-[11px]" aria-hidden="true" /> Mteja</>}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ── Flash messages ── */}
        {success && (
          <div className="bg-primary-50 border border-primary-100 text-primary-700 text-sm px-4 py-3 rounded-xl">
            <i className="ti ti-circle-check" aria-hidden="true" /> {success}
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
                  <i className="ti ti-shield text-lg text-red-500" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Admin Panel</p>
                  <p className="text-xs text-gray-500">{t('cl_manage_platform')}</p>
                </div>
              </div>
              <i className="ti ti-chevron-right text-gray-300 text-xl" aria-hidden="true" />
            </div>
          </Link>
        )}

        {(isAdmin || isDalali) && (
          <Link href="/dashboard">
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-100 rounded-xl active:scale-[0.97] transition-transform">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <i className="ti ti-chart-bar text-lg text-green-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Dalali Dashboard</p>
                  <p className="text-xs text-gray-500">{t('cl_manage_listings')}</p>
                </div>
              </div>
              <i className="ti ti-chevron-right text-gray-300 text-xl" aria-hidden="true" />
            </div>
          </Link>
        )}

        {/* ── Taarifa zangu (profile card) ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-50 flex justify-between items-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('cl_my_info')}</p>
            {!editing ? (
              <button onClick={() => setEditing(true)}
                className="text-xs text-primary-600 font-semibold min-h-[44px] px-2">
                <i className="ti ti-pencil" aria-hidden="true" /> {t('common_edit')}
              </button>
            ) : (
              <div className="flex gap-1">
                <button onClick={() => { setEditing(false); setName(fullName) }}
                  className="text-xs text-gray-400 font-medium min-h-[44px] px-3">{t('common_cancel')}</button>
                <button onClick={handleSaveName} disabled={saving}
                  className="text-xs text-primary-600 font-semibold min-h-[44px] px-3 disabled:opacity-50">
                  {saving ? t('cl_saving') : t('common_save')}
                </button>
              </div>
            )}
          </div>

          <div className="divide-y divide-gray-50">
            <div className="px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">{t('cl_full_name')}</p>
              {editing ? (
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 min-h-[44px] text-sm
                             focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              ) : (
                <p className="text-sm font-medium text-gray-800">{name}</p>
              )}
            </div>
            {email && (
              <div className="px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">{t('cl_email')}</p>
                <p className="text-sm text-gray-800">{email}</p>
              </div>
            )}
            {phone && (
              <div className="px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">{t('cl_phone')}</p>
                <p className="text-sm text-gray-800">{phone}</p>
              </div>
            )}
            <div className="px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">{t('cl_joined')}</p>
              <p className="text-sm text-gray-800">{joinDate}</p>
            </div>
          </div>
        </div>

        {/* ── Stats quick cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link href="/saved"
            className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3 active:scale-[0.97] transition-transform">
            <i className="ti ti-heart text-2xl text-red-400" aria-hidden="true" />
            <div>
              <p className="text-lg font-bold text-gray-900">{savedCount}</p>
              <p className="text-xs text-gray-400">{t('nav_saved')}</p>
            </div>
          </Link>
          {!isDalali && !isAdmin ? (
            <Link href="/account/contacts"
              className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3 active:scale-[0.97] transition-transform">
              <i className="ti ti-message-circle text-2xl text-blue-400" aria-hidden="true" />
              <div>
                <p className="text-lg font-bold text-gray-900">{unlocksCount}</p>
                <p className="text-xs text-gray-400">{t('cl_contacts')}</p>
              </div>
            </Link>
          ) : isDalali ? (
            <Link href="/dashboard/profile"
              className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3 active:scale-[0.97] transition-transform">
              <i className="ti ti-settings text-2xl text-gray-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-gray-900">{t('cl_profile')}</p>
                <p className="text-xs text-gray-400">{t('cl_dalali_profile_sub')}</p>
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
                <i className="ti ti-list text-lg text-green-600" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{t('cl_contact_history')}</p>
                <p className="text-xs text-gray-500">
                  {unlocksCount} dalali · Jumla Tsh {totalSpent.toLocaleString()} {t('cl_spent')}
                </p>
              </div>
            </div>
            <i className="ti ti-chevron-right text-green-500 text-xl" aria-hidden="true" />
          </Link>
        )}

        {/* ── AKAUNTI section ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-50">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('nav_account')}</p>
          </div>
          <Link href="/notifications"
            className="flex items-center gap-3 px-4 py-4 border-b border-gray-50 hover:bg-gray-50 active:scale-[0.98] transition-all">
            <i className="ti ti-bell text-xl text-gray-400" aria-hidden="true" />
            <span className="text-sm text-gray-700 flex-1">{t('cl_notification_settings')}</span>
            <i className="ti ti-chevron-right text-gray-300 text-xl" aria-hidden="true" />
          </Link>
          <Link href="/saved"
            className="flex items-center gap-3 px-4 py-4 border-b border-gray-50 hover:bg-gray-50 active:scale-[0.98] transition-all">
            <i className="ti ti-heart text-xl text-red-400" aria-hidden="true" />
            <span className="text-sm text-gray-700 flex-1">{t('cl_saved_listings')}</span>
            <i className="ti ti-chevron-right text-gray-300 text-xl" aria-hidden="true" />
          </Link>
          {!isDalali && !isAdmin && (
            <Link href="/account/contacts"
              className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 active:scale-[0.98] transition-all">
              <i className="ti ti-message-circle text-xl text-blue-400" aria-hidden="true" />
              <span className="text-sm text-gray-700 flex-1">{t('cl_agent_contacts')}</span>
              <i className="ti ti-chevron-right text-gray-300 text-xl" aria-hidden="true" />
            </Link>
          )}
        </div>

        {/* ── MSAADA section ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-50">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('cl_footer_help')}</p>
          </div>
          <Link href="/terms"
            className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 active:scale-[0.98] transition-all">
            <i className="ti ti-file-text text-xl text-gray-400" aria-hidden="true" />
            <span className="text-sm text-gray-700 flex-1">{t('cl_terms')}</span>
            <i className="ti ti-chevron-right text-gray-300 text-xl" aria-hidden="true" />
          </Link>
        </div>

        {/* ── Security section ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-50">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('cl_security')}</p>
          </div>
          <Link href="/account/security"
            className="flex items-center gap-3 px-4 py-4 border-b border-gray-50 hover:bg-gray-50 active:scale-[0.98] transition-all">
            <i className="ti ti-shield-lock text-xl text-primary-500" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm text-gray-700">{t('cl_account_security')}</p>
              <p className="text-xs text-gray-400">{t('cl_security_sub')}</p>
            </div>
            <i className="ti ti-chevron-right text-gray-300 text-xl" aria-hidden="true" />
          </Link>
          <Link href="/account/change-password"
            className="flex items-center gap-3 px-4 py-4 border-b border-gray-50 hover:bg-gray-50 active:scale-[0.98] transition-all">
            <i className="ti ti-lock text-xl text-gray-400" aria-hidden="true" />
            <span className="text-sm text-gray-700 flex-1">{t('cl_change_password')}</span>
            <i className="ti ti-chevron-right text-gray-300 text-xl" aria-hidden="true" />
          </Link>
          <button
            onClick={() => setShowLogoutAllConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 active:scale-[0.98] transition-all text-left">
            <i className="ti ti-devices text-xl text-amber-500" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm text-gray-700">{t('cl_logout_all')}</p>
              <p className="text-xs text-gray-400">{t('cl_logout_all_sub')}</p>
            </div>
            <i className="ti ti-chevron-right text-gray-300 text-xl" aria-hidden="true" />
          </button>
        </div>

        {/* ── Sign Out button ── */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl
                     bg-red-50 border border-red-100 text-red-500 font-semibold
                     hover:bg-red-100 active:scale-[0.98] transition-all text-sm">
          <i className="ti ti-door-exit" aria-hidden="true" /> {t('cl_sign_out')}
        </button>

        {/* ── Danger zone ── */}
        {!isAdmin && (
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-red-50">
              <p className="text-xs font-bold text-red-400 uppercase tracking-wider">{t('cl_danger_zone')}</p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-red-50 active:scale-[0.98] transition-all text-left">
              <i className="ti ti-trash text-xl text-red-500" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm text-red-600 font-medium">{t('cl_delete_account')}</p>
                <p className="text-xs text-gray-400">{t('cl_irreversible')}</p>
              </div>
            </button>
          </div>
        )}

        <div className="h-2" />
      </div>

      {/* ── Logout confirmation bottom sheet ── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowLogoutConfirm(false)}>
          <div className="bg-white w-full rounded-t-3xl px-6 pt-6 pb-10 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />
            <h3 className="text-base font-bold text-gray-900 mb-2">{t('cl_confirm_logout')}</h3>
            <p className="text-sm text-gray-500 mb-7">
              {t('cl_confirm_logout_body')}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-700 font-semibold text-sm active:scale-[0.97] transition-transform">
                {t('common_cancel')}
              </button>
              <button onClick={handleLogout} disabled={loggingOut}
                className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-bold text-sm disabled:opacity-60 active:scale-[0.97] transition-transform">
                {loggingOut ? t('cl_signing_out') : <><i className="ti ti-door-exit" aria-hidden="true" /> {t('cl_yes_sign_out')}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Log out all devices confirmation ── */}
      {showLogoutAllConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowLogoutAllConfirm(false)}>
          <div className="bg-white w-full rounded-t-3xl px-6 pt-6 pb-10 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />
            <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ti ti-devices text-amber-500 text-2xl" aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-2 text-center">{t('cl_confirm_logout_all')}</h3>
            <p className="text-sm text-gray-500 mb-7 text-center">
              {t('cl_confirm_logout_all_body')}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutAllConfirm(false)}
                className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-700 font-semibold text-sm">
                {t('common_cancel')}
              </button>
              <button onClick={handleLogoutAllDevices} disabled={loggingOutAll}
                className="flex-1 py-3.5 rounded-2xl bg-amber-500 text-white font-bold text-sm disabled:opacity-60">
                {loggingOutAll ? t('cl_deleting') : t('cl_yes_sign_out_all')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete account confirmation ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}>
          <div className="bg-white w-full rounded-t-3xl px-6 pt-6 pb-10 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ti ti-trash text-red-500 text-2xl" aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-2 text-center">{t('cl_confirm_delete')}</h3>
            <p className="text-sm text-gray-500 mb-4 text-center">
              {t('cl_confirm_delete_body')} <strong>{t('cl_irreversible')}</strong>
            </p>
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 text-xs text-red-700">
              {t('cl_delete_warning')}
            </div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">
              {t('cl_delete_confirm_label')}
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="futa akaunti"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 mb-5"
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}
                className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-700 font-semibold text-sm">
                {t('common_cancel')}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText.toLowerCase() !== 'futa akaunti'}
                className="flex-1 py-3.5 rounded-2xl bg-red-600 text-white font-bold text-sm disabled:opacity-40">
                {deleting ? t('cl_deleting') : t('cl_delete_final')}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav role={role} />
    </div>
  )
}
