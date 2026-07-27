import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

export type RateLimitPlatform = 'whatsapp' | 'instagram' | 'facebook'

export interface RateLimitResult {
  allowed: boolean
  currentCount: number
}

/**
 * Check and record a message attempt for rate limiting.
 * Uses the nf_rate_limit_check RPC which atomically counts + inserts.
 * Default: 15 messages per 60 seconds per identifier.
 */
export async function checkRateLimit(
  identifier: string,
  platform: RateLimitPlatform,
  windowSec = 60,
  maxCount = 15,
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabaseAdmin
      .rpc('nf_rate_limit_check', {
        p_identifier: identifier,
        p_platform:   platform,
        p_window_sec: windowSec,
        p_max_count:  maxCount,
      })

    if (error || !data || data.length === 0) {
      // On DB error, allow through (fail open) to avoid blocking real users
      console.warn('[RateLimit] DB error — failing open:', error?.message)
      return { allowed: true, currentCount: 0 }
    }

    const row = data[0] as { allowed: boolean; current_count: string | number }
    return {
      allowed:      row.allowed,
      currentCount: Number(row.current_count),
    }
  } catch (err) {
    console.warn('[RateLimit] Exception — failing open:', err)
    return { allowed: true, currentCount: 0 }
  }
}
