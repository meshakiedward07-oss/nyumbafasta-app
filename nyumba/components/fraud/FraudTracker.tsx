'use client'
import { useEffect } from 'react'

const SESSION_KEY = 'nf_device_tracked'

async function buildFingerprint(): Promise<string> {
  const nav = navigator
  const parts = [
    nav.userAgent,
    nav.language,
    nav.platform,
    String(nav.hardwareConcurrency ?? ''),
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    nav.vendor ?? '',
  ].join('|')

  const encoded = new TextEncoder().encode(parts)
  const hashBuf = await crypto.subtle.digest('SHA-256', encoded)
  const hashArr = Array.from(new Uint8Array(hashBuf))
  return hashArr.map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function FraudTracker() {
  useEffect(() => {
    // Run only once per browser session
    if (sessionStorage.getItem(SESSION_KEY)) return
    sessionStorage.setItem(SESSION_KEY, '1')

    buildFingerprint().then(fingerprint => {
      fetch('/api/v1/fraud/device', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint,
          platform:   navigator.platform,
          screenSize: `${screen.width}x${screen.height}`,
          timezone:   Intl.DateTimeFormat().resolvedOptions().timeZone,
          language:   navigator.language,
        }),
      }).catch(() => null)
    }).catch(() => null)
  }, [])

  return null
}
