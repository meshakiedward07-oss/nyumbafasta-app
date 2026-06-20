'use client'
import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ResendEmailButton from '@/components/auth/ResendEmailButton'

function LoginForm() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const redirectTo  = searchParams.get('redirect') || ''
  const isSuspended = searchParams.get('suspended') === '1'

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
    const { data } = await supabase
      .from('users')
      .select('role, is_active, staff_active, must_change_password')
      .eq('id', userId)
      .single()

    if (data?.is_active === false) {
      await supabase.auth.signOut()
      setError('Akaunti yako imesimamishwa. Wasiliana na support: wa.me/255615261147')
      setLoading(false)
      return
    }

    // Staff deactivated by admin
    if (data?.role === 'staff' && data?.staff_active === false) {
      await supabase.auth.signOut()
      setError('Akaunti yako ya staff imezimwa. Wasiliana na admin wako.')
      setLoading(false)
      return
    }

    // Staff forced to change password on first login
    if (data?.role === 'staff' && data?.must_change_password) {
      window.location.href = '/account/change-password'
      return
    }

    const dest = redirectTo
      ? redirectTo
      : data?.role === 'admin'  ? '/admin'
      : data?.role === 'staff'  ? '/admin/staff-leads'
      : data?.role === 'dalali' ? '/dashboard'
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
        if (error.message.toLowerCase().includes('email not confirmed')) {
          setUnverifiedEmail(email)
          setShowUnverified(true)
          setLoading(false)
          return
        }
        throw error
      }
      await redirectByRole(data.user.id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Barua pepe au nenosiri si sahihi')
      setLoading(false)
    }
  }

  // ── Google OAuth ──────────────────────────────────────
  async function handleGoogleLogin() {
    setError('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${redirectTo}`,
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
        redirectTo: `${window.location.origin}/auth/callback?redirect=/account/reset-password`,
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
      <div className="bg-[#1D9E75] px-4 pt-10 pb-8 flex justify-center items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/transparent_logo_nyumbafasta.png"
          alt="NyumbaFasta"
          className="h-20 sm:h-24 w-auto object-contain"
        />
      </div>

      <div className="flex-1 px-4 -mt-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* Suspension banner */}
          {isSuspended && (
            <div className="bg-red-50 border-b border-red-100 px-4 py-3 flex items-start gap-2">
              <span className="text-lg flex-shrink-0">🚫</span>
              <div>
                <p className="text-sm font-semibold text-red-700">Akaunti Imesimamishwa</p>
                <p className="text-xs text-red-500 mt-0.5">
                  Wasiliana nasi kupitia WhatsApp ili ujue sababu.
                </p>
              </div>
            </div>
          )}

          <div className="p-5">

            {/* Error */}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {/* Unverified email notice */}
            {showUnverified && (
              <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="font-semibold text-yellow-800 text-sm mb-1">
                  ✉️ Thibitisha Barua Pepe Yako Kwanza
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
                  <div className="text-5xl mb-4">📧</div>
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
                    <div className="text-3xl mb-2">🔑</div>
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
                    className="w-full text-sm text-gray-400 py-2"
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
                    <label className="text-xs text-gray-500 mb-1.5 block">✉️ Barua pepe</label>
                    <input
                      type="email"
                      required
                      placeholder="jina@gmail.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base
                                 focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">🔒 Nenosiri</label>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-base
                                   focus:outline-none focus:ring-2 focus:ring-primary-300"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm px-1"
                        tabIndex={-1}
                      >
                        {showPass ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>

                  {/* Forgot password link */}
                  <div className="text-right -mt-1">
                    <button
                      type="button"
                      onClick={() => { setForgotMode(true); setResetEmail(email); setError('') }}
                      className="text-xs text-primary-500 font-medium"
                    >
                      Umesahau nenosiri?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary-500 text-white py-3.5 min-h-[48px] rounded-xl text-sm
                               font-semibold disabled:opacity-50 hover:bg-primary-600
                               transition-colors active:scale-[0.98]"
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
                             border-gray-200 rounded-xl py-3.5 min-h-[48px] text-sm font-medium
                             text-gray-700 hover:bg-gray-50 transition-colors
                             disabled:opacity-50 active:scale-[0.98]"
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
                  💡 Ingia kwa urahisi na Google account yako au barua pepe
                </p>
              </>
            )}
          </div>
        </div>

        {/* Register link */}
        {!forgotMode && (
          <p className="text-center text-sm text-gray-500 mt-5 pb-8">
            Bado huna akaunti?{' '}
            <Link href="/register" className="text-primary-600 font-medium">
              Jisajili hapa
            </Link>
          </p>
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
