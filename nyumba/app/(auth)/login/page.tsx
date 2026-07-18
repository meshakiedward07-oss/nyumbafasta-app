'use client'
import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import ResendEmailButton from '@/components/auth/ResendEmailButton'

function LoginForm() {
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
  async function redirectByRole(userId: string) {
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
      setError('Akaunti yako imesimamishwa. Wasiliana na support: wa.me/255615261147')
      setLoading(false)
      return
    }

    // Staff deactivated by admin
    if (profileData?.role === 'staff' && profileData?.staff_active === false) {
      await supabase.auth.signOut()
      setError('Akaunti yako ya staff imezimwa. Wasiliana na admin wako.')
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
      await redirectByRole(data.user.id)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      const kiswahili =
        msg.includes('invalid login credentials') || msg.includes('invalid email or password') ? 'Barua pepe au nenosiri si sahihi. Tumia "Umesahau nenosiri?" kupata kiungo cha kuingia.' :
        msg.includes('too many requests')         ? 'Maombi mengi mfululizo. Subiri dakika chache.' :
        msg.includes('user not found')            ? 'Akaunti haipo. Jisajili kwanza.' :
        msg.includes('network')                   ? 'Hakuna mtandao. Angalia internet yako.' :
        'Imeshindwa kuingia. Tumia "Umesahau nenosiri?" au wasiliana na msaada.'
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
      setError(err instanceof Error ? err.message : 'Imeshindwa kuingia na Google.')
      setLoading(false)
    }
  }

  // ── Forgot password ───────────────────────────────────
  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth/callback?redirect=/account/change-password`,
      })
      if (error) throw error
      setResetSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Imeshindwa kutuma barua pepe.')
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
        <p className="text-white/75 text-xs mt-2 font-medium tracking-wide">Nyumba yako, haraka zaidi</p>
      </div>

      <div className="flex-1 px-4 -mt-5 pb-8">
        <div className="bg-white rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)' }}>

          {/* Suspension banner */}
          {isSuspended && (
            <div className="bg-red-50 border-b border-red-100 px-4 py-3 flex items-start gap-2">
              <i className="ti ti-ban text-lg flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-red-700">Akaunti Imesimamishwa</p>
                <p className="text-xs text-red-500 mt-0.5">
                  Wasiliana nasi kupitia WhatsApp ili ujue sababu.
                </p>
              </div>
            </div>
          )}

          {/* Callback error banner (e.g. failed OAuth, expired link) */}
          {callbackError && !isSuspended && (
            <div className="bg-amber-50 border-b border-amber-100 px-4 py-3 flex items-start gap-2">
              <i className="ti ti-alert-triangle text-lg text-amber-500 flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-amber-700">Kiungo Kimeshindwa</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Kiungo cha kuingia kimekwisha muda au hakikufanya kazi. Jaribu tena.
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
                  <i className="ti ti-mail" aria-hidden="true" /> Thibitisha Barua Pepe Yako Kwanza
                </p>
                <p className="text-yellow-600 text-xs mb-3">
                  Tumetuma email ya uthibitisho kwa {unverifiedEmail}. Angalia inbox yako.
                </p>
                <ResendEmailButton email={unverifiedEmail} />
              </div>
            )}

            {/* ── FORGOT PASSWORD MODE ── */}
            {forgotMode ? (
              resetSent ? (
                <div className="text-center py-4">
                  <div className="text-5xl mb-4 flex justify-center"><i className="ti ti-mail text-primary-500" aria-hidden="true" /></div>
                  <h3 className="text-base font-bold text-gray-900 mb-2">Barua pepe imetumwa!</h3>
                  <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                    Angalia inbox yako na ubonyeze kiungo cha kubadilisha nenosiri.
                    Angalia pia folda ya Spam.
                  </p>
                  <button
                    onClick={() => { setForgotMode(false); setResetSent(false); setResetEmail('') }}
                    className="w-full bg-primary-500 text-white py-3.5 rounded-xl text-sm font-semibold"
                  >
                    ← Rudi Kuingia
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="text-center mb-2">
                    <div className="text-3xl mb-2 flex justify-center"><i className="ti ti-key text-gray-400" aria-hidden="true" /></div>
                    <h3 className="text-base font-bold text-gray-900">Badilisha Nenosiri</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Tutakutumia kiungo cha kubadilisha nenosiri
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Barua pepe yako</label>
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
                    {loading ? 'Inatuma...' : 'Tuma Kiungo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setForgotMode(false); setError('') }}
                    className="w-full text-sm text-gray-400 py-3 min-h-[44px]"
                  >
                    ← Rudi
                  </button>
                </form>
              )
            ) : (
              /* ── NORMAL LOGIN MODE ── */
              <>
                <form onSubmit={handleEmailLogin} className="space-y-4">

                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block flex items-center gap-1"><i className="ti ti-mail" aria-hidden="true" />Barua pepe</label>
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
                    <label className="text-xs text-gray-500 mb-1.5 block flex items-center gap-1"><i className="ti ti-lock" aria-hidden="true" />Nenosiri</label>
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
                        aria-label={showPass ? 'Ficha nenosiri' : 'Onyesha nenosiri'}
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
                      Umesahau nenosiri?
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
                    {loading ? 'Inaingia...' : 'Ingia'}
                  </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-gray-400">au endelea na</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>

                {/* Google */}
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 border
                             border-gray-200 rounded-xl py-3.5 min-h-[48px] text-sm font-semibold
                             text-gray-700 bg-white hover:bg-gray-50 transition-all
                             disabled:opacity-50 active:scale-[0.98]"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}
                >
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Ingia na Google
                </button>

                {/* Hint */}
                <p className="text-center text-xs text-gray-400 mt-4">
                  <i className="ti ti-bulb" aria-hidden="true" /> Ingia kwa urahisi na akaunti ya Google au barua pepe
                </p>
              </>
            )}
          </div>
        </div>

        {/* Register link */}
        {!forgotMode && (
          <div className="mt-5 pb-8 flex flex-col items-center gap-3">
            <p className="text-center text-sm text-gray-500">
              Bado huna akaunti?{' '}
              <Link href="/register" className="text-primary-600 font-medium">
                Jisajili hapa
              </Link>
            </p>

            {/* Staff / Admin portal — subtle, not meant for regular users */}
            <Link
              href="/staff-login"
              className="flex items-center gap-1.5 text-[11px] text-gray-350 hover:text-gray-500 transition-colors py-1 px-3 rounded-full border border-gray-150 hover:border-gray-300"
              style={{ color: '#b0b8c1', borderColor: '#e8ecf0' }}
            >
              <i className="ti ti-shield-lock text-[11px]" aria-hidden="true" />
              Wafanyakazi &amp; Wasimamizi
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
