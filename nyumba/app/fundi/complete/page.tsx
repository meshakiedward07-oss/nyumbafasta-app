'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/context'

export default function FundiCompletePage() {
  const router = useRouter()
  const { t }  = useLanguage()
  const [error, setError] = useState('')

  useEffect(() => {
    async function finish() {
      let pending: { full_name: string; phone: string } | null = null

      // Primary: localStorage (same device)
      try {
        const raw = localStorage.getItem('pending_fundi_register')
        if (raw) pending = JSON.parse(raw)
      } catch { /* storage unavailable */ }

      // Fallback: user_metadata (cross-device verification)
      if (!pending) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const meta = user.user_metadata ?? {}
          pending = {
            full_name: (meta.full_name as string | undefined) ?? '',
            phone:     (meta.phone     as string | undefined) ?? '',
          }
        }
      }

      try {
        const res = await fetch('/api/v1/fundi/register', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ full_name: pending?.full_name ?? '', phone: pending?.phone ?? '' }),
        })
        if (!res.ok) {
          const d = await res.json()
          throw new Error(d.error || t('fp_complete_reg_error'))
        }
        try { localStorage.removeItem('pending_fundi_register') } catch { /* ignore */ }
        router.replace('/fundi/dashboard')
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t('common_error_occurred'))
      }
    }
    finish()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
        <i className="ti ti-alert-triangle text-5xl text-amber-400 mb-4" aria-hidden="true" />
        <p className="text-gray-700 font-medium mb-2">{t('common_error_occurred')}</p>
        <p className="text-sm text-red-500 mb-6">{error}</p>
        <a href="/fundi/login" className="text-primary-600 text-sm font-semibold hover:underline">
          {t('fp_complete_try_login')}
        </a>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
      <div className="w-14 h-14 rounded-full border-4 border-primary-300 border-t-primary-600 animate-spin mb-6" />
      <p className="text-gray-600 text-sm">{t('fp_complete_loading')}</p>
    </div>
  )
}
