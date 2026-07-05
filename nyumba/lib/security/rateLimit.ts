// Rate limiter with Upstash Redis REST API support.
// Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in Vercel env vars
// to enable a shared, cross-instance rate limiter (required for serverless).
// Falls back to in-memory Map (per-instance only) when env vars are absent.

interface RateLimitEntry {
  count: number
  resetAt: number
}

// ── In-memory fallback ────────────────────────────────────────────────────────
const store = new Map<string, RateLimitEntry>()

let lastSweep = Date.now()
function sweep(now: number) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}

function localRateLimit(
  key: string,
  limit: number,
  windowMs: number,
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

// ── Upstash Redis REST API ────────────────────────────────────────────────────
// Uses INCR + EXPIRE over HTTPS — no SDK needed, works in Edge + Node runtimes.
async function redisRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const base  = process.env.UPSTASH_REDIS_REST_URL!
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!
  const redisKey = `rl:${key}`
  const windowSec = Math.ceil(windowMs / 1000)

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // INCR key
  const incrRes = await fetch(`${base}/incr/${redisKey}`, { method: 'POST', headers })
  const { result: count } = await incrRes.json() as { result: number }

  // Set TTL only on first increment so the window doesn't reset on each hit
  if (count === 1) {
    await fetch(`${base}/expire/${redisKey}/${windowSec}`, { method: 'POST', headers })
  }

  if (count > limit) {
    return { allowed: false, remaining: 0, resetIn: windowMs }
  }
  return { allowed: true, remaining: limit - count, resetIn: windowMs }
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function rateLimit(
  key: string,    // e.g. IP + endpoint
  limit: number,  // max requests
  windowMs: number, // time window in ms
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await redisRateLimit(key, limit, windowMs)
    } catch {
      // Redis unavailable — fall through to in-memory
    }
  }
  return localRateLimit(key, limit, windowMs)
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown'
  return req.headers.get('x-real-ip')?.trim() ?? 'unknown'
}
