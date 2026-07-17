'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/advertising/dashboard'

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError('Barua pepe au nywila si sahihi.')
      setLoading(false); return
    }
    // Check advertiser profile exists
    const res = await fetch('/api/v1/advertising/me')
    if (!res.ok) {
      setError('Akaunti ya mfanyabiashara haikupatikana. Jiandikishe kwanza.')
      setLoading(false); return
    }
    window.location.href = redirectTo
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-sm p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Ingia — Mfanyabiashara</h1>
          <p className="text-gray-500 text-sm mt-1">Simamia matangazo yako ya NyumbaFasta</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Barua pepe</label>
            <input
              required type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              placeholder="biashara@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nywila</label>
            <input
              required type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full bg-primary-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-primary-600 transition disabled:opacity-50"
          >
            {loading ? 'Inaingia...' : 'Ingia'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Bado hujasajili?{' '}
          <Link href="/advertising/register" className="text-primary-600 font-medium hover:underline">
            Unda akaunti bure
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
