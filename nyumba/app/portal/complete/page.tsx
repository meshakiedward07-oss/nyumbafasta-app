'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useLanguage } from '@/lib/i18n/context'

export default function PortalCompletePage() {
  const { t }    = useLanguage()
  const supabase = createClient()
  const router   = useRouter()
  const [status,  setStatus]  = useState<'loading' | 'error'>('loading')
  const [msg,     setMsg]     = useState('')
  const [attempt, setAttempt] = useState(0)

  const complete = useCallback(async () => {
    setStatus('loading')
    setMsg('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/portal'); return }

      const res = await fetch('/api/v1/portal/register', { method: 'POST' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setMsg((d as { error?: string }).error ?? t('portal_error_default'))
        setStatus('error'); return
      }
      const d = await res.json() as { portal_type?: string }

      const dest = d.portal_type === 'org_owner' ? '/property/dashboard'
                 : d.portal_type === 'tenant'    ? '/tenant'
                 : '/'
      router.replace(dest)
    } catch {
      setMsg(t('portal_network_error'))
      setStatus('error')
    }
  }, [supabase, router])

  useEffect(() => { complete() }, [attempt, complete])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-sm w-full text-center">
        <div className="relative h-12 w-36 mx-auto mb-6">
          <Image src="/transparent_logo_nyumbafasta.png" alt="NyumbaFasta" fill className="object-contain" sizes="144px" />
        </div>

        {status === 'loading' ? (
          <>
            <div className="w-14 h-14 border-[3px] border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="font-bold text-gray-900 text-lg mb-1">{t('portal_completing_reg')}</h2>
            <p className="text-sm text-gray-500">{t('portal_wait_moment')}</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ti ti-alert-circle text-red-500 text-3xl" aria-hidden="true" />
            </div>
            <h2 className="font-bold text-gray-900 text-lg mb-2">{t('portal_failed_title')}</h2>
            <p className="text-sm text-gray-500 mb-5">{msg}</p>
            <button
              onClick={() => setAttempt(n => n + 1)}
              className="w-full bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-600 transition">
              {t('common_retry')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
