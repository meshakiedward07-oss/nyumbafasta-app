'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useLanguage } from '@/lib/i18n/context'

export default function AdvertiserPendingPage() {
  const router   = useRouter()
  const supabase = createClient()
  const { t }    = useLanguage()
  const [business, setBusiness] = useState('')
  const [email,    setEmail]    = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/advertising/login'); return }

      const res = await fetch('/api/v1/advertising/me').catch(() => null)
      if (!res) { setChecking(false); return }

      if (res.ok) {
        const d = await res.json() as { advertiser?: { status?: string; business_name?: string; email?: string } }
        const adv = d.advertiser
        if (!adv) { router.replace('/advertising/login'); return }

        if (adv.status === 'active') {
          router.replace('/advertising/dashboard'); return
        }
        if (adv.status === 'rejected') {
          router.replace('/advertising/login?rejected=1'); return
        }
        setBusiness(adv.business_name ?? '')
        setEmail(adv.email ?? user.email ?? '')
      } else {
        router.replace('/advertising/login')
        return
      }
      setChecking(false)
    }
    check()
  }, [supabase, router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/advertising/login')
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const steps = [
    { icon: 'check',        color: 'text-primary-500', bg: 'bg-primary-50', label: t('adv_pending_step_submitted'), done: true              },
    { icon: 'search',       color: 'text-amber-500',   bg: 'bg-amber-50',   label: t('adv_pending_step_reviewing'), done: true, active: true },
    { icon: 'shield-check', color: 'text-gray-400',    bg: 'bg-gray-50',    label: t('adv_pending_step_approved'),  done: false             },
    { icon: 'rocket',       color: 'text-gray-400',    bg: 'bg-gray-50',    label: t('adv_pending_step_advertise'), done: false             },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-gradient-to-r from-[#085041] to-primary-600 px-4 py-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <Image src="/transparent_logo_nyumbafasta.png" alt="NyumbaFasta" width={24} height={24} className="object-contain" />
          <span className="text-white font-bold text-sm">NyumbaFasta Ads</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center">

          {/* Icon */}
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <i className="ti ti-clock-hour-4 text-amber-500 text-4xl" aria-hidden="true" />
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('adv_pending_title')}</h1>
          <p className="text-sm text-gray-500 mb-1">
            {business
              ? <><strong>{business}</strong> — {t('adv_pending_your_account')}</>
              : t('adv_pending_your_account')
            } {t('adv_pending_under_review')}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            {t('adv_pending_notify_at')} <strong>{email}</strong> {t('adv_pending_within_hours')}
          </p>

          {/* Status steps */}
          <div className="text-left space-y-3 mb-7">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${step.bg}`}>
                  <i className={`ti ti-${step.icon} text-sm ${step.color}`} aria-hidden="true" />
                </div>
                <span className={`text-sm ${step.active ? 'font-semibold text-gray-800' : step.done ? 'text-gray-700' : 'text-gray-400'}`}>
                  {step.label}
                  {step.active && (
                    <span className="ml-2 inline-block w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                  )}
                </span>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 mb-6 text-left">
            <i className="ti ti-info-circle mr-1" aria-hidden="true" />
            {t('adv_pending_help')}
          </div>

          <button
            onClick={handleLogout}
            className="w-full border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
          >
            {t('adv_logout')}
          </button>
        </div>
      </div>
    </div>
  )
}
