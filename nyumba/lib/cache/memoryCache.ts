/**
 * In-memory LRU cache with TTL expiry.
 * Designed for serverless — each Vercel function instance has its own copy,
 * so this works best for short-lived, per-instance caching (ISR supplement).
 * Do NOT use for user-specific or write-sensitive data.
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
  lastUsed: number
  tags?: string[]
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>()
  private readonly maxSize: number
  private sweepTimer: ReturnType<typeof setInterval> | null = null

  constructor(maxSize = 500) {
    this.maxSize = maxSize
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    entry.lastUsed = Date.now()
    return entry.value
  }

  set<T>(key: string, value: T, ttlMs: number, tags?: string[]): void {
    if (this.store.size >= this.maxSize) this.evictLRU()
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs, lastUsed: Date.now(), tags })
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  /** Invalidate all keys that start with a given prefix */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key)
    }
  }

  /** Invalidate all keys that carry a given tag */
  invalidateByTag(tag: string): void {
    for (const [key, entry] of this.store.entries()) {
      if (entry.tags?.includes(tag)) this.store.delete(key)
    }
  }

  /** Remove expired entries to free memory */
  sweep(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) this.store.delete(key)
    }
  }

  private evictLRU(): void {
    let oldest: [string, number] | null = null
    for (const [key, entry] of this.store.entries()) {
      if (!oldest || entry.lastUsed < oldest[1]) oldest = [key, entry.lastUsed]
    }
    if (oldest) this.store.delete(oldest[0])
  }

  startSweep(intervalMs = 60_000): void {
    if (this.sweepTimer) return
    this.sweepTimer = setInterval(() => this.sweep(), intervalMs)
    if (typeof this.sweepTimer === 'object' && this.sweepTimer.unref) {
      this.sweepTimer.unref()
    }
  }

  get size() { return this.store.size }
}

// Singleton — shared across all requests in the same Vercel function instance
export const cache = new MemoryCache(500)
cache.startSweep(60_000)

/** Cache TTL constants (milliseconds) */
export const TTL = {
  LISTINGS_PAGE:   30_000,   // 30s  — active listings browse pages
  LISTING_DETAIL:  60_000,   // 60s  — individual listing detail
  STATS:          300_000,   // 5m   — dashboard/admin stats
  REGIONS:      3_600_000,   // 1h   — region/district lists (static-ish)
  FINANCE_STATS:  120_000,   // 2m   — per-user finance dashboard (private)
  DALALI_STATS:   300_000,   // 5m   — dalali profile analytics
  SOCIAL_STATS:  1_800_000,  // 30m  — social media stats
  ADMIN_STATS:    300_000,   // 5m   — admin overview stats
  EMAIL_MAP:      120_000,   // 2m   — auth user email map in admin panel
  NOTIFICATIONS:   15_000,   // 15s  — notification count badge
  SOCIAL_POSTS:   300_000,   // 5m   — social post list
  PRICING:      3_600_000,   // 1h   — pricing config (rarely changes)
} as const

/**
 * Convenience wrapper: return cached value or call `fn` and cache its result.
 * Returns null on error instead of throwing.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = cache.get<T>(key)
  if (hit !== null) return hit
  const value = await fn()
  cache.set(key, value, ttlMs)
  return value
}
