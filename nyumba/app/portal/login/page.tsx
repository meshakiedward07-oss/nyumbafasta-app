'use client'
import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

const PORTAL_TYPES = {
  org:    { label: 'Shirika / Mmiliki / PM', icon: 'building-estate', dest: '/property/dashboard', color: '#7C3AED', bg: '#F5F3FF' },
  tenant: { label: 'Mpangaji',               icon: 'key',             dest: '/tenant',             color: '#D97706', bg: '#FFFBEB' },
}

function PortalLoginForm() {
  const supabase     = createClient()
  const searchParams = useSearchParams()
  const typeParam    = searchParams.get('type') as 'org' | 'tenant' | null
  const portalType   = typeParam && PORTAL_TYPES[typeParam] ? typeParam : null

  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [showPass,   setShowPass]   = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  const info = portalType ? PORTAL_TYPES[portalType] : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)

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
        if (!res.ok) setError('Haikufanikiwa kutuma. Jaribu tena.')
        else setForgotSent(true)
        return
      }

      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
      if (authErr) throw authErr

      const user = data.user
      const meta = user.user_metadata ?? {}

      let dest = '/'
      const mPortal = meta.portal_type as string | undefined
      const mRole   = meta.role        as string | undefined

      if (mPortal === 'org_owner' || mRole === 'org_owner')    dest = '/property/dashboard'
      else if (mPortal === 'tenant' || mRole === 'tenant')     dest = '/tenant'
      else if (mRole === 'fundi')                               dest = '/fundi/dashboard'
      else if (portalType === 'org')                            dest = '/property/dashboard'
      else if (portalType === 'tenant')                         dest = '/tenant'
      else {
        const { data: prof } = await supabase.from('users').select('role, portal_type').eq('id', user.id).maybeSingle()
        if (prof?.role === 'admin')                             dest = '/admin'
        else if (prof?.role === 'staff')                        dest = '/admin/staff-dashboard'
        else if (prof?.role === 'dalali')                       dest = '/dashboard'
        else if ((prof as unknown as Record<string, string> | null)?.portal_type === 'org_owner') dest = '/property/dashboard'
        else if ((prof as unknown as Record<string, string> | null)?.portal_type === 'tenant')   dest = '/tenant'
        else                                                    dest = '/'
      }

      window.location.href = dest
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      setError(
        msg.includes('invalid login') || msg.includes('invalid email or password')
          ? 'Barua pepe au nenosiri si sahihi.'
          : msg.includes('too many') ? 'Maombi mengi. Subiri dakika chache.'
          : 'Imeshindwa kuingia. Jaribu tena.'
      )
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
          <h2 className="text-lg font-bold text-gray-900 mb-2">Angalia Barua Pepe</h2>
          <p className="text-sm text-gray-500 mb-6">
            Kiungo cha kubadilisha nenosiri kimetumwa kwa <strong>{email}</strong>.
          </p>
          <button
            onClick={() => { setForgotMode(false); setForgotSent(false) }}
            className="text-primary-600 font-medium text-sm hover:underline"
          >
            ← Rudi Kuingia
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <div className="relative overflow-hidden px-4 pt-10 pb-9 flex flex-col items-center"
        style={{ background: info ? `linear-gradient(135deg, ${info.color}dd, ${info.color})` : 'linear-gradient(160deg, #27AE72, #117652)' }}>
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
        <div className="relative h-14 w-40 mb-3">
          <Image src="/transparent_logo_nyumbafasta.png" alt="NyumbaFasta" fill priority className="object-contain" sizes="160px" />
        </div>
        {info && (
          <div className="flex items-center gap-2 mt-1">
            <i className={`ti ti-${info.icon} text-white/90 text-lg`} aria-hidden="true" />
            <p className="text-white/90 text-sm font-medium">{info.label}</p>
          </div>
        )}
        {!info && <p className="text-white/75 text-sm">Portal ya Usimamizi</p>}
      </div>

      <div className="flex-1 px-4 -mt-5 pb-8 max-w-sm mx-auto w-full">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          <div className="px-5 pt-5 pb-1">
            <h1 className="text-lg font-bold text-gray-900">
              {forgotMode ? 'Umesahau Nenosiri?' : 'Karibu Tena'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {forgotMode
                ? 'Tutakutumia kiungo cha kubadilisha nenosiri'
                : 'Ingia katika akaunti yako'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div role="alert" className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}

            <div>
              <label className="text-xs text-gray-500 mb-1.5 block flex items-center gap-1">
                <i className="ti ti-mail" aria-hidden="true" /> Barua pepe
              </label>
              <input type="email" required autoComplete="email" placeholder="jina@gmail.com"
                value={email} onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>

            {!forgotMode && (
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block flex items-center gap-1">
                  <i className="ti ti-lock" aria-hidden="true" /> Nenosiri
                </label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} required autoComplete="current-password"
                    placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-base focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    aria-label={showPass ? 'Ficha' : 'Onyesha'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <i className={`ti ti-${showPass ? 'eye-off' : 'eye'}`} aria-hidden="true" />
                  </button>
                </div>
                <div className="text-right mt-1">
                  <button
                    type="button"
                    onClick={() => { setForgotMode(true); setError('') }}
                    className="text-xs text-primary-500 font-medium hover:underline"
                  >
                    Umesahau nenosiri?
                  </button>
                </div>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full text-white py-3.5 min-h-[48px] rounded-xl text-sm font-semibold disabled:opacity-50 transition active:scale-[0.98]"
              style={{ background: info ? info.color : 'linear-gradient(135deg, #27AE72, #117652)' }}>
              {loading
                ? (forgotMode ? 'Inatuma...' : 'Inaingia...')
                : (forgotMode ? 'Tuma Kiungo' : 'Ingia')}
            </button>

            {forgotMode && (
              <button
                type="button"
                onClick={() => { setForgotMode(false); setError('') }}
                className="w-full text-sm text-gray-500 hover:text-gray-700 py-1 text-center"
              >
                ← Rudi kuingia
              </button>
            )}
          </form>
        </div>

        {/* Register + back links */}
        <div className="mt-5 space-y-3 text-center">
          {info && (
            <p className="text-sm text-gray-500">
              Bado huna akaunti?{' '}
              <Link href={`/register?role=${portalType === 'org' ? 'org_owner' : 'tenant'}`} className="font-medium" style={{ color: info.color }}>
                Jisajili hapa
              </Link>
            </p>
          )}
          <Link href="/portal" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition">
            <i className="ti ti-arrow-left text-xs" aria-hidden="true" /> Rudi kwenye Portal
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function PortalLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PortalLoginForm />
    </Suspense>
  )
}
