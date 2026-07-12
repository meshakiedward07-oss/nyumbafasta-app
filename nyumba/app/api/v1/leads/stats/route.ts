import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminAuth } from '@/lib/security/adminAuth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  try {
    const [total, high, medium, low, dead, duplicates, hasWa, hasFb, hasIg, hasTt, hasSocial] =
      await Promise.all([
        supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).eq('contact_quality', 'high').eq('is_duplicate', false),
        supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).eq('contact_quality', 'medium').eq('is_duplicate', false),
        supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).eq('contact_quality', 'low').eq('is_duplicate', false),
        supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).eq('is_dead_lead', true),
        supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).eq('is_duplicate', true),
        supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).not('whatsapp_number', 'is', null).eq('is_duplicate', false),
        supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).not('facebook_url', 'is', null).eq('is_duplicate', false),
        supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).not('instagram_url', 'is', null).eq('is_duplicate', false),
        supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).not('tiktok_url', 'is', null).eq('is_duplicate', false),
        supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).eq('has_any_social', true).eq('is_duplicate', false),
      ])

    return NextResponse.json({
      total:        total.count      ?? 0,
      high:         high.count       ?? 0,
      medium:       medium.count     ?? 0,
      low:          low.count        ?? 0,
      dead:         dead.count       ?? 0,
      duplicates:   duplicates.count ?? 0,
      has_whatsapp: hasWa.count      ?? 0,
      has_facebook: hasFb.count      ?? 0,
      has_instagram: hasIg.count     ?? 0,
      has_tiktok:   hasTt.count      ?? 0,
      has_any_social: hasSocial.count ?? 0,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
