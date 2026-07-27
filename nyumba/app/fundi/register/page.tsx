'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function FundiRegisterPage() {
  const supabase = createClient()
  const [fullName,  setFullName]  = useState('')
  const [phone,     setPhone]     = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [done,      setDone]      = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!fullName.trim()) { setError('Jina kamili linahitajika'); return }
    if (password.length < 8) { setError('Nenosiri lazima liwe na herufi 8+'); return }
    setLoading(true)
    try {
      const origin = window.location.origin
      const { error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim(), role: 'fundi', phone: phone.trim() },
          emailRedirectTo: `${origin}/auth/callback?redirect=/fundi/complete`,
        },
      })
      if (authErr) { setError(authErr.message); return }
      try {
        localStorage.setItem('pending_fundi_register', JSON.stringify({ full_name: fullName.trim(), phone: phone.trim() }))
      } catch { /* storage unavailable */ }
      setDone(true)
    } catch {
      setError('Hitilafu ya mtandao. Jaribu tena.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-mail-check text-green-500 text-3xl" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Angalia Barua Pepe Yako</h1>
          <p className="text-sm text-gray-500">
            Tumetuma kiungo cha kuthibitisha kwa <strong>{email}</strong>.
            Bonyeza kiungo ili kukamilisha usajili.
          </p>
          <Link href="/fundi/login"
            className="mt-6 inline-block text-sm text-primary-600 font-semibold hover:underline">
            Rudi Kuingia
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-tools text-white text-3xl" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Jiandikishe — Fundi</h1>
          <p className="text-sm text-gray-500 mt-1">Unda akaunti ya fundi ya NyumbaFasta</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Jina Kamili *</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} required
                placeholder="Juma Hassan"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Nambari ya Simu</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+255 7XX XXX XXX"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Barua Pepe *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="juma@example.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Nenosiri *</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="Herufi 8 au zaidi"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <i className={`ti ti-${showPass ? 'eye-off' : 'eye'} text-base`} aria-hidden="true" />
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 transition">
              {loading ? 'Inasajili...' : 'Jiandikishe'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Una akaunti tayari?{' '}
          <Link href="/fundi/login" className="text-primary-600 font-semibold hover:underline">Ingia</Link>
        </p>
      </div>
    </div>
  )
}
