'use client'
import { useState, Suspense, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import ResendEmailButton from '@/components/auth/ResendEmailButton'
import AgreementModal from '@/components/legal/AgreementModal'

type Role    = 'client' | 'dalali' | 'org_owner' | 'tenant' | 'fundi'
type MktRole = 'client' | 'dalali'
type Step    = 'role' | 'marketplace_check' | 'marketplace_convert' | 'details' | 'agreement' | 'check_email'

interface AgreementData {
  version: string
  full_name_signed: string
  phone_signed: string
  checkboxes_checked: Record<string, boolean>
}

const ROLES: { key: Role; icon: string; label: string; sub: string; badge?: string }[] = [
  { key: 'client',    icon: 'home-search',     label: 'Natafuta Nyumba',    sub: 'Napenda kupata nyumba au chumba cha kupanga'       },
  { key: 'dalali',    icon: 'building-store',  label: 'Dalali / Wakala',    sub: 'Napanga au nauza nyumba kwa wateja',  badge: 'Dalali' },
  { key: 'org_owner', icon: 'building-estate', label: 'Shirika / Mmiliki',  sub: 'Nina jengo/nyumba — nataka mfumo wa kusimamia'    },
  { key: 'tenant',    icon: 'key',             label: 'Mpangaji',           sub: 'Tayari nina nyumba — nataka kuona malipo yangu'    },
  { key: 'fundi',     icon: 'tools',           label: 'Fundi / Mchezaji',   sub: 'Nafanya kazi za ukarabati na matengenezo nyumba'  },
]

function PasswordStrength({ value }: { value: string }) {
  if (!value) return null
  const weak   = value.length < 8
  const strong = value.length >= 12 && /[0-9!@#$%^&*]/.test(value)
  const mid    = !weak && !strong
  const pct    = weak ? 33 : mid ? 66 : 100
  const label  = weak ? 'Dhaifu' : mid ? 'Wastani' : 'Nguvu'
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemax={100} aria-valuetext={`Nguvu: ${label}`}
      className="mt-1.5 flex items-center gap-2">
      <div className="flex gap-1 flex-1">
        <div className={`h-1 flex-1 rounded-full transition-colors ${value.length >= 1 ? 'bg-red-400' : 'bg-gray-200'}`} />
        <div className={`h-1 flex-1 rounded-full transition-colors ${mid || strong ? 'bg-amber-400' : 'bg-gray-200'}`} />
        <div className={`h-1 flex-1 rounded-full transition-colors ${strong ? 'bg-primary-500' : 'bg-gray-200'}`} />
      </div>
      <span className={`text-xs font-medium ${weak ? 'text-red-400' : mid ? 'text-amber-500' : 'text-primary-600'}`}>{label}</span>
    </div>
  )
}

function FieldInput({ label, icon, children }: { label: string; icon?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1.5 block flex items-center gap-1">
        {icon && <i className={`ti ti-${icon}`} aria-hidden="true" />}{label}
      </label>
      {children}
    </div>
  )
}

const INPUT = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300'

function RegisterForm() {
  const supabase     = createClient()
  const router       = useRouter()
  const searchParams = useSearchParams()

  const initRole = (searchParams.get('role') as Role | null) ?? 'client'

  const [step,    setStep]    = useState<Step>('role')
  const [role,    setRole]    = useState<Role>(initRole)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // Common fields
  const [fullName,  setFullName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [regEmail,  setRegEmail]  = useState('')
  const [method,    setMethod]    = useState<'email' | 'google'>('email')

  // Dalali extra
  const [whatsapp, setWhatsapp] = useState('')

  // Portal extras
  const [phone,    setPhone]    = useState('')
  const [orgName,  setOrgName]  = useState('')
  const [city,     setCity]     = useState('')

  // Portal agreement checkbox
  const [agreed, setAgreed] = useState(false)

  // Marketplace → tenant conversion
  const [convertEmail,    setConvertEmail]    = useState('')
  const [convertPassword, setConvertPassword] = useState('')
  const [convertPhone,    setConvertPhone]    = useState('')
  const [convertShowPass, setConvertShowPass] = useState(false)
  const [converting,      setConverting]      = useState(false)
  const [convertError,    setConvertError]    = useState('')

  // If URL has ?role=fundi, redirect immediately
  useEffect(() => {
    if (initRole === 'fundi') router.replace('/fundi/register')
  }, [initRole, router])

  // ── Error mapper ─────────────────────────────────────────────────────────
  function mapError(msg: string) {
    return msg.includes('user already registered') || msg.includes('already been registered')
      ? 'Barua pepe hii imeshasajiliwa. Jaribu kuingia.'
      : msg.includes('invalid email')   ? 'Barua pepe si sahihi. Angalia tena.'
      : msg.includes('password')        ? 'Nenosiri ni fupi sana — angalau herufi 8.'
      : msg.includes('too many')        ? 'Maombi mengi mfululizo. Subiri dakika chache.'
      : 'Imeshindwa kusajili. Jaribu tena.'
  }

  // ── Validate details step ────────────────────────────────────────────────
  function validate(): string | null {
    if (!fullName.trim())  return 'Jina lako kamili linahitajika'
    if (!email.trim())     return 'Barua pepe inahitajika'
    if (password.length < 8) return 'Nenosiri lazima liwe na angalau herufi 8'
    if (role === 'dalali') {
      const d = whatsapp.replace(/\D/g, '').replace(/^0/, '')
      if (!d || d.length !== 9) return 'Nambari ya WhatsApp sahihi inahitajika (tarakimu 9)'
    }
    if (role === 'org_owner') {
      if (!phone.trim())   return 'Nambari ya simu inahitajika'
      if (!orgName.trim()) return 'Jina la shirika linahitajika'
      if (!city.trim())    return 'Mji au mkoa unahitajika'
    }
    if (role === 'tenant') {
      if (!phone.trim())   return 'Nambari ya simu inahitajika'
    }
    return null
  }

  // ── Marketplace (client/dalali) — agreement then signUp ─────────────────
  async function handleAgreementAccepted(agreementData: AgreementData) {
    setError(''); setLoading(true)
    const normalized = role === 'dalali' && whatsapp
      ? `+255${whatsapp.replace(/\D/g, '').replace(/^0/, '')}`
      : null
    localStorage.setItem('pending_register',  JSON.stringify({ full_name: fullName, role, whatsapp_number: normalized }))
    localStorage.setItem('pending_agreement', JSON.stringify(agreementData))
    try {
      if (method === 'google') {
        const { error: e } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/auth/callback?redirect=/register/complete` },
        })
        if (e) throw e
        return
      }
      const { error: e } = await supabase.auth.signUp({
        email, password,
        options: {
          data: { full_name: fullName, role, whatsapp_number: whatsapp },
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect=/register/complete`,
        },
      })
      if (e) throw e
      fetch('/api/v1/auth/resend-verification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      }).catch(() => {})
      setRegEmail(email); setStep('check_email')
    } catch (err: unknown) {
      localStorage.removeItem('pending_register'); localStorage.removeItem('pending_agreement')
      setError(mapError(err instanceof Error ? err.message.toLowerCase() : ''))
      setStep('details')
    } finally { setLoading(false) }
  }

  function proceedToAgreement(m: 'email' | 'google' = 'email') {
    const err = validate()
    if (err) { setError(err); return }
    setMethod(m); setStep('agreement')
  }

  // ── Marketplace → tenant account conversion ──────────────────────────────
  async function handleMarketplaceConvert() {
    if (!convertEmail.trim() || convertPassword.length < 6) {
      setConvertError('Jaza barua pepe na nenosiri sahihi.')
      return
    }
    setConverting(true); setConvertError('')
    try {
      // Sign in with their existing marketplace credentials
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email:    convertEmail.trim(),
        password: convertPassword,
      })
      if (authErr || !data.user) {
        setConvertError('Barua pepe au nenosiri si sahihi. Jaribu tena.')
        setConverting(false); return
      }
      // Convert account via API
      const res  = await fetch('/api/v1/portal/convert-client', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone: convertPhone.trim() || undefined }),
      })
      const j = await res.json()
      if (!res.ok) {
        setConvertError(j.error ?? 'Imeshindwa kubadilisha akaunti.')
        await supabase.auth.signOut()
        setConverting(false); return
      }
      // Success — go to tenant dashboard
      window.location.href = '/tenant'
    } catch {
      setConvertError('Hitilafu ya mtandao. Jaribu tena.')
      setConverting(false)
    }
  }

  // ── Portal (org_owner/tenant) — simpler flow, no AgreementModal ──────────
  async function handlePortalSignup() {
    setError(''); setLoading(true)
    try {
      const meta: Record<string, string> = {
        full_name:   fullName,
        role:        'client',        // safe for DB trigger
        portal_type: role,            // 'org_owner' or 'tenant'
        phone,
      }
      if (role === 'org_owner') { meta.org_name = orgName; meta.city = city }

      const { error: e } = await supabase.auth.signUp({
        email, password,
        options: {
          data: meta,
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect=/portal/complete`,
        },
      })
      if (e) throw e
      fetch('/api/v1/auth/resend-verification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      }).catch(() => {})
      setRegEmail(email); setStep('check_email')
    } catch (err: unknown) {
      setError(mapError(err instanceof Error ? err.message.toLowerCase() : ''))
    } finally { setLoading(false) }
  }

  // ── CHECK EMAIL ──────────────────────────────────────────────────────────
  if (step === 'check_email') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
        <div role="status" aria-live="polite" className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-sm">
          <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-mail text-4xl text-primary-500" aria-hidden="true" />
          </div>
          <h2 className="font-bold text-xl text-gray-800 mb-2">Angalia Barua Pepe Yako!</h2>
          <p className="text-gray-500 text-sm mb-1">Tumetuma email ya uthibitisho kwa:</p>
          <p className="font-semibold text-gray-800 mb-5">{regEmail}</p>
          <div className="bg-primary-50 rounded-xl p-4 mb-5 text-left">
            <p className="text-primary-800 text-sm font-medium mb-3">Hatua za kufuata:</p>
            <div className="space-y-2.5">
              {['Fungua Gmail au email yako', 'Tafuta email kutoka NyumbaFasta', 'Bonyeza "Thibitisha Akaunti Yangu"'].map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{i+1}</span>
                  <p className="text-primary-800 text-xs">{t}</p>
                </div>
              ))}
            </div>
          </div>
          <ResendEmailButton email={regEmail} />
          <p className="text-gray-400 text-xs mt-4">Angalia spam/junk folder kama email haionekani</p>
          <button onClick={() => router.push('/login')} className="mt-4 min-h-[44px] px-4 text-primary-500 text-sm underline flex items-center mx-auto">
            Rudi Login →
          </button>
        </div>
      </div>
    )
  }

  // ── MARKETPLACE CHECK — did they have a client account? ─────────────────
  if (step === 'marketplace_check') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-primary-500 px-4 pt-10 pb-8 flex justify-center">
          <div className="relative h-20 w-48">
            <Image src="/transparent_logo_nyumbafasta.png" alt="NyumbaFasta" fill priority className="object-contain" sizes="192px" />
          </div>
        </div>
        <div className="flex-1 px-4 -mt-4 pb-8 max-w-sm mx-auto w-full">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-gray-50">
              <button onClick={() => setStep('role')} aria-label="Rudi"
                className="text-gray-400 text-lg min-h-[44px] min-w-[44px] flex items-center justify-center">←</button>
              <p className="text-sm font-semibold text-gray-800">Akaunti ya Mpangaji</p>
            </div>
            <div className="p-6 space-y-5">
              <div className="text-center">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <i className="ti ti-home-search text-3xl text-amber-500" aria-hidden="true" />
                </div>
                <h2 className="font-bold text-gray-900 text-lg">Swali Moja Kwanza</h2>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  Je, umewahi kufungua akaunti ya NyumbaFasta ili <strong>kutafuta nyumba</strong> kwenye soko letu?
                </p>
              </div>

              <button
                onClick={() => setStep('marketplace_convert')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-primary-200 bg-primary-50 hover:border-primary-400 transition text-left group"
              >
                <div className="w-11 h-11 bg-primary-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <i className="ti ti-check text-white text-xl" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-primary-800 text-sm">Ndio, Nina Akaunti ya Zamani</p>
                  <p className="text-xs text-primary-600 mt-0.5">Badilisha akaunti yangu ya kutafuta nyumba hadi mpangaji</p>
                </div>
                <i className="ti ti-arrow-right text-primary-400 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              </button>

              <button
                onClick={() => setStep('details')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 bg-gray-50 hover:border-gray-200 transition text-left group"
              >
                <div className="w-11 h-11 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                  <i className="ti ti-user-plus text-gray-500 text-xl" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-700 text-sm">Hapana, Niunde Akaunti Mpya</p>
                  <p className="text-xs text-gray-400 mt-0.5">Sijawahi kutumia NyumbaFasta kutafuta nyumba</p>
                </div>
                <i className="ti ti-arrow-right text-gray-300 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              </button>
            </div>
          </div>
          <p className="text-center text-sm text-gray-500 mt-5">
            Una akaunti ya portal tayari?{' '}
            <Link href="/portal/login?type=tenant" className="text-primary-600 font-medium">Ingia hapa</Link>
          </p>
        </div>
      </div>
    )
  }

  // ── MARKETPLACE CONVERT — sign in + convert existing client account ────────
  if (step === 'marketplace_convert') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-primary-500 px-4 pt-10 pb-8 flex justify-center">
          <div className="relative h-20 w-48">
            <Image src="/transparent_logo_nyumbafasta.png" alt="NyumbaFasta" fill priority className="object-contain" sizes="192px" />
          </div>
        </div>
        <div className="flex-1 px-4 -mt-4 pb-8 max-w-sm mx-auto w-full">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-gray-50">
              <button onClick={() => { setConvertError(''); setStep('marketplace_check') }} aria-label="Rudi"
                className="text-gray-400 text-lg min-h-[44px] min-w-[44px] flex items-center justify-center">←</button>
              <p className="text-sm font-semibold text-gray-800">Badilisha Akaunti ya Zamani</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 flex items-start gap-2">
                <i className="ti ti-info-circle mt-0.5 flex-shrink-0" aria-hidden="true" />
                <p>Tumia barua pepe na nenosiri uliokuwa ukitumia kutafuta nyumba kwenye NyumbaFasta. Akaunti yako itabadilishwa moja kwa moja.</p>
              </div>

              {convertError && (
                <div role="alert" className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
                  {convertError}
                </div>
              )}

              <FieldInput label="Barua pepe ya akaunti ya zamani" icon="mail">
                <input
                  type="email" required autoComplete="email" placeholder="jina@gmail.com"
                  value={convertEmail} onChange={e => setConvertEmail(e.target.value)}
                  className={INPUT}
                />
              </FieldInput>

              <FieldInput label="Nenosiri" icon="lock">
                <div className="relative">
                  <input
                    type={convertShowPass ? 'text' : 'password'} required autoComplete="current-password"
                    placeholder="••••••••" value={convertPassword} onChange={e => setConvertPassword(e.target.value)}
                    className={`${INPUT} pr-11`}
                  />
                  <button type="button" onClick={() => setConvertShowPass(p => !p)}
                    aria-label={convertShowPass ? 'Ficha' : 'Onyesha'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <i className={`ti ti-${convertShowPass ? 'eye-off' : 'eye'}`} aria-hidden="true" />
                  </button>
                </div>
              </FieldInput>

              <FieldInput label="Nambari ya Simu (inayopendekezwa)" icon="phone">
                <input
                  type="tel" autoComplete="tel" placeholder="+255 7XX XXX XXX"
                  value={convertPhone} onChange={e => setConvertPhone(e.target.value)}
                  className={INPUT}
                />
                <p className="text-xs text-gray-400 mt-1">Inasaidia mmiliki wako kukutafuta kwenye mfumo</p>
              </FieldInput>

              <button
                onClick={handleMarketplaceConvert}
                disabled={converting || !convertEmail.trim() || convertPassword.length < 6}
                className="w-full bg-primary-500 text-white py-3.5 min-h-[48px] rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-primary-600 transition active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {converting
                  ? <><i className="ti ti-loader-2 animate-spin" aria-hidden="true" />Inabadilisha...</>
                  : <><i className="ti ti-key" aria-hidden="true" />Badilisha Akaunti Yangu &amp; Ingia</>
                }
              </button>

              <div className="border-t border-gray-100 pt-3 text-center">
                <button
                  onClick={() => { setConvertError(''); setStep('details') }}
                  className="text-sm text-primary-600 font-medium hover:underline"
                >
                  Badala yake, niunde akaunti mpya kabisa →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── AGREEMENT — marketplace roles ────────────────────────────────────────
  if (step === 'agreement' && (role === 'client' || role === 'dalali')) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <AgreementModal
          role={role as MktRole}
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

  // ── AGREEMENT — portal roles (inline) ────────────────────────────────────
  if (step === 'agreement' && (role === 'org_owner' || role === 'tenant')) {
    const dest = role === 'org_owner' ? '/property/dashboard' : '/tenant'
    const roleLabel = role === 'org_owner' ? 'Shirika / Mmiliki' : 'Mpangaji'
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-primary-500 px-4 pt-10 pb-8 flex justify-center">
          <div className="relative h-20 w-48">
            <Image src="/transparent_logo_nyumbafasta.png" alt="NyumbaFasta" fill priority className="object-contain" sizes="192px" />
          </div>
        </div>
        <div className="flex-1 px-4 -mt-4 pb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-gray-50">
              <button onClick={() => { setStep('details'); setError('') }} aria-label="Rudi"
                className="text-gray-400 text-lg min-h-[44px] min-w-[44px] flex items-center justify-center">←</button>
              <p className="text-sm font-semibold text-gray-800">Masharti — {roleLabel}</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-2 leading-relaxed">
                <p>Kwa kutumia mfumo wa NyumbaFasta wa usimamizi wa mali, unakubaliana na masharti yetu yafuatayo:</p>
                <ul className="list-disc list-inside space-y-1 text-xs text-gray-500">
                  <li>Utatoa taarifa sahihi na za kweli kwenye mfumo</li>
                  <li>Hutafanya vitendo visivyoruhusiwa au vinavyodhuru wengine</li>
                  <li>Unakubaliana na sera yetu ya faragha na matumizi ya data</li>
                  <li>Mfumo unaweza kusimamishwa kama masharti yatavunjwa</li>
                </ul>
                {role === 'org_owner' && (
                  <p className="text-xs text-primary-700 font-medium mt-2 p-2 bg-primary-50 rounded-lg">
                    Kama mmiliki/msimamizi wa shirika, unawajibika kwa taarifa za wapangaji wako wote kwenye mfumo.
                  </p>
                )}
                {role === 'tenant' && (
                  <p className="text-xs text-amber-700 font-medium mt-2 p-2 bg-amber-50 rounded-lg">
                    Kama mpangaji, baada ya kujisajili mwambie mmiliki wako barua pepe yako ili akuunganishe na mfumo wao.
                  </p>
                )}
              </div>

              {error && <div role="alert" className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <span className="flex-shrink-0 flex items-center justify-center min-w-[44px] min-h-[44px] -ml-3 -mt-3">
                  <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-300" />
                </span>
                <span className="text-sm text-gray-700">
                  Nimesoma na nakubaliana na <span className="text-primary-600 font-medium">masharti ya matumizi</span> ya NyumbaFasta.
                </span>
              </label>

              <button onClick={handlePortalSignup} disabled={!agreed || loading}
                className="w-full bg-primary-500 text-white py-3.5 min-h-[48px] rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-primary-600 transition active:scale-[0.98]">
                {loading ? 'Inasajili...' : `Unda Akaunti ya ${roleLabel} →`}
              </button>
              <p className="text-xs text-gray-400 text-center">
                Baada ya kusajili utapelekwa kwenye{' '}
                <span className="font-medium text-gray-600">{dest}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── MAIN FORM (role + details) ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-primary-500 px-4 pt-10 pb-8 flex justify-center items-center">
        <div className="relative h-20 sm:h-24 w-48 sm:w-56">
          <Image src="/transparent_logo_nyumbafasta.png" alt="NyumbaFasta" fill priority className="object-contain" sizes="224px" />
        </div>
      </div>

      <div className="flex-1 px-4 -mt-4 pb-8">

        {/* ── STEP 1: Role selection ──────────────────────────────────────── */}
        {step === 'role' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-bold text-gray-900 text-center mb-0.5">Wewe ni nani?</h2>
            <p className="text-xs text-gray-400 text-center mb-5">Chagua aina ya akaunti inayokufaa</p>

            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 mb-5">
              {ROLES.map(r => (
                r.key === 'fundi' ? (
                  <button key={r.key}
                    onClick={() => router.push('/fundi/register')}
                    className="col-span-2 flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 hover:border-primary-300 hover:bg-primary-50 transition text-left group">
                    <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-teal-100 transition">
                      <i className="ti ti-tools text-xl text-teal-600" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-700 group-hover:text-primary-700">{r.label}</p>
                      <p className="text-xs text-gray-400 leading-tight">{r.sub}</p>
                    </div>
                    <i className="ti ti-arrow-right text-gray-300 group-hover:text-primary-400 flex-shrink-0" aria-hidden="true" />
                  </button>
                ) : (
                  <button key={r.key}
                    onClick={() => setRole(r.key)}
                    aria-pressed={role === r.key}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-center
                      ${role === r.key ? 'border-primary-500 bg-primary-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition
                      ${role === r.key ? 'bg-primary-500' : 'bg-white border border-gray-200'}`}>
                      <i className={`ti ti-${r.icon} text-xl ${role === r.key ? 'text-white' : 'text-gray-500'}`} aria-hidden="true" />
                    </div>
                    <span className={`text-sm font-semibold leading-tight ${role === r.key ? 'text-primary-700' : 'text-gray-700'}`}>
                      {r.label}
                    </span>
                    <span className="text-xs text-gray-400 leading-tight">{r.sub}</span>
                    {role === r.key && <i className="ti ti-circle-check text-primary-500 text-sm" aria-hidden="true" />}
                  </button>
                )
              ))}
            </div>

            {/* Role-specific info banners */}
            {role === 'dalali' && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 text-xs text-amber-700">
                <i className="ti ti-bulb mr-1" aria-hidden="true" />
                Kama dalali, utahitaji subscription ya kila mwezi (Basic Tsh 10,000 au Premium Tsh 25,000)
              </div>
            )}
            {role === 'org_owner' && (
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 mb-4 text-xs text-purple-700">
                <i className="ti ti-info-circle mr-1" aria-hidden="true" />
                Utaweza kusimamia wapangaji, malipo ya kodi, na matengenezo ya mali yako yote mahali pamoja.
              </div>
            )}
            {role === 'tenant' && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 text-xs text-amber-700">
                <i className="ti ti-info-circle mr-1" aria-hidden="true" />
                Baada ya kusajili, mwambie mmiliki wako barua pepe yako ili akuunganishe na mfumo wao.
              </div>
            )}

            <button onClick={() => setStep(role === 'tenant' ? 'marketplace_check' : 'details')}
              className="w-full bg-primary-500 text-white py-3.5 min-h-[48px] rounded-xl text-sm font-semibold hover:bg-primary-600 transition active:scale-[0.98]">
              Endelea →
            </button>
          </div>
        )}

        {/* ── STEP 2: Details form ────────────────────────────────────────── */}
        {step === 'details' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-gray-50">
              <button onClick={() => { setStep('role'); setError('') }} aria-label="Rudi nyuma"
                className="text-gray-400 text-lg min-h-[44px] min-w-[44px] flex items-center justify-center">←</button>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">
                  {role === 'client'    ? 'Akaunti ya Mtafutaji'   :
                   role === 'dalali'    ? 'Akaunti ya Dalali'      :
                   role === 'org_owner' ? 'Akaunti ya Shirika/PM'  :
                   role === 'tenant'    ? 'Akaunti ya Mpangaji'    : ''}
                </p>
              </div>
              {/* Step dots */}
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary-500" />
                <span className="w-2 h-2 rounded-full bg-gray-200" />
                <span className="w-2 h-2 rounded-full bg-gray-200" />
              </div>
            </div>

            <div className="p-5">
              {error && (
                <div role="alert" className="mb-4 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
              )}

              <form onSubmit={e => { e.preventDefault(); const err = validate(); if (err) { setError(err); return } setError(''); proceedToAgreement('email') }} className="space-y-4">

                {/* Common fields */}
                <FieldInput label="Jina lako kamili" icon="user">
                  <input type="text" required autoComplete="name" placeholder="Jina Bingwa"
                    value={fullName} onChange={e => setFullName(e.target.value)} className={INPUT} />
                </FieldInput>

                <FieldInput label="Barua pepe" icon="mail">
                  <input type="email" required autoComplete="email" placeholder="jina@gmail.com"
                    value={email} onChange={e => setEmail(e.target.value)} className={INPUT} />
                </FieldInput>

                <FieldInput label="Nenosiri" icon="lock">
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} required minLength={8} autoComplete="new-password"
                      placeholder="Angalau herufi 8" value={password} onChange={e => setPassword(e.target.value)}
                      className={`${INPUT} pr-11`} />
                    <button type="button" onClick={() => setShowPass(p => !p)}
                      aria-label={showPass ? 'Ficha nenosiri' : 'Onyesha nenosiri'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center">
                      <i className={`ti ti-${showPass ? 'eye-off' : 'eye'}`} aria-hidden="true" />
                    </button>
                  </div>
                  <PasswordStrength value={password} />
                </FieldInput>

                {/* Dalali extra — WhatsApp */}
                {role === 'dalali' && (
                  <FieldInput label="Nambari ya WhatsApp *">
                    <div className="flex gap-2">
                      <span className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 text-sm text-gray-500 flex-shrink-0">+255</span>
                      <input type="tel" inputMode="numeric" required autoComplete="tel" placeholder="712 345 678"
                        value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary-300" />
                    </div>
                    {whatsapp.replace(/\D/g,'').length >= 9 && (
                      <p className="text-xs text-primary-600 mt-1 font-medium">
                        +255{whatsapp.replace(/\D/g,'').replace(/^0/,'')}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">Wateja watalipa Tsh 2,000 kupata nambari hii</p>
                  </FieldInput>
                )}

                {/* Org owner / tenant extra — phone */}
                {(role === 'org_owner' || role === 'tenant') && (
                  <FieldInput label="Nambari ya Simu / WhatsApp *" icon="phone">
                    <input type="tel" required autoComplete="tel" placeholder="+255 7XX XXX XXX"
                      value={phone} onChange={e => setPhone(e.target.value)} className={INPUT} />
                  </FieldInput>
                )}

                {/* Org owner extras */}
                {role === 'org_owner' && (
                  <>
                    <div className="pt-1 border-t border-gray-50">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Taarifa za Shirika</p>
                    </div>
                    <FieldInput label="Jina la Shirika / Jengo *" icon="building-estate">
                      <input type="text" required placeholder="mfano: Mapumziko Apartments"
                        value={orgName} onChange={e => setOrgName(e.target.value)} className={INPUT} />
                    </FieldInput>
                    <FieldInput label="Mji / Mkoa *" icon="map-pin">
                      <input type="text" required placeholder="mfano: Dar es Salaam, Kinondoni"
                        value={city} onChange={e => setCity(e.target.value)} className={INPUT} />
                    </FieldInput>
                  </>
                )}

                {/* Notice before agreement */}
                {(role === 'client' || role === 'dalali') && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                    <i className="ti ti-clipboard-list mr-1" aria-hidden="true" />
                    Hatua inayofuata: Utahitaji kusoma na kukubaliana na masharti ya matumizi.
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full bg-primary-500 text-white py-3.5 min-h-[48px] rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-primary-600 transition active:scale-[0.98]">
                  {loading ? 'Inaendelea...' : 'Endelea →'}
                </button>

                {/* Google — marketplace only */}
                {(role === 'client' || role === 'dalali') && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-gray-100" />
                      <span className="text-xs text-gray-400">au</span>
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>
                    <button type="button"
                      onClick={() => { if (!fullName.trim()) { setError('Weka jina lako kwanza'); return } proceedToAgreement('google') }}
                      disabled={loading || !fullName.trim()}
                      className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3.5 min-h-[48px] text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 active:scale-[0.98]">
                      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      {!fullName.trim() ? 'Weka jina kwanza' : 'Sajili na Google'}
                    </button>
                  </>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Login link */}
        {(step === 'role' || step === 'details') && (
          <p className="text-center text-sm text-gray-500 mt-5">
            Una akaunti tayari?{' '}
            <Link href="/login" className="text-primary-600 font-medium">Ingia hapa</Link>
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
