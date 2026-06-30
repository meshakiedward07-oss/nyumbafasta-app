/**
 * Lightweight platform connection checks.
 * No sharp/watermark/autoPost dependency — safe to import from the connections route.
 */

import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

export type UnifiedPlatform = 'instagram' | 'facebook' | 'tiktok'

const META_TIMEOUT_MS = 4000

async function validateMetaToken(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(META_TIMEOUT_MS) })
    const json = await res.json() as { id?: string; error?: unknown }
    return !!json.id && !json.error
  } catch {
    return false
  }
}

export async function getConnectedPlatforms(): Promise<UnifiedPlatform[]> {
  const platforms: UnifiedPlatform[] = []

  // ── Instagram ──────────────────────────────────────────────────────────────
  const igUserId = process.env.INSTAGRAM_USER_ID
  const igToken  = process.env.INSTAGRAM_ACCESS_TOKEN
  if (igUserId && igToken) {
    const valid = await validateMetaToken(
      `https://graph.instagram.com/${igUserId}?fields=id&access_token=${igToken}`,
    )
    if (valid) platforms.push('instagram')
  }

  // ── Facebook ───────────────────────────────────────────────────────────────
  const fbPageId = process.env.FACEBOOK_PAGE_ID
  const fbToken  = process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? process.env.FACEBOOK_ACCESS_TOKEN
  if (fbPageId && fbToken) {
    const valid = await validateMetaToken(
      `https://graph.facebook.com/v21.0/${fbPageId}?fields=id&access_token=${fbToken}`,
    )
    if (valid) platforms.push('facebook')
  }

  // ── TikTok ─────────────────────────────────────────────────────────────────
  try {
    const { data: tt } = await supabaseAdmin
      .from('tiktok_connections')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    if (tt) platforms.push('tiktok')
  } catch {
    // table may not exist yet — treat as disconnected
  }

  return platforms
}
