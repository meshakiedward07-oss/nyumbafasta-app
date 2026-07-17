// Client-side session ID for frequency capping.
// Stored in localStorage with a 24-hour TTL.
// No login required — anonymous users get a session too.

const KEY     = 'nf_ad_sid'
const KEY_EXP = 'nf_ad_sid_exp'
const TTL_MS  = 24 * 60 * 60 * 1000 // 24 hours

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'ssr'

  const existing = localStorage.getItem(KEY)
  const expiry   = Number(localStorage.getItem(KEY_EXP) ?? 0)

  if (existing && Date.now() < expiry) return existing

  // Create new session
  const id  = crypto.randomUUID()
  const exp = Date.now() + TTL_MS
  localStorage.setItem(KEY, id)
  localStorage.setItem(KEY_EXP, String(exp))
  return id
}
