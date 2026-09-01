'use client'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useLanguage } from '@/lib/i18n/context'

function MFAForm() {
  const supabase     = createClient()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { t }        = useLanguage()
  const redirectTo   = searchParams.get('redirect') || '/'

  const [code,      setCode]      = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [factorId,  setFactorId]  = useState('')
  const [checkingMFA, setCheckingMFA] = useState(true)

  useEffect(() => {
    async function init() {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error || !data?.totp?.length) {
        // No factors enrolled — go directly to destination
        router.replace(redirectTo)
        return
      }
      const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal.data?.currentLevel === 'aal2') {
        // Already at AAL2 — proceed
        router.replace(redirectTo)
        return
      }
      setFactorId(data.totp[0].id)
      setCheckingMFA(false)
    }
    init()
  }, [supabase, router, redirectTo])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId || code.length !== 6) return
    setLoading(true)
    setError('')
    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeErr || !challenge) throw new Error(challengeErr?.message ?? t('auth_mfa_challenge_err'))

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      })
      if (verifyErr) throw new Error(t('auth_mfa_invalid_code'))

      router.replace(redirectTo)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth_mfa_generic_err'))
    } finally {
      setLoading(false)
    }
  }

  if (checkingMFA) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm p-7">
        <div className="relative h-10 w-32 mx-auto mb-6">
          <Image src="/transparent_logo_nyumbafasta.png" alt="NyumbaFasta" fill className="object-contain" sizes="128px" />
        </div>

        <div className="w-14 h-14 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="ti ti-shield-lock text-primary-600 text-2xl" aria-hidden="true" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-1 text-center">{t('auth_mfa_title')}</h1>
        <p className="text-sm text-gray-500 mb-6 text-center">
          {t('auth_mfa_sub')}
        </p>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">{t('auth_mfa_code_label')}</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              autoFocus
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 transition"
          >
            {loading ? t('auth_mfa_verifying') : `${t('auth_mfa_verify_btn')} →`}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-5">
          {t('auth_mfa_lost_access')}{' '}
          <a href="mailto:support@nyumbafasta.co" className="text-primary-600 hover:underline">
            {t('auth_mfa_contact_support')}
          </a>
        </p>
      </div>
    </div>
  )
}

export default function MFAPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <MFAForm />
    </Suspense>
  )
}
