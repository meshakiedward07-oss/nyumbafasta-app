'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/advertising/dashboard'

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()

    if (forgotMode) {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/account/change-password`,
      })
      if (resetErr) { setError('Haikufanikiwa kutuma. Angalia barua pepe yako.') }
      else setForgotSent(true)
      setLoading(false)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError('Barua pepe au nywila si sahihi.')
      setLoading(false); return
    }
    const res = await fetch('/api/v1/advertising/me')
    if (!res.ok) {
      await supabase.auth.signOut()
      setError('Akaunti ya mfanyabiashara haikupatikana. Jiandikishe kwanza.')
      setLoading(false); return
    }
    window.location.href = redirectTo
  }

  if (forgotSent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-sm p-7 text-center">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Angalia Barua Pepe Yako</h2>
          <p className="text-sm text-gray-500 mb-6">
            Tumekutumia kiungo cha kubadilisha nywila kwenye <strong>{email}</strong>.
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
      {/* Branded top strip */}
      <div className="bg-gradient-to-r from-[#085041] to-primary-600 px-4 py-5 text-center text-white">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Image src="/transparent_logo_nyumbafasta.png" alt="NyumbaFasta" width={28} height={28} className="object-contain" />
          <span className="font-bold text-base">NyumbaFasta</span>
        </div>
        <p className="text-xs text-primary-200">Jukwaa la Matangazo ya Biashara</p>
      </div>

      <div className="flex-1 flex items-start justify-center pt-8 px-4 pb-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-sm p-6">

          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-800">
              {forgotMode ? 'Umesahau Nywila?' : 'Ingia kwa Akaunti'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {forgotMode
                ? 'Tutakutumia kiungo cha kubadilisha nywila'
                : 'Simamia matangazo ya biashara yako'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4 flex items-start gap-2">
              <span className="flex-shrink-0 mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Barua pepe</label>
              <input
                required type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                placeholder="biashara@email.com"
                autoComplete="email"
              />
            </div>

            {!forgotMode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nywila</label>
                <div className="relative">
                  <input
                    required type={showPw ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 pr-12"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                  >
                    {showPw ? 'Ficha' : 'Onyesha'}
                  </button>
                </div>
                <div className="text-right mt-1.5">
                  <button
                    type="button"
                    onClick={() => { setForgotMode(true); setError('') }}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    Umesahau nywila?
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full bg-primary-500 text-white py-3 rounded-xl text-sm font-bold hover:bg-primary-600 transition disabled:opacity-50 mt-1"
            >
              {loading
                ? (forgotMode ? 'Inatuma...' : 'Inaingia...')
                : (forgotMode ? 'Tuma Kiungo' : 'Ingia →')
              }
            </button>
          </form>

          {forgotMode ? (
            <p className="text-center text-sm text-gray-500 mt-4">
              <button
                onClick={() => { setForgotMode(false); setError('') }}
                className="text-primary-600 font-medium hover:underline"
              >
                ← Rudi kuingia
              </button>
            </p>
          ) : (
            <p className="text-center text-sm text-gray-500 mt-5">
              Bado hujasajili?{' '}
              <Link href="/advertising/register" className="text-primary-600 font-semibold hover:underline">
                Unda akaunti bure →
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
