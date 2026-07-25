// Rate limiter with Upstash Redis REST API support.
// Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in Vercel env vars
// to enable a shared, cross-instance rate limiter (required for serverless).
// Falls back to in-memory Map (per-instance only) when env vars are absent.
//
// Redis implementation uses a single atomic pipeline (INCR + EXPIRE in one
// HTTP round-trip) so the TTL is always set even if the function crashes.
// Implements a fixed window; for sliding-window accuracy at high load, use
// @upstash/ratelimit with Lua scripts instead.

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

// ── Upstash Redis REST API — atomic pipeline ──────────────────────────────────
// Sends INCR + EXPIRE + TTL as a single pipeline request (one HTTP round-trip).
// This is atomic from the client's perspective: the key always gets its TTL
// set even if the function is killed after the pipeline call returns.
async function redisRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const base     = process.env.UPSTASH_REDIS_REST_URL!
  const token    = process.env.UPSTASH_REDIS_REST_TOKEN!
  const redisKey = `rl:${key}`
  const windowSec = Math.ceil(windowMs / 1000)

  // Pipeline: [INCR key, EXPIRE key windowSec NX, TTL key]
  // NX on EXPIRE means "only set TTL if key has no expiry" — preserves the
  // original window start rather than resetting it on every hit.
  const pipelineBody = JSON.stringify([
    ['INCR', redisKey],
    ['EXPIRE', redisKey, windowSec, 'NX'],
    ['TTL', redisKey],
  ])

  const res = await fetch(`${base}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: pipelineBody,
  })

  if (!res.ok) throw new Error(`Upstash pipeline failed: ${res.status}`)

  const results = await res.json() as Array<{ result: number }>
  const count  = results[0]?.result ?? 1
  const ttlSec = results[2]?.result ?? windowSec
  const resetIn = ttlSec > 0 ? ttlSec * 1000 : windowMs

  if (count > limit) {
    return { allowed: false, remaining: 0, resetIn }
  }
  return { allowed: true, remaining: Math.max(0, limit - count), resetIn }
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function rateLimit(
  key: string,     // e.g. IP + endpoint
  limit: number,   // max requests per window
  windowMs: number, // time window in ms
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await redisRateLimit(key, limit, windowMs)
    } catch {
      // Redis unavailable — fall through to in-memory (logged silently)
    }
  }
  return localRateLimit(key, limit, windowMs)
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown'
  return req.headers.get('x-real-ip')?.trim() ?? 'unknown'
}
