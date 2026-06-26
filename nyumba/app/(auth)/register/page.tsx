'use client'
import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ResendEmailButton from '@/components/auth/ResendEmailButton'
import AgreementModal from '@/components/legal/AgreementModal'

type Role = 'client' | 'dalali'
type Step = 'role' | 'details' | 'agreement' | 'check_email'

interface AgreementData {
  version: string
  full_name_signed: string
  phone_signed: string
  checkboxes_checked: Record<string, boolean>
}

function RegisterForm() {
  const supabase = createClient()
  const router   = useRouter()

  const [step, setStep]       = useState<Step>('role')
  const [role, setRole]       = useState<Role>('client')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const [fullName, setFullName]       = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [whatsapp, setWhatsapp]       = useState('')
  const [showPass, setShowPass]       = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [signupMethod, setSignupMethod] = useState<'email' | 'google'>('email')

  // Called when user accepts the agreement — handles both email and Google paths
  async function handleAgreementAccepted(agreementData: AgreementData) {
    setError('')
    setLoading(true)

    localStorage.setItem('pending_register', JSON.stringify({
      full_name: fullName,
      role,
      whatsapp_number: whatsapp,
    }))
    localStorage.setItem('pending_agreement', JSON.stringify(agreementData))

    try {
      if (signupMethod === 'google') {
        const { error: authError } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback?redirect=/register/complete`,
          },
        })
        if (authError) throw authError
        // OAuth redirect — loading stays true
        return
      }

      // Email signup
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role, whatsapp_number: whatsapp },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (authError) throw authError

      setRegisteredEmail(email)
      setStep('check_email')
    } catch (err: unknown) {
      localStorage.removeItem('pending_register')
      localStorage.removeItem('pending_agreement')
      setError(err instanceof Error ? err.message : 'Imeshindwa kusajili. Jaribu tena.')
      setStep('details')
    } finally {
      setLoading(false)
    }
  }

  // Step: details → agreement (validate form first)
  function proceedToAgreement(method: 'email' | 'google' = 'email') {
    setError('')
    if (role === 'dalali' && !whatsapp.trim()) {
      setError('Nambari ya WhatsApp inahitajika kwa madalali.')
      return
    }
    setSignupMethod(method)
    setStep('agreement')
  }

  // ── CHECK EMAIL step ──────────────────────────────────
  if (step === 'check_email') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-sm">
          <div className="w-20 h-20 bg-[#E1F5EE] rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">📧</span>
          </div>
          <h2 className="font-bold text-xl text-gray-800 mb-2">Angalia Barua Pepe Yako!</h2>
          <p className="text-gray-500 text-sm mb-1">Tumetuma email ya uthibitisho kwa:</p>
          <p className="font-semibold text-gray-800 mb-5">{registeredEmail}</p>
          <div className="bg-[#E1F5EE] rounded-xl p-4 mb-5 text-left">
            <p className="text-[#0F6E56] text-sm font-medium mb-3">Hatua za kufuata:</p>
            <div className="space-y-2.5">
              {[
                'Fungua Gmail au email yako',
                'Tafuta email kutoka NyumbaFasta',
                'Bonyeza "Thibitisha Akaunti Yangu"',
              ].map((txt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-[#1D9E75] rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  <p className="text-[#085041] text-xs">{txt}</p>
                </div>
              ))}
            </div>
          </div>
          <ResendEmailButton email={registeredEmail} />
          <p className="text-gray-400 text-xs mt-4">
            Angalia spam/junk folder kama email haionekani
          </p>
          <button
            onClick={() => router.push('/login')}
            className="mt-4 text-[#1D9E75] text-sm underline"
          >
            Rudi Login →
          </button>
        </div>
      </div>
    )
  }

  // ── AGREEMENT step ────────────────────────────────────
  if (step === 'agreement') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <AgreementModal
          role={role}
          prefillName={fullName}
          prefillPhone={role === 'dalali' ? `+255${whatsapp}` : ''}
          onAccept={handleAgreementAccepted}
          onBack={() => { setStep('details'); setError('') }}
          fullPage
        />
        {loading && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 text-center">
              <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-600">Inasajili...</p>
            </div>
          </div>
        )}
      </div>
    )
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

        {/* ── STEP 1: Role selection ── */}
        {step === 'role' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-bold text-gray-900 text-center mb-1">Wewe ni nani?</h2>
            <p className="text-xs text-gray-400 text-center mb-5">Chagua aina ya akaunti</p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setRole('client')}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all
                  ${role === 'client' ? 'border-primary-500 bg-primary-50' : 'border-gray-100 bg-gray-50'}`}
              >
                <span className="text-3xl">🔍</span>
                <span className={`text-sm font-semibold ${role === 'client' ? 'text-primary-700' : 'text-gray-700'}`}>
                  Natafuta
                </span>
                <span className="text-xs text-gray-400 text-center leading-tight">
                  Nataka kupata nyumba au chumba
                </span>
                {role === 'client' && <span className="text-primary-500 text-lg">✓</span>}
              </button>

              <button
                onClick={() => setRole('dalali')}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all
                  ${role === 'dalali' ? 'border-primary-500 bg-primary-50' : 'border-gray-100 bg-gray-50'}`}
              >
                <span className="text-3xl">🏢</span>
                <span className={`text-sm font-semibold ${role === 'dalali' ? 'text-primary-700' : 'text-gray-700'}`}>
                  Mimi ni Dalali
                </span>
                <span className="text-xs text-gray-400 text-center leading-tight">
                  Napanga/nauza nyumba
                </span>
                {role === 'dalali' && <span className="text-primary-500 text-lg">✓</span>}
              </button>
            </div>

            {role === 'dalali' && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 text-xs text-amber-700">
                💡 Kama dalali, utahitaji subscription ya kila mwezi (Basic Tsh 10,000 au Premium Tsh 25,000)
              </div>
            )}

            <button
              onClick={() => setStep('details')}
              className="w-full bg-primary-500 text-white py-3.5 min-h-[48px] rounded-xl text-sm font-semibold"
            >
              Endelea →
            </button>
          </div>
        )}

        {/* ── STEP 2: Details form ── */}
        {step === 'details' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

            <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-gray-50">
              <button
                onClick={() => { setStep('role'); setError('') }}
                className="text-gray-400 text-lg leading-none"
              >
                ←
              </button>
              <p className="text-sm font-semibold text-gray-800">
                {role === 'dalali' ? '🏢 Akaunti ya Dalali' : '🔍 Akaunti ya Mteja'}
              </p>
            </div>

            <div className="p-5">
              {error && (
                <div className="mb-4 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}

              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-primary-500 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                  <span className="text-[10px] text-primary-600 font-medium">Maelezo</span>
                </div>
                <div className="flex-1 h-px bg-gray-200" />
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-400 text-[10px] flex items-center justify-center font-bold">2</span>
                  <span className="text-[10px] text-gray-400">Makubaliano</span>
                </div>
                <div className="flex-1 h-px bg-gray-200" />
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-400 text-[10px] flex items-center justify-center font-bold">3</span>
                  <span className="text-[10px] text-gray-400">Thibitisha</span>
                </div>
              </div>

              <form onSubmit={e => { e.preventDefault(); proceedToAgreement('email') }} className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">👤 Jina lako kamili</label>
                  <input
                    type="text"
                    required
                    placeholder="Jina Bingwa"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base
                               focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>

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
                      minLength={6}
                      placeholder="Angalau herufi 6"
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
                      {showPass ? '🙈' : '👁️'}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex gap-1 flex-1">
                        <div className={`h-1 flex-1 rounded-full transition-colors ${password.length >= 1 ? 'bg-red-400' : 'bg-gray-200'}`} />
                        <div className={`h-1 flex-1 rounded-full transition-colors ${password.length >= 8 ? 'bg-amber-400' : 'bg-gray-200'}`} />
                        <div className={`h-1 flex-1 rounded-full transition-colors ${password.length >= 12 && /[0-9!@#$%^&*]/.test(password) ? 'bg-primary-500' : 'bg-gray-200'}`} />
                      </div>
                      <span className={`text-[10px] font-medium ${password.length < 8 ? 'text-red-400' : password.length < 12 ? 'text-amber-500' : 'text-primary-600'}`}>
                        {password.length < 8 ? 'Dhaifu' : password.length < 12 ? 'Wastani' : 'Nguvu'}
                      </span>
                    </div>
                  )}
                </div>

                {/* WhatsApp — dalali only */}
                {role === 'dalali' && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">
                      📱 Nambari ya WhatsApp
                      <span className="text-red-400 ml-0.5">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 text-sm text-gray-500 flex-shrink-0">
                        🇹🇿 +255
                      </div>
                      <input
                        type="tel"
                        inputMode="numeric"
                        required
                        placeholder="712 345 678"
                        value={whatsapp}
                        onChange={e => setWhatsapp(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm
                                   focus:outline-none focus:ring-2 focus:ring-primary-300"
                      />
                    </div>
                    {whatsapp.replace(/\D/g, '').length >= 9 && (
                      <p className="text-xs text-primary-600 mt-1 font-medium">
                        Nambari itahifadhiwa kama: +255{whatsapp.replace(/\D/g, '').replace(/^0/, '')}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Wateja watalipa Tsh 2,000 kupata nambari hii
                    </p>
                  </div>
                )}

                {/* Agreement notice */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                  📋 Hatua inayofuata: Utahitaji kusoma na kukubaliana na masharti ya matumizi kabla akaunti haijafunguliwa.
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary-500 text-white py-3.5 min-h-[48px] rounded-xl text-sm
                             font-semibold disabled:opacity-50 hover:bg-primary-600 transition-colors active:scale-[0.98]"
                >
                  {loading ? 'Inaendelea...' : 'Endelea kwa Makubaliano →'}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-gray-400">au</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>

                {/* Google */}
                <button
                  type="button"
                  onClick={() => {
                    if (!fullName.trim()) { setError('Weka jina lako kwanza'); return }
                    proceedToAgreement('google')
                  }}
                  disabled={loading || !fullName.trim()}
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
                  {!fullName.trim() ? 'Weka jina kwanza' : 'Sajili na Google'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Login link */}
        {(step === 'role' || step === 'details') && (
          <p className="text-center text-sm text-gray-500 mt-5">
            Una akaunti tayari?{' '}
            <Link href="/login" className="text-primary-600 font-medium">
              Ingia hapa
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  )
}
