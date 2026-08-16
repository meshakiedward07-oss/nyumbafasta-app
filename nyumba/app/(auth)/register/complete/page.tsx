'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/context'

function clearPendingStorage() {
  try { localStorage.removeItem('pending_register') } catch {}
  try { localStorage.removeItem('pending_agreement') } catch {}
  try { localStorage.removeItem('pending_referral_code') } catch {}
}

export default function RegisterCompletePage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [error, setError] = useState('')

  useEffect(() => {
    async function finish() {
      let pending: { full_name: string; role: string; whatsapp_number?: string } | null = null

      // Primary: read from localStorage (same device)
      try {
        const raw = localStorage.getItem('pending_register')
        if (raw) pending = JSON.parse(raw)
      } catch {
        clearPendingStorage()
      }

      // Fallback: read from user_metadata (cross-device — user verified on a different browser)
      if (!pending) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.replace('/register'); return }
        const meta = user.user_metadata ?? {}
        const full_name = (meta.full_name as string | undefined) ?? ''
        const role      = (meta.role      as string | undefined) ?? ''
        if (!full_name || !role || !['client', 'dalali'].includes(role)) {
          router.replace('/register'); return
        }
        pending = { full_name, role, whatsapp_number: meta.whatsapp_number as string | undefined }
      }

      const { full_name, role, whatsapp_number } = pending!

      // Safe parse of agreement — corrupted JSON must not lock the user out
      let agreement: unknown = null
      try {
        const agreementRaw = localStorage.getItem('pending_agreement')
        if (agreementRaw) agreement = JSON.parse(agreementRaw)
      } catch {
        // Clear the bad key but continue — the API accepts agreement:null
        try { localStorage.removeItem('pending_agreement') } catch {}
      }

      let referralCode: string | null = null
      try { referralCode = localStorage.getItem('pending_referral_code') } catch {}

      try {
        const res = await fetch('/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name, role, whatsapp_number, agreement, referral_code: referralCode || undefined }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || t('auth_err_create_account'))
        }

        clearPendingStorage()

        if (role === 'dalali') {
          router.replace('/dashboard?welcome=true')
        } else {
          router.replace('/?welcome=true')
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t('auth_mfa_generic_err'))
      }
    }

    finish()
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="text-4xl mb-4 flex justify-center">
          <i className="ti ti-alert-triangle text-amber-500" aria-hidden="true" />
        </div>
        <p className="text-gray-700 font-medium mb-2">{t('common_error')}</p>
        <p className="text-sm text-red-500 text-center mb-6">{error}</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => { setError(''); window.location.reload() }}
            className="bg-primary-500 text-white px-6 py-3 rounded-xl text-sm font-semibold"
          >
            {t('common_retry')}
          </button>
          <button
            onClick={() => {
              clearPendingStorage()
              router.replace('/register')
            }}
            className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl text-sm font-semibold"
          >
            {t('auth_back_to_register')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm text-gray-500">{t('auth_completing_reg')}</p>
    </div>
  )
}
