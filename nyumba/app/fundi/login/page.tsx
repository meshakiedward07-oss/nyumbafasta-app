'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function FundiLoginPage() {
  const supabase = createClient()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
      if (authErr) { setError('Barua pepe au nenosiri si sahihi.'); return }

      const { data: profile } = await supabase.from('users').select('role').eq('id', data.user.id).single()
      if (profile?.role !== 'fundi') {
        await supabase.auth.signOut()
        setError('Akaunti hii si ya fundi. Tumia ukurasa sahihi wa kuingia.')
        return
      }
      window.location.href = '/fundi/dashboard'
    } catch {
      setError('Hitilafu ya mtandao. Jaribu tena.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-tools text-white text-3xl" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Ingia — Fundi</h1>
          <p className="text-sm text-gray-500 mt-1">NyumbaFasta Fundi Portal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Barua Pepe</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="juma@example.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Nenosiri</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
                <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <i className={`ti ti-${showPass ? 'eye-off' : 'eye'} text-base`} aria-hidden="true" />
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 transition">
              {loading ? 'Inaingia...' : 'Ingia'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Huna akaunti?{' '}
          <Link href="/fundi/register" className="text-primary-600 font-semibold hover:underline">
            Jiandikishe
          </Link>
        </p>
        <p className="text-center text-xs text-gray-400 mt-2">
          <Link href="/login" className="hover:underline">Ingia kama mtumiaji wa kawaida</Link>
        </p>
      </div>
    </div>
  )
}
