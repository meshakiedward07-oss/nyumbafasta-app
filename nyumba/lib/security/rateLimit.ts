// In-memory rate limiter — works per serverless instance.
// Sufficient as a "last line of defense" alongside Vercel's edge DDoS protection.
// For production at scale, swap the Map for Upstash Redis (shared across instances).

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Opportunistic cleanup so the Map doesn't grow unbounded on long-lived instances.
let lastSweep = Date.now()
function sweep(now: number) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}

export function rateLimit(
  key: string, // e.g. IP + endpoint
  limit: number, // max requests
  windowMs: number // time window in ms
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  sweep(now)
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetIn: windowMs }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count, resetIn: entry.resetAt - now }
}

// Helper to get the client IP from a Next.js request (behind Vercel/proxy).
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown'
  return req.headers.get('x-real-ip')?.trim() ?? 'unknown'
}
