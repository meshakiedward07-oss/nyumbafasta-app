'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ChangePasswordPage() {
  const supabase = createClient()
  const router   = useRouter()

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

    const { data: { user } } = await supabase.auth.getUser()
    let role = 'client'
    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      role = userData?.role ?? 'client'
      await supabase
        .from('users')
        .update({ must_change_password: false })
        .eq('id', user.id)
    }

    setDone(true)
    setSaving(false)

    setTimeout(() => {
      if (role === 'admin' || role === 'staff') router.push('/admin')
      else if (role === 'dalali') router.push('/dashboard')
      else router.push('/')
    }, 2000)
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/transparent_logo_nyumbafasta.png" alt="NyumbaFasta" className="h-16 w-auto object-contain" />
      </div>

      <div className="flex-1 px-4 -mt-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 max-w-sm mx-auto">
          <div className="text-center mb-5">
            <div className="text-3xl mb-2 flex justify-center"><i className="ti ti-key text-gray-600" aria-hidden="true" /></div>
            <h2 className="font-bold text-gray-900">Badilisha Password</h2>
            <p className="text-xs text-gray-400 mt-1">
              Lazima ubadilishe password ya muda kabla ya kuendelea
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
