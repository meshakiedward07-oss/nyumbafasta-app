'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { useLanguage } from '@/lib/i18n/context'

function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/advertising/dashboard'
  const { t } = useLanguage()

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
      const res = await fetch('/api/v1/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          redirectTo: `${window.location.origin}/auth/callback?redirect=/account/change-password`,
        }),
      })
      if (!res.ok) { setError(t('adv_send_failed')) }
      else setForgotSent(true)
      setLoading(false)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(t('adv_invalid_credentials'))
      setLoading(false); return
    }
    let meData: { advertiser?: { status?: string } } = {}
    try {
      const res = await fetch('/api/v1/advertising/me')
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        await supabase.auth.signOut()
        setError(d.error ?? t('adv_no_advertiser'))
        setLoading(false); return
      }
      meData = await res.json()
    } catch {
      await supabase.auth.signOut()
      setError(t('adv_network_error'))
      setLoading(false); return
    }

    const status = meData.advertiser?.status
    if (status === 'pending_review') {
      window.location.href = '/advertising/pending'
      return
    }
    if (status === 'rejected' || status === 'suspended') {
      await supabase.auth.signOut()
      setError(
        status === 'rejected'
          ? t('adv_account_rejected')
          : t('adv_account_suspended')
      )
      setLoading(false); return
    }
    window.location.href = redirectTo
  }

  if (forgotSent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-sm p-7 text-center">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">{t('adv_check_email_title')}</h2>
          <p className="text-sm text-gray-500 mb-6">
            {t('adv_check_email_desc')} <strong>{email}</strong>.
          </p>
          <button
            onClick={() => { setForgotMode(false); setForgotSent(false) }}
            className="text-primary-600 font-medium text-sm hover:underline"
          >
            {t('adv_back_to_login')}
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
        <p className="text-xs text-primary-200">{t('adv_ads_platform')}</p>
      </div>

      <div className="flex-1 flex items-start justify-center pt-8 px-4 pb-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-sm p-6">

          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-800">
              {forgotMode ? t('adv_forgot_title') : t('adv_login_title')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {forgotMode ? t('adv_forgot_subtitle') : t('adv_login_subtitle')}
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('adv_email_label')}</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('adv_password_label')}</label>
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs min-w-[44px] min-h-[44px] flex items-center justify-center"
                  >
                    {showPw ? t('adv_hide') : t('adv_show')}
                  </button>
                </div>
                <div className="text-right mt-1.5">
                  <button
                    type="button"
                    onClick={() => { setForgotMode(true); setError('') }}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    {t('adv_forgot_link')}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full bg-primary-500 text-white py-3 rounded-xl text-sm font-bold hover:bg-primary-600 transition disabled:opacity-50 mt-1"
            >
              {loading
                ? (forgotMode ? t('adv_sending_link') : t('adv_logging_in'))
                : (forgotMode ? t('adv_send_link') : t('adv_login_btn'))
              }
            </button>
          </form>

          {forgotMode ? (
            <p className="text-center text-sm text-gray-500 mt-4">
              <button
                onClick={() => { setForgotMode(false); setError('') }}
                className="text-primary-600 font-medium hover:underline"
              >
                {t('adv_back_to_login')}
              </button>
            </p>
          ) : (
            <p className="text-center text-sm text-gray-500 mt-5">
              {t('adv_no_account')}{' '}
              <Link href="/advertising/register" className="text-primary-600 font-semibold hover:underline">
                {t('adv_create_account')}
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
