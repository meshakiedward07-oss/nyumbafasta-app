'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ChangePasswordForm() {
  const supabase = createClient()
  const router   = useRouter()
  const searchParams = useSearchParams()

  // 'reset' = arrived from password-reset email link; 'forced' = staff first login
  const [flowType, setFlowType] = useState<'reset' | 'forced' | 'unknown'>('unknown')

  useEffect(() => {
    // Supabase sets the session type to 'recovery' after a password reset code exchange
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        supabase.from('users').select('must_change_password, role').eq('id', data.session.user.id).single()
          .then(({ data: u }) => {
            if (u?.must_change_password && u?.role === 'staff') setFlowType('forced')
            else setFlowType('reset')
          })
      } else {
        setFlowType('reset')
      }
    })
    // Also honour explicit ?flow= param from the redirect
    const flow = searchParams.get('flow')
    if (flow === 'reset') setFlowType('reset')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [password,     setPassword]     = useState('')
  const [confirm,      setConfirm]      = useState('')
  const [showPass,     setShowPass]     = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')
  const [done,         setDone]         = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password lazima iwe na herufi 8 au zaidi')
      return
    }
    if (password !== confirm) {
      setError('Password hazifanani')
      return
    }

    setSaving(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    // Use admin-privileged API to clear must_change_password (RLS blocks client-side update)
    let role = 'client'
    try {
      const res = await fetch('/api/v1/auth/clear-force-password', { method: 'POST' })
      const json = await res.json()
      if (json.role) role = json.role
    } catch {
      // Non-fatal — middleware will still redirect correctly once flag is cleared
    }

    setDone(true)
    setSaving(false)

    setTimeout(() => {
      if (role === 'admin') router.push('/admin')
      else if (role === 'staff') router.push('/admin/staff-dashboard')
      else if (role === 'dalali') router.push('/dashboard')
      else router.push('/')
    }, 1500)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-sm">
          <div className="text-5xl mb-4 flex justify-center"><i className="ti ti-circle-check text-primary-500" aria-hidden="true" /></div>
          <h2 className="font-bold text-gray-900 text-lg mb-2">Password Imebadilishwa!</h2>
          <p className="text-gray-500 text-sm">Unakwenda kwenye dashboard yako...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-primary-500 px-4 pt-10 pb-8 flex justify-center">
        <div className="relative h-16 w-40">
          <Image
            src="/transparent_logo_nyumbafasta.png"
            alt="NyumbaFasta"
            fill
            priority
            className="object-contain"
            sizes="160px"
          />
        </div>
      </div>

      <div className="flex-1 px-4 -mt-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 max-w-sm mx-auto">
          <div className="text-center mb-5">
            <div className="text-3xl mb-2 flex justify-center"><i className="ti ti-key text-gray-600" aria-hidden="true" /></div>
            <h2 className="font-bold text-gray-900">
              {flowType === 'forced' ? 'Weka Password Mpya' : 'Badilisha Nenosiri'}
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {flowType === 'forced'
                ? 'Lazima ubadilishe password ya muda kabla ya kuendelea'
                : 'Weka nenosiri jipya la akaunti yako'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2.5 rounded-xl mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Password Mpya</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  minLength={8}
                  placeholder="Angalau herufi 8"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  aria-label={showPass ? 'Ficha nenosiri' : 'Onyesha nenosiri'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm p-1"
                >
                  {showPass ? <i className="ti ti-eye-off" aria-hidden="true" /> : <i className="ti ti-eye" aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Thibitisha Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  placeholder="Rudia password mpya"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(p => !p)}
                  aria-label={showConfirm ? 'Ficha uthibitisho' : 'Onyesha uthibitisho'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm p-1"
                >
                  {showConfirm ? <i className="ti ti-eye-off" aria-hidden="true" /> : <i className="ti ti-eye" aria-hidden="true" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-primary-500 text-white py-3.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Inabadilisha...' : 'Badilisha Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ChangePasswordForm />
    </Suspense>
  )
}
