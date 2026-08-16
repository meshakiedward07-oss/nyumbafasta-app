'use client'
/**
 * Blocking install gate shown after signup for dalali, staff, and client (tenant) users.
 * Triggered by 'nyumba_install_gate' in localStorage (set by register/complete).
 *
 * - Android Chrome: shows native "Add to Home Screen" prompt
 * - iOS Safari: shows step-by-step manual instructions
 * - Other browsers: shows generic instructions
 *
 * "Endelea bila app" is rendered with extreme visual suppression so it exists
 * for accessibility but is strongly de-emphasised.
 */
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  getDeferred,
  subscribeDeferred,
  triggerInstall,
  isAlreadyInstalled,
  isIOS,
} from '@/lib/hooks/usePWAInstall'

const GATE_KEY     = 'nyumba_install_gate'
const DISMISS_KEY  = 'nyumba_install_dismissed'

// iOS Share icon — inline SVG since we can't use external icons in this file safely
function IOSShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
      <polyline points="16 6 12 2 8 6"/>
      <line x1="12" y1="2" x2="12" y2="15"/>
    </svg>
  )
}

export default function ForceInstallGate() {
  const [visible, setVisible]   = useState(false)
  const [platform, setPlatform] = useState<'android' | 'ios' | 'other'>('other')
  const [hasPrompt, setHasPrompt] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [iosStep, setIosStep]   = useState(0)  // 0 = instructions, 1 = "added?"
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true

    // Only show if: gate flag set, not already installed as PWA, not already dismissed
    if (!localStorage.getItem(GATE_KEY)) return
    if (isAlreadyInstalled()) { clearGate(); return }

    // Detect platform
    if (isIOS()) {
      setPlatform('ios')
    } else if (typeof window !== 'undefined' && /android/i.test(navigator.userAgent)) {
      setPlatform('android')
    } else {
      setPlatform('other')
    }

    setHasPrompt(!!getDeferred())
    const unsub = subscribeDeferred(() => {
      if (mountedRef.current) setHasPrompt(!!getDeferred())
    })

    setVisible(true)
    return () => { mountedRef.current = false; unsub() }
  }, [])

  function clearGate() {
    try { localStorage.removeItem(GATE_KEY) } catch {}
  }

  function bypass() {
    clearGate()
    // Mark dismissed so the gate doesn't re-appear on subsequent logins on this device
    try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
    setVisible(false)
  }

  async function handleInstall() {
    if (platform === 'ios') {
      // No browser API — walk through manual steps
      setIosStep(1)
      return
    }

    setLoading(true)
    const outcome = await triggerInstall()
    setLoading(false)

    if (outcome === 'accepted') {
      localStorage.setItem(DISMISS_KEY, '1')
      clearGate()
      setVisible(false)
    }
    // If dismissed, stay on gate — user must explicitly click "Endelea bila app"
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[999] flex flex-col" style={{ background: '#0a1a14' }}>
      {/* Gradient backdrop */}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, #1D9E75 0%, #0a1a14 65%)',
        }}
        aria-hidden="true"
      />

      <div className="relative flex-1 flex flex-col items-center justify-between px-6 pt-16 pb-10 max-w-md mx-auto w-full">

        {/* App icon + identity */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-5">
            <Image
              src="/icon-192.png"
              alt="NyumbaFasta"
              width={96}
              height={96}
              className="rounded-[22px] shadow-2xl"
              priority
            />
            {/* Glow ring */}
            <div
              className="absolute -inset-2 rounded-[28px] opacity-30 blur-md"
              style={{ background: '#1D9E75' }}
              aria-hidden="true"
            />
          </div>

          <h1 className="text-2xl font-extrabold text-white mb-2 leading-tight">
            Sakinisha App<br />Kuendelea
          </h1>
          <p className="text-sm text-white/70 leading-relaxed max-w-xs">
            NyumbaFasta app inakupa uzoefu bora zaidi, kasi zaidi,
            na unaweza kuitumia hata bila mtandao.
          </p>
        </div>

        {/* Benefits */}
        <div className="w-full space-y-3 my-8">
          {[
            { icon: 'bolt',        label: 'Kasi mara 3 zaidi ya browser' },
            { icon: 'wifi-off',    label: 'Inafanya kazi bila mtandao' },
            { icon: 'bell-ringing', label: 'Arifa za muda halisi' },
            { icon: 'lock',        label: 'Salama na imara' },
          ].map(b => (
            <div key={b.icon} className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(29,158,117,0.25)' }}
              >
                <i className={`ti ti-${b.icon} text-base`} style={{ color: '#4ECCA0' }} aria-hidden="true" />
              </div>
              <span className="text-sm text-white/85 font-medium">{b.label}</span>
            </div>
          ))}
        </div>

        {/* ── Android / Desktop — native prompt ── */}
        {platform !== 'ios' && iosStep === 0 && (
          <div className="w-full space-y-3">
            <button
              onClick={handleInstall}
              disabled={loading}
              className="w-full py-4 rounded-2xl font-extrabold text-base text-white
                         active:scale-[0.97] transition-all disabled:opacity-60
                         shadow-lg shadow-primary-900/50"
              style={{ background: '#1D9E75' }}
            >
              {loading
                ? 'Inasakinisha…'
                : hasPrompt
                  ? '📲  Sakinisha Sasa'
                  : '📲  Jinsi ya Kusakinisha'}
            </button>

            {/* Faded bypass — visible but strongly de-emphasised */}
            <button
              onClick={bypass}
              className="w-full py-2 text-xs font-medium text-center"
              style={{ color: 'rgba(255,255,255,0.20)' }}
              aria-label="Endelea bila kusakinisha app"
            >
              endelea bila app
            </button>
          </div>
        )}

        {/* ── iOS — manual steps ── */}
        {platform === 'ios' && iosStep === 0 && (
          <div className="w-full">
            {/* Step cards */}
            <div className="space-y-2.5 mb-5">
              {[
                {
                  step: '1',
                  label: 'Bonyeza kitufe cha Share',
                  sub: 'Kitufe kipo chini ya skrini yako ya Safari',
                  badge: <IOSShareIcon />,
                },
                {
                  step: '2',
                  label: 'Chagua "Add to Home Screen"',
                  sub: 'Tafuta chini ya orodha ya chaguo',
                  badge: <span className="text-lg">＋</span>,
                },
                {
                  step: '3',
                  label: 'Bonyeza "Add" upande wa juu kulia',
                  sub: 'App itaonekana kwenye skrini yako ya nyumbani',
                  badge: <span className="text-xs font-bold text-[#1D9E75]">Add</span>,
                },
              ].map(s => (
                <div
                  key={s.step}
                  className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: 'rgba(255,255,255,0.07)' }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
                    style={{ background: '#1D9E75' }}
                  >
                    {s.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white leading-snug">{s.label}</p>
                    <p className="text-xs text-white/55 mt-0.5">{s.sub}</p>
                  </div>
                  <div className="text-white/60 flex-shrink-0">{s.badge}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setIosStep(1)}
              className="w-full py-4 rounded-2xl font-extrabold text-base text-white
                         active:scale-[0.97] transition-all shadow-lg"
              style={{ background: '#1D9E75' }}
            >
              Nimefanya Hivyo ✓
            </button>

            <button
              onClick={bypass}
              className="w-full py-2 text-xs font-medium text-center mt-2"
              style={{ color: 'rgba(255,255,255,0.20)' }}
              aria-label="Endelea bila kusakinisha app"
            >
              endelea bila app
            </button>
          </div>
        )}

        {/* ── iOS — step 1 done confirmation ── */}
        {iosStep === 1 && (
          <div className="w-full text-center">
            <p className="text-white/80 text-sm mb-5">
              Je, umeona icon ya NyumbaFasta kwenye skrini yako ya nyumbani?
            </p>
            <button
              onClick={() => {
                clearGate()
                try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
                setVisible(false)
              }}
              className="w-full py-4 rounded-2xl font-extrabold text-base text-white mb-3
                         active:scale-[0.97] transition-all"
              style={{ background: '#1D9E75' }}
            >
              Ndiyo, Nimesakinisha! ✓
            </button>
            <button
              onClick={() => setIosStep(0)}
              className="w-full py-3 rounded-2xl text-sm text-white/50"
            >
              ← Rudi kwenye maelekezo
            </button>
            <button
              onClick={bypass}
              className="w-full py-2 text-xs font-medium text-center mt-1"
              style={{ color: 'rgba(255,255,255,0.20)' }}
            >
              endelea bila app
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
