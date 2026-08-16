'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { subscribeToPush, isPushSupported, getPushPermission } from '@/lib/notifications/subscribe'
import { useLanguage } from '@/lib/i18n/context'

const STORAGE_KEY = 'nyumba_push_asked'

export default function PushSetup() {
  const { t } = useLanguage()
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)

  useEffect(() => {
    // Register SW immediately, silently
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {})
    }

    if (!isPushSupported()) return
    if (getPushPermission() === 'granted') return   // already subscribed
    if (getPushPermission() === 'denied') return    // user blocked it
    if (localStorage.getItem(STORAGE_KEY)) return  // already asked

    // Show modal only for logged-in users (after small delay for UX)
    const supabase = createClient()
    const timer = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setShowModal(true)
    }, 2500)

    return () => clearTimeout(timer)
  }, [])

  async function handleAllow() {
    setLoading(true)
    const granted = await subscribeToPush()
    setLoading(false)
    localStorage.setItem(STORAGE_KEY, '1')
    setDone(true)
    setTimeout(() => setShowModal(false), granted ? 1500 : 500)
  }

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setShowModal(false)
  }

  if (!showModal) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={handleDismiss}>
      <div
        className="bg-white w-full rounded-t-3xl px-6 pt-6 pb-10 shadow-xl max-w-lg mx-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />

        {done ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3 flex justify-center"><i className="ti ti-confetti text-primary-500" aria-hidden="true" /></div>
            <p className="text-base font-bold text-gray-900">{t('common_push_done_title')}</p>
            <p className="text-sm text-gray-500 mt-1">{t('common_push_done_sub')}</p>
          </div>
        ) : (
          <>
            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
              <i className="ti ti-bell text-3xl" aria-hidden="true" />
            </div>

            <h3 className="text-lg font-bold text-gray-900 text-center mb-1">
              {t('common_push_title')}
            </h3>
            <p className="text-sm text-gray-500 text-center mb-5">
              {t('common_push_sub')}
            </p>

            {/* Benefits list */}
            <div className="space-y-3 mb-7">
              {([
                { icon: 'home',         key: 'common_push_ben1' },
                { icon: 'phone',        key: 'common_push_ben2' },
                { icon: 'circle-check', key: 'common_push_ben3' },
                { icon: 'confetti',     key: 'common_push_ben4' },
              ] as { icon: string; key: import('@/lib/i18n/translations').TKey }[]).map(b => (
                <div key={b.key} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <i className={`ti ti-${b.icon} text-base text-primary-600`} aria-hidden="true" />
                  </div>
                  <p className="text-sm text-gray-700">{t(b.key)}</p>
                </div>
              ))}
            </div>

            {/* Buttons */}
            <button
              onClick={handleAllow}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-primary-500 text-white font-bold text-sm
                         disabled:opacity-60 active:scale-[0.97] transition-transform mb-3"
            >
              {loading ? t('common_push_requesting') : t('common_push_allow')}
            </button>
            <button
              onClick={handleDismiss}
              className="w-full py-3 rounded-2xl text-sm text-gray-400 font-medium"
            >
              {t('common_push_decline')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
