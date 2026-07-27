/**
 * Shared API-route guards: rate limiting, timeout, and safe-JSON helpers.
 * Import these at the top of route files to add resilience with minimal boilerplate.
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/security/rateLimit'

// ── Rate limiting presets ────────────────────────────────────────────────────

/** General authenticated route: 120 req/min per user+IP */
export async function guardUserRateLimit(
  req: NextRequest,
  userId: string,
  limit = 120,
  windowMs = 60_000,
): Promise<NextResponse | null> {
  const key = `user:${userId}:${getClientIp(req)}:${new URL(req.url).pathname}`
  const rl  = await rateLimit(key, limit, windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Maombi mengi sana. Subiri kidogo.' }, {
      status:  429,
      headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) },
    })
  }
  return null
}

/** Admin/staff route: 60 req/min per user */
export async function guardAdminRateLimit(
  req: NextRequest,
  userId: string,
  limit = 60,
  windowMs = 60_000,
): Promise<NextResponse | null> {
  const key = `admin:${userId}:${new URL(req.url).pathname}`
  const rl  = await rateLimit(key, limit, windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Maombi mengi sana. Subiri kidogo.' }, {
      status:  429,
      headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) },
    })
  }
  return null
}

/** Public/unauthenticated route: 30 req/min per IP */
export async function guardPublicRateLimit(
  req: NextRequest,
  limit = 30,
  windowMs = 60_000,
): Promise<NextResponse | null> {
  const key = `pub:${getClientIp(req)}:${new URL(req.url).pathname}`
  const rl  = await rateLimit(key, limit, windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Maombi mengi sana. Subiri kidogo.' }, {
      status:  429,
      headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) },
    })
  }
  return null
}

// ── Safe JSON body parser ────────────────────────────────────────────────────

/** Parses request JSON without throwing — returns null on bad payload */
export async function safeJson<T = Record<string, unknown>>(
  req: NextRequest,
): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}

// ── Request timeout ──────────────────────────────────────────────────────────

/**
 * Wraps a promise with a timeout. If the operation takes longer than
 * `ms` milliseconds, rejects with a timeout error. Use around DB queries
 * on hot paths to prevent serverless functions from hanging at their limit.
 *
 * Example:
 *   const result = await withTimeout(
 *     admin.from('listings').select('*').limit(100),
 *     5000,
 *   )
 */
export function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
    promise.then(
      v  => { clearTimeout(timer); resolve(v) },
      e  => { clearTimeout(timer); reject(e) },
    )
  })
}
