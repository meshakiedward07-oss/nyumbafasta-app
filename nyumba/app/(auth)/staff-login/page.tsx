'use client'
import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

type Role = 'staff' | 'admin'

const ROLE_OPTIONS: { value: Role; label: string; icon: string; desc: string }[] = [
  { value: 'staff', label: 'Mfanyakazi',  icon: 'ti-user-check',   desc: 'Staff dashboard & leads' },
  { value: 'admin', label: 'Msimamizi',   icon: 'ti-shield-check',  desc: 'Udhibiti wote wa mfumo' },
]

function StaffLoginForm() {
  const supabase      = createClient()
  const searchParams  = useSearchParams()
  const redirectTo    = searchParams.get('redirect') || ''

  const [selectedRole, setSelectedRole] = useState<Role>('staff')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPass,     setShowPass]     = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')

  // Forgot password
  const [forgotMode,  setForgotMode]   = useState(false)
  const [resetEmail,  setResetEmail]   = useState('')
  const [resetSent,   setResetSent]    = useState(false)

  // ── Role-based redirect ─────────────────────────────────────────────
  async function redirectByRole(userId: string) {
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
      const { data: minimal } = await supabase
        .from('users')
        .select('role, is_active')
        .eq('id', userId)
        .single()
      profileData = minimal
    }

    const role = profileData?.role

    // Only staff and admin are allowed through this portal
    if (role !== 'admin' && role !== 'staff') {
      await supabase.auth.signOut()
      setError('Hii mlango ni kwa wafanyakazi na wasimamizi pekee. Wateja na madalali wanatumia mlango wa kawaida.')
      setLoading(false)
      return
    }

    if (profileData?.is_active === false) {
      await supabase.auth.signOut()
      setError('Akaunti yako imesimamishwa. Wasiliana na msimamizi wako.')
      setLoading(false)
      return
    }

    if (role === 'staff' && profileData?.staff_active === false) {
      await supabase.auth.signOut()
      setError('Akaunti yako ya mfanyakazi imezimwa. Wasiliana na msimamizi wako.')
      setLoading(false)
      return
    }

    if (role === 'staff' && profileData?.must_change_password) {
      window.location.href = '/account/change-password'
      return
    }

    const dest = redirectTo
      ? redirectTo
      : role === 'admin' ? '/admin'
      : '/admin/staff-dashboard'

    window.location.href = dest
  }

  // ── Login ───────────────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        const msg = error.message.toLowerCase()
        throw new Error(
          msg.includes('invalid login credentials') || msg.includes('invalid email or password')
            ? 'Barua pepe au nenosiri si sahihi.'
            : msg.includes('too many requests')
            ? 'Maombi mengi. Subiri dakika chache.'
            : 'Imeshindwa kuingia. Jaribu tena.'
        )
      }
      await redirectByRole(data.user.id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Imeshindwa kuingia.')
      setLoading(false)
    }
  }

  // ── Forgot password ─────────────────────────────────────────────────
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
        throw new Error((d as { error?: string }).error || 'Imeshindwa kutuma barua pepe.')
      }
      setResetSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Imeshindwa kutuma barua pepe.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* Header — dark professional */}
      <div
        className="relative overflow-hidden px-4 pt-10 pb-9 flex flex-col justify-center items-center"
        style={{ background: 'linear-gradient(160deg, #0f2417 0%, #085041 55%, #0d3d2e 100%)' }}
      >
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/3 pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-white/3 pointer-events-none" />

        <div className="relative h-14 sm:h-16 w-36 sm:w-44">
          <Image
            src="/transparent_logo_nyumbafasta.png"
            alt="NyumbaFasta"
            fill
            priority
            className="object-contain"
            sizes="192px"
          />
        </div>

        <div className="mt-3 flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1">
          <i className="ti ti-shield-lock text-xs text-white/70" aria-hidden="true" />
          <span className="text-white/80 text-xs font-semibold tracking-widest uppercase">
            Mfumo wa Wafanyakazi
          </span>
        </div>
        <p className="text-white/40 text-[11px] mt-1.5">Mlango huu ni kwa wafanyakazi na wasimamizi pekee</p>
      </div>

      <div className="flex-1 px-4 -mt-5 pb-10">
        <div
          className="bg-white rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)' }}
        >
          <div className="p-5">

            {/* Error */}
            {error && (
              <div role="alert" className="mb-4 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {/* ── FORGOT MODE ── */}
            {forgotMode ? (
              resetSent ? (
                <div className="text-center py-6">
                  <i className="ti ti-mail text-5xl text-primary-500" aria-hidden="true" />
                  <h3 className="text-base font-bold text-gray-900 mt-3 mb-2">Barua pepe imetumwa!</h3>
                  <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                    Angalia inbox yako na ubonyeze kiungo cha kubadilisha nenosiri.
                    Angalia pia folda ya Spam.
                  </p>
                  <button
                    onClick={() => { setForgotMode(false); setResetSent(false); setResetEmail('') }}
                    className="w-full py-3.5 rounded-xl text-sm font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, #085041, #0d3d2e)' }}
                  >
                    ← Rudi Kuingia
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="text-center mb-2">
                    <i className="ti ti-key text-3xl text-gray-400" aria-hidden="true" />
                    <h3 className="text-base font-bold text-gray-900 mt-1">Badilisha Nenosiri</h3>
                    <p className="text-xs text-gray-400 mt-1">Tutakutumia kiungo cha kubadilisha nenosiri</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Barua pepe yako</label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
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
                    className="w-full py-3.5 min-h-[48px] rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #085041, #0d3d2e)' }}
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
              /* ── MAIN LOGIN FORM ── */
              <form onSubmit={handleLogin} className="space-y-4">

                {/* Role selector */}
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium">Chagua nafasi yako</p>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSelectedRole(opt.value)}
                        className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 transition-all ${
                          selectedRole === opt.value
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        <i className={`ti ${opt.icon} text-xl`} aria-hidden="true" />
                        <span className="text-xs font-bold">{opt.label}</span>
                        <span className="text-[10px] text-center leading-tight opacity-70">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 flex items-center gap-1 block">
                    <i className="ti ti-mail" aria-hidden="true" />
                    Barua pepe
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="jina@nyumbafasta.co"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base
                               focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 flex items-center gap-1 block">
                    <i className="ti ti-lock" aria-hidden="true" />
                    Nenosiri
                  </label>
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <i className={`ti ${showPass ? 'ti-eye-off' : 'ti-eye'}`} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Forgot password */}
                <div className="text-right -mt-1">
                  <button
                    type="button"
                    onClick={() => { setForgotMode(true); setResetEmail(email); setError('') }}
                    className="text-xs text-primary-600 font-medium min-h-[44px] px-2 inline-flex items-center active:opacity-70"
                  >
                    Umesahau nenosiri?
                  </button>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full text-white py-3.5 min-h-[48px] rounded-xl text-sm font-semibold
                             disabled:opacity-50 transition-all active:scale-[0.98]"
                  style={{
                    background: 'linear-gradient(135deg, #0f2417 0%, #085041 55%, #0d3d2e 100%)',
                    boxShadow: loading ? 'none' : '0 4px 14px rgba(8,80,65,0.40), 0 1px 3px rgba(8,80,65,0.20)',
                  }}
                >
                  {loading
                    ? 'Inaingia...'
                    : selectedRole === 'admin'
                    ? 'Ingia kama Msimamizi'
                    : 'Ingia kama Mfanyakazi'}
                </button>

              </form>
            )}
          </div>
        </div>

        {/* Back to regular login */}
        {!forgotMode && (
          <p className="text-center text-sm text-gray-500 mt-5 pb-4">
            Si mfanyakazi?{' '}
            <Link href="/login" className="text-primary-600 font-medium">
              Rudi kwenye mlango wa kawaida
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}

export default function StaffLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <StaffLoginForm />
    </Suspense>
  )
}
