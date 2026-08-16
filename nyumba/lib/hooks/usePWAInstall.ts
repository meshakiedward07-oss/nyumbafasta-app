// Singleton PWA install deferred prompt manager.
// Module-level state so ForceInstallGate and InstallPrompt share the same event —
// only one call to e.preventDefault() needed, and prompt() can only be called once.

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Listener = () => void

let _deferred: BeforeInstallPromptEvent | null = null
const _listeners = new Set<Listener>()

function notifyAll() {
  _listeners.forEach(fn => fn())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    _deferred = e as BeforeInstallPromptEvent
    notifyAll()
  })

  window.addEventListener('appinstalled', () => {
    _deferred = null
    notifyAll()
  })
}

export function getDeferred() { return _deferred }

export function subscribeDeferred(fn: Listener): () => void {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

export async function triggerInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!_deferred) return 'unavailable'
  const d = _deferred
  _deferred = null
  notifyAll()
  try {
    await d.prompt()
    const { outcome } = await d.userChoice
    return outcome
  } catch {
    return 'dismissed'
  }
}

export function isAlreadyInstalled(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
}
