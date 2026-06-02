'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { subscribeToPush, isPushSupported, getPushPermission } from '@/lib/notifications/subscribe'

const STORAGE_KEY = 'nyumba_push_asked'

export default function PushSetup() {
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)

  useEffect(() => {
    // Register SW immediately, silently
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
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
            <div className="text-4xl mb-3">🎉</div>
            <p className="text-base font-bold text-gray-900">Asante! Utapokea arifa</p>
            <p className="text-sm text-gray-500 mt-1">Tutakuarifu mambo muhimu tu</p>
          </div>
        ) : (
          <>
            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔔</span>
            </div>

            <h3 className="text-lg font-bold text-gray-900 text-center mb-1">
              Pokea Arifa za NyumbaFasta
            </h3>
            <p className="text-sm text-gray-500 text-center mb-5">
              Tuambie utakuwa mbali — tutakuarifu mambo muhimu
            </p>

            {/* Benefits list */}
            <div className="space-y-3 mb-7">
              {[
                { icon: '🏠', text: 'Listing mpya eneo unalolipenda' },
                { icon: '📞', text: 'Mteja amefungua contact yako (dalali)' },
                { icon: '✅', text: 'Listing yako imeidhibitishwa na admin' },
                { icon: '🎉', text: 'Akaunti yako imethibitishwa (verified)' },
              ].map(b => (
                <div key={b.text} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-base">{b.icon}</span>
                  </div>
                  <p className="text-sm text-gray-700">{b.text}</p>
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
              {loading ? 'Inaomba ruhusa...' : '🔔 Ndiyo, Niarifu'}
            </button>
            <button
              onClick={handleDismiss}
              className="w-full py-3 rounded-2xl text-sm text-gray-400 font-medium"
            >
              Sasa hivi hapana
            </button>
          </>
        )}
      </div>
    </div>
  )
}
