'use client'
import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import ResendEmailButton from '@/components/auth/ResendEmailButton'
import { useLanguage } from '@/lib/i18n/context'

function LoginForm() {
  const { t } = useLanguage()
  const supabase = createClient()
  const searchParams = useSearchParams()
  const redirectTo    = searchParams.get('redirect') || ''
  const isSuspended   = searchParams.get('suspended') === '1'
  const callbackError = searchParams.get('error')

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  // Email login
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPass, setShowPass]   = useState(false)

  // Unverified email
  const [showUnverified, setShowUnverified]   = useState(false)
  const [unverifiedEmail, setUnverifiedEmail] = useState('')

  // Forgot password
  const [forgotMode, setForgotMode]   = useState(false)
  const [resetEmail, setResetEmail]   = useState('')
  const [resetSent, setResetSent]     = useState(false)

  // ── Role-based redirect ───────────────────────────────
  async function redirectByRole(userId: string, userMeta?: Record<string, unknown>) {
    // Fast path: portal users store their type in auth user_metadata (no DB query needed).
    const portalType = (userMeta?.portal_type ?? userMeta?.role) as string | undefined
    if (portalType === 'org_owner') {
      window.location.href = (redirectTo && !redirectTo.startsWith('/admin')) ? redirectTo : '/property/dashboard'
      return
    }
    if (portalType === 'tenant') {
      window.location.href = redirectTo || '/tenant'
      return
    }

    // Try full query first; fall back to minimal columns if any column is missing
    // (e.g. staff_active / must_change_password not yet added to live DB).
    let profileData: {
      role?: string | null
      is_active?: boolean | null
      staff_active?: boolean | null
      must_change_password?: boolean | null
    } | null = null

    const { data: full, error: fullErr } = await supabase
      .from('users')
      .select('role, is_active, staff_active, must_change_password')
      .eq('id', userId)
      .single()

    if (!fullErr && full) {
      profileData = full
    } else {
      // Column missing or row absent — try minimal query
      const { data: minimal } = await supabase
        .from('users')
        .select('role, is_active')
        .eq('id', userId)
        .single()
      profileData = minimal
    }

    if (profileData?.is_active === false) {
      await supabase.auth.signOut()
      setError(t('auth_suspended_support'))
      setLoading(false)
      return
    }

    // Staff deactivated by admin
    if (profileData?.role === 'staff' && profileData?.staff_active === false) {
      await supabase.auth.signOut()
      setError(t('auth_staff_deactivated'))
      setLoading(false)
      return
    }

    // Staff forced to change password on first login
    if (profileData?.role === 'staff' && profileData?.must_change_password) {
      window.location.href = '/account/change-password'
      return
    }

    // Don't send a regular user to an /admin path just because the URL had
    // ?redirect=/admin — middleware would immediately bounce them, causing a
    // confusing loop. Admin/staff are allowed to follow admin redirects.
    const isAdminRedirect = redirectTo.startsWith('/admin')
    const canFollowRedirect =
      !isAdminRedirect ||
      profileData?.role === 'admin' ||
      profileData?.role === 'staff'

    const dest = (redirectTo && canFollowRedirect)
      ? redirectTo
      : profileData?.role === 'admin'  ? '/admin'
      : profileData?.role === 'staff'  ? '/admin/staff-dashboard'
      : profileData?.role === 'dalali' ? '/dashboard'
      : profileData?.role === 'fundi'  ? '/fundi/dashboard'
      : '/'

    window.location.href = dest
  }

  // ── Email + Password ──────────────────────────────────
  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setShowUnverified(false)
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        // Catch BOTH old GoTrue message ("Email not confirmed") and new GoTrue error
        // code ("email_not_confirmed") — Supabase changed the message to
        // "Invalid login credentials" in 2024 to prevent email enumeration.
        const isUnconfirmed =
          error.message.toLowerCase().includes('email not confirmed') ||
          (error as unknown as { code?: string }).code === 'email_not_confirmed'

        if (isUnconfirmed) {
          setUnverifiedEmail(email)
          setShowUnverified(true)
          setLoading(false)
          return
        }

        // If we got "invalid login credentials" it MIGHT still be an unconfirmed
        // email — check server-side to give the user a better hint.
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          try {
            const res = await fetch('/api/v1/auth/check-email-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email }),
            })
            if (res.ok) {
              const d = await res.json()
              if (d.exists && !d.confirmed) {
                setUnverifiedEmail(email)
                setShowUnverified(true)
                setLoading(false)
                return
              }
            }
          } catch { /* fall through to generic error */ }
        }

        throw error
      }
      await redirectByRole(data.user.id, data.user.user_metadata ?? {})
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      const kiswahili =
        msg.includes('invalid login credentials') || msg.includes('invalid email or password') ? t('auth_err_invalid_creds') :
        msg.includes('too many requests')         ? t('auth_err_too_many') :
        msg.includes('user not found')            ? t('auth_err_user_not_found') :
        msg.includes('network')                   ? t('auth_err_network') :
        t('auth_err_login_generic')
      setError(kiswahili)
      setLoading(false)
    }
  }

  // ── Google OAuth ──────────────────────────────────────
  async function handleGoogleLogin() {
    setError('')
    setLoading(true)
    try {
      const callbackUrl = new URL('/auth/callback', window.location.origin)
      if (redirectTo) callbackUrl.searchParams.set('redirect', redirectTo)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl.toString(),
          queryParams: { access_type: 'offline' },
        },
      })
      if (error) throw error
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth_err_google'))
      setLoading(false)
    }
  }

  // ── Forgot password — uses server route → Resend (not Supabase SMTP) ────────
  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/v1/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail,
          redirectTo: `${window.location.origin}/auth/callback?redirect=/account/change-password`,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || t('auth_err_send_email'))
      }
      setResetSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth_err_send_email'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <div className="relative overflow-hidden px-4 pt-12 pb-10 flex flex-col justify-center items-center"
        style={{ background: 'linear-gradient(160deg, #27AE72 0%, #1D9E75 55%, #117652 100%)' }}>
        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-6 right-12 w-10 h-10 rounded-full bg-white/8 pointer-events-none" />
        <div className="relative h-16 sm:h-20 w-44 sm:w-52">
          <Image
            src="/transparent_logo_nyumbafasta.png"
            alt="NyumbaFasta"
            fill
            priority
            className="object-contain"
            sizes="224px"
          />
        </div>
        <p className="text-white/75 text-xs mt-2 font-medium tracking-wide">{t('auth_tagline')}</p>
      </div>

      <div className="flex-1 px-4 -mt-5 pb-8">
        <div className="bg-white rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)' }}>

          {/* Suspension banner */}
          {isSuspended && (
            <div className="bg-red-50 border-b border-red-100 px-4 py-3 flex items-start gap-2">
              <i className="ti ti-ban text-lg flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-red-700">{t('auth_suspended')}</p>
                <p className="text-xs text-red-500 mt-0.5">
                  {t('auth_suspended_contact')}
                </p>
              </div>
            </div>
          )}

          {/* Callback error banner (e.g. failed OAuth, expired link) */}
          {callbackError && !isSuspended && (
            <div className="bg-amber-50 border-b border-amber-100 px-4 py-3 flex items-start gap-2">
              <i className="ti ti-alert-triangle text-lg text-amber-500 flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-amber-700">{t('auth_link_failed_title')}</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {t('auth_link_failed_body')}
                </p>
              </div>
            </div>
          )}

          <div className="p-5">

            {/* Error */}
            {error && (
              <div role="alert" className="mb-4 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {/* Unverified email notice */}
            {showUnverified && (
              <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="font-semibold text-yellow-800 text-sm mb-1">
                  <i className="ti ti-mail" aria-hidden="true" /> {t('auth_unverified_title')}
                </p>
                <p className="text-yellow-600 text-xs mb-3">
                  {t('auth_unverified_body').replace('{email}', unverifiedEmail)}
                </p>
                <ResendEmailButton email={unverifiedEmail} />
              </div>
            )}

            {/* ── FORGOT PASSWORD MODE ── */}
            {forgotMode ? (
              resetSent ? (
                <div className="text-center py-4">
                  <div className="text-5xl mb-4 flex justify-center"><i className="ti ti-mail text-primary-500" aria-hidden="true" /></div>
                  <h3 className="text-base font-bold text-gray-900 mb-2">{t('auth_reset_sent_title')}</h3>
                  <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                    {t('auth_reset_link_sent_body')}
                  </p>
                  <button
                    onClick={() => { setForgotMode(false); setResetSent(false); setResetEmail('') }}
                    className="w-full bg-primary-500 text-white py-3.5 rounded-xl text-sm font-semibold"
                  >
                    {t('auth_back_to_login')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="text-center mb-2">
                    <div className="text-3xl mb-2 flex justify-center"><i className="ti ti-key text-gray-400" aria-hidden="true" /></div>
                    <h3 className="text-base font-bold text-gray-900">{t('auth_reset_password')}</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      {t('auth_reset_link_hint')}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">{t('auth_email_placeholder_staff')}</label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      enterKeyHint="go"
                      placeholder="jina@gmail.com"
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base
                                 focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary-500 text-white py-3.5 min-h-[48px] rounded-xl text-sm
                               font-semibold disabled:opacity-50 hover:bg-primary-600 transition-colors"
                  >
                    {loading ? t('auth_sending') : t('auth_send_link')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setForgotMode(false); setError('') }}
                    className="w-full text-sm text-gray-400 py-3 min-h-[44px]"
                  >
                    {t('auth_back')}
                  </button>
                </form>
              )
            ) : (
              /* ── NORMAL LOGIN MODE ── */
              <>
                <form onSubmit={handleEmailLogin} className="space-y-4">

                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block flex items-center gap-1"><i className="ti ti-mail" aria-hidden="true" />{t('auth_email')}</label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="jina@gmail.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base
                                 focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block flex items-center gap-1"><i className="ti ti-lock" aria-hidden="true" />{t('auth_password')}</label>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-base
                                   focus:outline-none focus:ring-2 focus:ring-primary-300"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(p => !p)}
                        aria-label={showPass ? t('auth_hide_pass') : t('auth_show_pass')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        {showPass ? <i className="ti ti-eye-off" aria-hidden="true" /> : <i className="ti ti-eye" aria-hidden="true" />}
                      </button>
                    </div>
                  </div>

                  {/* Forgot password link */}
                  <div className="text-right -mt-1">
                    <button
                      type="button"
                      onClick={() => { setForgotMode(true); setResetEmail(email); setError('') }}
                      className="text-xs text-primary-500 font-medium min-h-[44px] px-2 inline-flex items-center active:opacity-70"
                    >
                      {t('auth_forgot_password')}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full text-white py-3.5 min-h-[48px] rounded-xl text-sm
                               font-semibold disabled:opacity-50 transition-all active:scale-[0.98]"
                    style={{
                      background: 'linear-gradient(135deg, #27AE72 0%, #1D9E75 55%, #178A63 100%)',
                      boxShadow: loading ? 'none' : '0 4px 14px rgba(29,158,117,0.40), 0 1px 3px rgba(29,158,117,0.20)',
                    }}
                  >
                    {loading ? t('auth_signing_in') : t('auth_login_button')}
                  </button>
                </form>

                {/* Google sign-in hidden — email only for now */}

                {/* Hint */}
                <p className="text-center text-xs text-gray-400 mt-4">
                  <i className="ti ti-bulb" aria-hidden="true" /> {t('auth_login_hint')}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Register link */}
        {!forgotMode && (
          <div className="mt-5 pb-8 flex flex-col items-center gap-3">
            <p className="text-center text-sm text-gray-500">
              {t('auth_no_account')}{' '}
              <Link href="/register" className="text-primary-600 font-medium">
                {t('auth_register_button')}
              </Link>
            </p>

            {/* Property management portal — org owners, tenants, fundi */}
            <Link
              href="/portal"
              className="flex items-center gap-1.5 text-xs hover:opacity-80 transition-opacity py-2 px-4 rounded-full border border-violet-200 font-medium text-violet-700 bg-violet-50"
            >
              <i className="ti ti-building-estate text-xs" aria-hidden="true" />
              {t('auth_portal_link')}
            </Link>

            {/* Staff / Admin portal — subtle, not meant for regular users */}
            <Link
              href="/staff-login"
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors py-2 px-3 rounded-full border border-gray-200 hover:border-gray-300"
            >
              <i className="ti ti-shield-lock text-xs" aria-hidden="true" />
              {t('auth_staff_managers')}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
