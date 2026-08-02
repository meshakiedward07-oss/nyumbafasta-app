import { NextResponse } from 'next/server'
import { requireStaffAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/admin/badges
// Returns pending counts for WhatsApp sessions, social sessions, and unread conversations
// in one round-trip so the sidebar can replace 3 independent polls with 1.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireStaffAuth()
    if (!auth.ok) return auth.response

    const admin = createAdminClient()

    const [pendingRes, socialRes, convRes] = await Promise.all([
      admin
        .from('whatsapp_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      admin
        .from('social_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      admin.rpc('nf_get_conversations', {
        p_user_id:     auth.userId,
        p_org_id:      null,
        p_type:        null,
        p_limit:       50,
        p_source_role: null,
      }),
    ])

    const pending  = pendingRes.count ?? 0
    const social   = socialRes.count ?? 0
    const messages = (convRes.data ?? []).reduce(
      (s: number, c: { unread_count: number }) => s + (c.unread_count ?? 0),
      0,
    )

    return NextResponse.json(
      { pending, social, messages },
      { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=10' } },
    )
  } catch (err) {
    console.error('[GET /api/v1/admin/badges]', err)
    // Return zeros on error — badge counts are non-critical
    return NextResponse.json({ pending: 0, social: 0, messages: 0 })
  }
}
