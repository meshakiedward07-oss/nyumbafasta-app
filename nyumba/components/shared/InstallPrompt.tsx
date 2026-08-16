'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { getDeferred, subscribeDeferred, triggerInstall, isAlreadyInstalled } from '@/lib/hooks/usePWAInstall'

const STORAGE_KEY = 'nyumba_install_dismissed'

// Passive A2HS bottom-sheet for users who haven't been through the forced gate
// (i.e. not shown if ForceInstallGate already handled it)
export default function InstallPrompt() {
  const [show, setShow]       = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAlreadyInstalled()) return
    if (localStorage.getItem(STORAGE_KEY)) return
    // Don't show passive banner if the force gate is still pending
    if (localStorage.getItem('nyumba_install_gate')) return

    function sync() {
      if (getDeferred()) setTimeout(() => setShow(true), 3000)
    }
    sync()
    return subscribeDeferred(sync)
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setShow(false)
  }

  async function handleInstall() {
    setLoading(true)
    const outcome = await triggerInstall()
    setLoading(false)
    if (outcome === 'accepted') {
      localStorage.setItem(STORAGE_KEY, '1')
      setShow(false)
    }
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={dismiss}>
      <div
        className="bg-white w-full rounded-t-3xl px-6 pt-5 pb-10 shadow-xl max-w-lg mx-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />

        <div className="flex items-center gap-4 mb-4">
          <Image
            src="/icon-192.png"
            alt="NyumbaFasta"
            width={56}
            height={56}
            className="rounded-2xl shadow-sm flex-shrink-0"
          />
          <div>
            <h3 className="text-base font-bold text-gray-900 leading-snug">
              Sakinisha NyumbaFasta
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Ongeza kwenye skrini yako ya nyumbani
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-5 leading-relaxed">
          Pata NyumbaFasta kwa haraka zaidi — bila kutumia browser. Inafanya kazi hata bila mtandao.
        </p>

        <div className="space-y-2.5 mb-6">
          {[
            { icon: 'bolt',        text: 'Fungua haraka moja kwa moja kutoka skrini ya nyumbani' },
            { icon: 'wifi-off',    text: 'Inafanya kazi bila mtandao (baadhi ya maudhui)' },
            { icon: 'bell',        text: 'Pokea arifa muhimu mara zinapopatikana' },
          ].map(item => (
            <div key={item.icon} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                <i className={`ti ti-${item.icon} text-sm text-primary-600`} aria-hidden="true" />
              </div>
              <p className="text-sm text-gray-700">{item.text}</p>
            </div>
          ))}
        </div>

        <button
          onClick={handleInstall}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-primary-500 text-white font-bold text-sm
                     disabled:opacity-60 active:scale-[0.97] transition-transform mb-3"
        >
          {loading ? 'Inasakinisha...' : 'Sakinisha App'}
        </button>
        <button
          onClick={dismiss}
          className="w-full py-3 rounded-2xl text-sm text-gray-400 font-medium"
        >
          Baadaye
        </button>
      </div>
    </div>
  )
}
