'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/context'

export default function FundiLoginPage() {
  const { t } = useLanguage()
  const supabase = createClient()
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [showPass,   setShowPass]   = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (forgotMode) {
        const res = await fetch('/api/v1/auth/request-password-reset', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            email,
            redirectTo: `${window.location.origin}/auth/callback?redirect=/account/change-password`,
          }),
        })
        if (!res.ok) setError(t('auth_forgot_send_failed'))
        else setForgotSent(true)
        return
      }

      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
      if (authErr) { setError(t('auth_invalid_credentials')); return }

      const { data: profile } = await supabase
        .from('users')
        .select('role, account_status, is_active')
        .eq('id', data.user.id)
        .single()

      if (profile?.role !== 'fundi') {
        await supabase.auth.signOut()
        setError(t('auth_fundi_wrong_portal'))
        return
      }
      if (profile?.account_status === 'banned') {
        await supabase.auth.signOut()
        setError(t('auth_fundi_banned'))
        return
      }
      if (profile?.account_status === 'suspended' || profile?.is_active === false) {
        await supabase.auth.signOut()
        setError(t('auth_fundi_suspended'))
        return
      }
      window.location.href = '/fundi/dashboard'
    } catch {
      setError(t('auth_network_error'))
    } finally {
      setLoading(false)
    }
  }

  if (forgotSent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm p-8 text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-mail-check text-green-500 text-3xl" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">{t('auth_check_email')}</h2>
          <p className="text-sm text-gray-500 mb-6">
            {t('auth_magic_link_sent')}
          </p>
          <button
            onClick={() => { setForgotMode(false); setForgotSent(false) }}
            className="text-primary-600 font-medium text-sm hover:underline"
          >
            ← {t('auth_back_to_login')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-tools text-white text-3xl" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {forgotMode ? t('auth_forgot_password_q') : t('auth_fundi_login_title')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {forgotMode
              ? t('auth_reset_link_hint')
              : t('auth_fundi_portal')}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">{t('auth_email')}</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="juma@example.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>

            {!forgotMode && (
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{t('auth_password')}</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                    placeholder="••••••••"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                  <button
                    type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400"
                    aria-label={showPass ? t('auth_hide_pass') : t('auth_show_pass')}
                  >
                    <i className={`ti ti-${showPass ? 'eye-off' : 'eye'} text-base`} aria-hidden="true" />
                  </button>
                </div>
                <div className="text-right mt-1">
                  <button
                    type="button"
                    onClick={() => { setForgotMode(true); setError('') }}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    {t('auth_forgot_password')}
                  </button>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 transition">
              {loading
                ? (forgotMode ? t('common_sending') : t('auth_signing_in'))
                : (forgotMode ? t('auth_send_link') : t('auth_login_button'))}
            </button>

            {forgotMode && (
              <button
                type="button"
                onClick={() => { setForgotMode(false); setError('') }}
                className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
              >
                ← {t('auth_back_to_login')}
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          {t('auth_fundi_no_account')}{' '}
          <Link href="/fundi/register" className="text-primary-600 font-semibold hover:underline">
            {t('auth_fundi_register_link')}
          </Link>
        </p>
        <p className="text-center text-xs text-gray-400 mt-2">
          <Link href="/login" className="hover:underline">{t('auth_login_regular')}</Link>
        </p>
      </div>
    </div>
  )
}
