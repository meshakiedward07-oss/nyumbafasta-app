'use client'
import { useState, Suspense, useEffect } from 'react'
import { useLanguage } from '@/lib/i18n/context'
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

function PasswordStrength({ value }: { value: string }) {
  const { t } = useLanguage()
  if (!value) return null
  const weak   = value.length < 8
  const strong = value.length >= 12 && /[0-9!@#$%^&*]/.test(value)
  const mid    = !weak && !strong
  const pct    = weak ? 33 : mid ? 66 : 100
  const label  = weak ? t('auth_password_strength_weak') : mid ? t('auth_password_strength_fair') : t('auth_password_strength_strong')
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemax={100} aria-valuetext={`${t('auth_password')}: ${label}`}
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


function RegisterForm() {
  const { t }  = useLanguage()
  const supabase     = createClient()
  const router       = useRouter()
  const searchParams = useSearchParams()

  const initRole  = (searchParams.get('role') as Role | null) ?? 'client'
  const refCode   = searchParams.get('ref') ?? ''

  const ROLES: { key: Role; icon: string; label: string; sub: string; badge?: string }[] = [
    { key: 'client',    icon: 'home-search',     label: t('role_client'),    sub: t('auth_role_client_sub')    },
    { key: 'dalali',    icon: 'building-store',  label: t('role_dalali'),    sub: t('auth_role_dalali_sub'), badge: 'Dalali' },
    { key: 'org_owner', icon: 'building-estate', label: t('role_org_owner'), sub: t('auth_role_org_owner_sub') },
    { key: 'tenant',    icon: 'key',             label: t('role_tenant'),    sub: t('auth_role_tenant_sub')    },
    { key: 'fundi',     icon: 'tools',           label: t('role_fundi'),     sub: t('auth_role_fundi_sub')     },
  ]

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

  // check_email step: button + auto-detect state
  const [sessionChecking, setSessionChecking] = useState(false)
  const [sessionError,    setSessionError]    = useState('')

  // If URL has ?role=fundi, redirect immediately
  useEffect(() => {
    if (initRole === 'fundi') router.replace('/fundi/register')
  }, [initRole, router])

  // Auto-detect when user confirms email in another tab/window → redirect immediately
  useEffect(() => {
    if (step !== 'check_email') return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') finaliseAndRedirect()
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // ── Finalise registration after session exists and redirect to dashboard ──
  async function finaliseAndRedirect() {
    const normalized = role === 'dalali' && whatsapp
      ? `+255${whatsapp.replace(/\D/g, '').replace(/^0/, '')}`
      : undefined
    // Best-effort: ensure public.users row has agreement_accepted=true.
    // auth/callback also does this, but calling here handles the case where
    // the user was already in check_email when they confirmed in another tab.
    let pendingReferral: string | null = null
    try { pendingReferral = localStorage.getItem('pending_referral_code') } catch { /* ignore */ }
    try {
      await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName, role, whatsapp_number: normalized,
          referral_code: pendingReferral || refCode || undefined,
        }),
      })
    } catch { /* non-fatal — auth/callback is the safety net */ }
    router.replace(role === 'dalali' ? '/dashboard?welcome=true' : '/?welcome=true')
  }

  // ── Error mapper ─────────────────────────────────────────────────────────
  function mapError(msg: string) {
    return msg.includes('user already registered') || msg.includes('already been registered')
      ? `${t('auth_email_taken')}. ${t('auth_sign_in_instead')}.`
      : msg.includes('invalid email')   ? t('auth_err_invalid_email')
      : msg.includes('password')        ? t('auth_password_min')
      : msg.includes('too many')        ? t('auth_err_too_many')
      : t('common_error')
  }

  // ── Validate details step ────────────────────────────────────────────────
  function validate(): string | null {
    if (!fullName.trim())  return t('auth_err_name_required')
    if (!email.trim())     return t('auth_err_email_required')
    if (password.length < 8) return t('auth_err_password_length')
    if (role === 'dalali') {
      const d = whatsapp.replace(/\D/g, '').replace(/^0/, '')
      if (!d || d.length !== 9) return t('auth_err_whatsapp')
    }
    if (role === 'org_owner') {
      if (!phone.trim())   return t('auth_err_phone_required')
      if (!orgName.trim()) return t('auth_err_org_name_required')
      if (!city.trim())    return t('auth_err_city_required')
    }
    if (role === 'tenant') {
      if (!phone.trim())   return t('auth_err_phone_required')
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
    if (refCode) localStorage.setItem('pending_referral_code', refCode)
    try {
      if (method === 'google') {
        const { error: e } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/auth/callback?redirect=/register/complete` },
        })
        if (e) throw e
        return
      }
      const { error: e, data: signUpData } = await supabase.auth.signUp({
        email, password,
        options: {
          // Store agreement data in user_metadata so auth/callback can finalise
          // registration without needing /register/complete (which required localStorage
          // and was fragile across devices / Supabase redirect-URL stripping).
          data: {
            full_name:       fullName,
            role,
            whatsapp_number: whatsapp,
            agr_v:           agreementData.version,
            agr_name:        agreementData.full_name_signed,
            agr_phone:       agreementData.phone_signed,
            // Embedded here (not just localStorage) so auth/callback can attribute
            // the influencer referral server-side, regardless of which device/
            // browser the user clicks the email confirmation link from.
            referral_code:   refCode || undefined,
          },
          // No ?redirect= param — auth/callback finalises everything server-side
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (e) throw e

      // If Supabase returned a session immediately (email confirmation disabled in project),
      // finalise registration now and skip the check_email waiting page entirely.
      if (signUpData?.session) {
        await finaliseAndRedirect()
        return
      }

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
      setConvertError(t('auth_err_fill_credentials'))
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
        setConvertError(t('auth_err_invalid_creds'))
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
        setConvertError(j.error ?? t('auth_err_convert_account'))
        await supabase.auth.signOut()
        setConverting(false); return
      }
      // Success — go to tenant dashboard
      window.location.href = '/tenant'
    } catch {
      setConvertError(t('auth_err_network'))
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
      if (role === 'tenant') {
        const orgId = searchParams.get('org')
        if (orgId) meta.invited_by_org = orgId
      }

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
          <h2 className="font-bold text-xl text-gray-800 mb-2">{t('auth_check_email')}!</h2>
          <p className="text-gray-500 text-sm mb-1">{t('auth_verification_sent')}</p>
          <p className="font-semibold text-gray-800 mb-5">{regEmail}</p>
          <div className="bg-primary-50 rounded-xl p-4 mb-5 text-left">
            <p className="text-primary-800 text-sm font-medium mb-3">{t('auth_next_steps')}</p>
            <div className="space-y-2.5">
              {[t('auth_step_open_email'), t('auth_step_find_nyumba'), t('auth_step_click_verify')].map((stepText, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{i+1}</span>
                  <p className="text-primary-800 text-xs">{stepText}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Primary CTA — appears after email is confirmed */}
          <button
            onClick={async () => {
              setSessionChecking(true); setSessionError('')
              const { data: { session } } = await supabase.auth.getSession()
              if (session) { await finaliseAndRedirect(); return }
              setSessionError('Bonyeza link kwenye email kwanza, kisha rudi hapa ubonyeze Endelea.')
              setSessionChecking(false)
            }}
            disabled={sessionChecking}
            className="w-full bg-primary-500 text-white py-3.5 min-h-[48px] rounded-xl text-sm font-semibold
                       disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {sessionChecking
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Inaangalia...</>
              : 'Nimekonfirma Email — Endelea →'}
          </button>
          {sessionError && (
            <p className="text-amber-600 text-xs text-center mt-1">{sessionError}</p>
          )}

          <ResendEmailButton email={regEmail} />
          <p className="text-gray-400 text-xs mt-4">{t('auth_check_spam')}</p>
          <button onClick={() => router.push('/login')} className="mt-4 min-h-[44px] px-4 text-primary-500 text-sm underline flex items-center mx-auto">
            {t('auth_login_title')} →
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
              <button onClick={() => setStep('role')} aria-label={t('common_back')}
                className="text-gray-400 text-lg min-h-[44px] min-w-[44px] flex items-center justify-center">←</button>
              <p className="text-sm font-semibold text-gray-800">{t('role_tenant')}</p>
            </div>
            <div className="p-6 space-y-5">
              <div className="text-center">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <i className="ti ti-home-search text-3xl text-amber-500" aria-hidden="true" />
                </div>
                <h2 className="font-bold text-gray-900 text-lg">{t('auth_one_question')}</h2>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  {t('auth_marketplace_question')}
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
                  <p className="font-semibold text-primary-800 text-sm">{t('auth_yes_have_account')}</p>
                  <p className="text-xs text-primary-600 mt-0.5">{t('auth_convert_account_sub')}</p>
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
                  <p className="font-semibold text-gray-700 text-sm">{t('auth_no_create_new')}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t('auth_no_mkt_account_sub')}</p>
                </div>
                <i className="ti ti-arrow-right text-gray-300 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              </button>
            </div>
          </div>
          <p className="text-center text-sm text-gray-500 mt-5">
            {t('auth_have_account')}{' '}
            <Link href="/portal/login?type=tenant" className="text-primary-600 font-medium">{t('auth_login_button')}</Link>
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
              <button onClick={() => { setConvertError(''); setStep('marketplace_check') }} aria-label={t('common_back')}
                className="text-gray-400 text-lg min-h-[44px] min-w-[44px] flex items-center justify-center">←</button>
              <p className="text-sm font-semibold text-gray-800">{t('auth_yes_have_account')}</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 flex items-start gap-2">
                <i className="ti ti-info-circle mt-0.5 flex-shrink-0" aria-hidden="true" />
                <p>{t('auth_convert_instructions')}</p>
              </div>

              {convertError && (
                <div role="alert" className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
                  {convertError}
                </div>
              )}

              <FieldInput label={t('auth_email')} icon="mail">
                <input
                  type="email" required autoComplete="email" placeholder="jina@gmail.com"
                  value={convertEmail} onChange={e => setConvertEmail(e.target.value)}
                  className="input"
                />
              </FieldInput>

              <FieldInput label={t('auth_password')} icon="lock">
                <div className="relative">
                  <input
                    type={convertShowPass ? 'text' : 'password'} required autoComplete="current-password"
                    placeholder="••••••••" value={convertPassword} onChange={e => setConvertPassword(e.target.value)}
                    className="input pr-11"
                  />
                  <button type="button" onClick={() => setConvertShowPass(p => !p)}
                    aria-label={convertShowPass ? t('auth_hide_pass') : t('auth_show_pass')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <i className={`ti ti-${convertShowPass ? 'eye-off' : 'eye'}`} aria-hidden="true" />
                  </button>
                </div>
              </FieldInput>

              <FieldInput label={`${t('auth_phone')} ${t('common_optional')}`} icon="phone">
                <input
                  type="tel" autoComplete="tel" placeholder="+255 7XX XXX XXX"
                  value={convertPhone} onChange={e => setConvertPhone(e.target.value)}
                  className="input"
                />
                <p className="text-xs text-gray-400 mt-1">{t('auth_phone_help_text')}</p>
              </FieldInput>

              <button
                onClick={handleMarketplaceConvert}
                disabled={converting || !convertEmail.trim() || convertPassword.length < 6}
                className="w-full bg-primary-500 text-white py-3.5 min-h-[48px] rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-primary-600 transition active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {converting
                  ? <><i className="ti ti-loader-2 animate-spin" aria-hidden="true" />{t('common_loading')}</>
                  : <><i className="ti ti-key" aria-hidden="true" />{t('auth_convert_btn')}</>

                }
              </button>

              <div className="border-t border-gray-100 pt-3 text-center">
                <button
                  onClick={() => { setConvertError(''); setStep('details') }}
                  className="text-sm text-primary-600 font-medium hover:underline"
                >
                  {t('auth_no_create_new')} →
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
      <div className="h-[100dvh] bg-gray-50 flex flex-col overflow-hidden">
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
              <p className="text-sm text-gray-600">{t('auth_creating_account')}</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── AGREEMENT — portal roles (inline) ────────────────────────────────────
  if (step === 'agreement' && (role === 'org_owner' || role === 'tenant')) {
    const dest = role === 'org_owner' ? '/property/dashboard' : '/tenant'
    const roleLabel = t(role === 'org_owner' ? 'role_org_owner' : 'role_tenant')
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
              <button onClick={() => { setStep('details'); setError('') }} aria-label={t('common_back')}
                className="text-gray-400 text-lg min-h-[44px] min-w-[44px] flex items-center justify-center">←</button>
              <p className="text-sm font-semibold text-gray-800">{t('auth_terms_for')} {roleLabel}</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-2 leading-relaxed">
                <p>{t('auth_portal_terms_intro')}</p>
                <ul className="list-disc list-inside space-y-1 text-xs text-gray-500">
                  <li>{t('auth_portal_term_1')}</li>
                  <li>{t('auth_portal_term_2')}</li>
                  <li>{t('auth_portal_term_3')}</li>
                  <li>{t('auth_portal_term_4')}</li>
                </ul>
                {role === 'org_owner' && (
                  <p className="text-xs text-primary-700 font-medium mt-2 p-2 bg-primary-50 rounded-lg">
                    {t('auth_org_owner_responsibility')}
                  </p>
                )}
                {role === 'tenant' && (
                  <p className="text-xs text-amber-700 font-medium mt-2 p-2 bg-amber-50 rounded-lg">
                    {t('auth_tenant_after_signup')}
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
                  {t('auth_agree_terms')}
                </span>
              </label>

              <button onClick={handlePortalSignup} disabled={!agreed || loading}
                className="w-full bg-primary-500 text-white py-3.5 min-h-[48px] rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-primary-600 transition active:scale-[0.98]">
                {loading ? t('auth_creating_account') : `${t('auth_create_account_for')} ${roleLabel} →`}
              </button>
              <p className="text-xs text-gray-400 text-center">
                {t('auth_after_signup_redirect')}{' '}
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
            <h2 className="text-base font-bold text-gray-900 text-center mb-0.5">{t('auth_choose_role')}</h2>
            <p className="text-xs text-gray-400 text-center mb-5">{t('auth_choose_role_sub')}</p>

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
                {t('auth_dalali_info')}
              </div>
            )}
            {role === 'org_owner' && (
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 mb-4 text-xs text-purple-700">
                <i className="ti ti-info-circle mr-1" aria-hidden="true" />
                {t('auth_org_owner_info')}
              </div>
            )}
            {role === 'tenant' && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 text-xs text-amber-700">
                <i className="ti ti-info-circle mr-1" aria-hidden="true" />
                {t('auth_tenant_info')}
              </div>
            )}

            <button onClick={() => setStep(role === 'tenant' ? 'marketplace_check' : 'details')}
              className="w-full bg-primary-500 text-white py-3.5 min-h-[48px] rounded-xl text-sm font-semibold hover:bg-primary-600 transition active:scale-[0.98]">
              {t('common_next')} →
            </button>
          </div>
        )}

        {/* ── STEP 2: Details form ────────────────────────────────────────── */}
        {step === 'details' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-gray-50">
              <button onClick={() => { setStep('role'); setError('') }} aria-label={t('common_back')}
                className="text-gray-400 text-lg min-h-[44px] min-w-[44px] flex items-center justify-center">←</button>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">
                  {`${t('auth_create_account_for')} ${t(
                    role === 'client'    ? 'role_client'    :
                    role === 'dalali'    ? 'role_dalali'    :
                    role === 'org_owner' ? 'role_org_owner' : 'role_tenant'
                  )}`}
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
                <FieldInput label={t('auth_fullname')} icon="user">
                  <input type="text" required autoComplete="name" placeholder="Jina Bingwa"
                    value={fullName} onChange={e => setFullName(e.target.value)} className="input" />
                </FieldInput>

                <FieldInput label={t('auth_email')} icon="mail">
                  <input type="email" required autoComplete="email" placeholder="jina@gmail.com"
                    value={email} onChange={e => setEmail(e.target.value)} className="input" />
                </FieldInput>

                <FieldInput label={t('auth_password')} icon="lock">
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} required minLength={8} autoComplete="new-password"
                      placeholder="Angalau herufi 8" value={password} onChange={e => setPassword(e.target.value)}
                      className="input pr-11" />
                    <button type="button" onClick={() => setShowPass(p => !p)}
                      aria-label={showPass ? t('auth_hide_pass') : t('auth_show_pass')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center">
                      <i className={`ti ti-${showPass ? 'eye-off' : 'eye'}`} aria-hidden="true" />
                    </button>
                  </div>
                  <PasswordStrength value={password} />
                </FieldInput>

                {/* Dalali extra — WhatsApp */}
                {role === 'dalali' && (
                  <FieldInput label={`${t('auth_phone')} (WhatsApp) *`}>
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
                    <p className="text-xs text-gray-400 mt-1">{t('auth_whatsapp_info')}</p>
                  </FieldInput>
                )}

                {/* Org owner / tenant extra — phone */}
                {(role === 'org_owner' || role === 'tenant') && (
                  <FieldInput label={`${t('auth_phone')} *`} icon="phone">
                    <input type="tel" required autoComplete="tel" placeholder="+255 7XX XXX XXX"
                      value={phone} onChange={e => setPhone(e.target.value)} className="input" />
                  </FieldInput>
                )}

                {/* Org owner extras */}
                {role === 'org_owner' && (
                  <>
                    <div className="pt-1 border-t border-gray-50">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{t('auth_org_info_label')}</p>
                    </div>
                    <FieldInput label={t('auth_org_name_label')} icon="building-estate">
                      <input type="text" required placeholder="mfano: Mapumziko Apartments"
                        value={orgName} onChange={e => setOrgName(e.target.value)} className="input" />
                    </FieldInput>
                    <FieldInput label={t('auth_org_city_label')} icon="map-pin">
                      <input type="text" required placeholder="mfano: Dar es Salaam, Kinondoni"
                        value={city} onChange={e => setCity(e.target.value)} className="input" />
                    </FieldInput>
                  </>
                )}

                {/* Notice before agreement */}
                {(role === 'client' || role === 'dalali') && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                    <i className="ti ti-clipboard-list mr-1" aria-hidden="true" />
                    {t('auth_pre_agreement_notice')}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full bg-primary-500 text-white py-3.5 min-h-[48px] rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-primary-600 transition active:scale-[0.98]">
                  {loading ? t('common_loading') : `${t('common_next')} →`}
                </button>

                {/* Google sign-in hidden — email only for now */}
              </form>
            </div>
          </div>
        )}

        {/* Login link */}
        {(step === 'role' || step === 'details') && (
          <p className="text-center text-sm text-gray-500 mt-5">
            {t('auth_have_account')}{' '}
            <Link href="/login" className="text-primary-600 font-medium">{t('auth_login_button')}</Link>
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
