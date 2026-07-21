import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminUser } from '@/lib/security/adminAuth'
import { cache } from '@/lib/cache/memoryCache'

export const dynamic = 'force-dynamic'

// POST — bulk assign leads to a staff member
// Accepts either { staffId, leadIds } for explicit selection
// or { staffId, count, quality?, status? } to auto-pick N unassigned leads
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Admin tu anaweza kugawa leads' }, { status: 403 })

  try {
    const body = await req.json() as {
      staffId:  string
      leadIds?: string[]
      count?:   number
      quality?: string
      status?:  string
    }
    const { staffId, leadIds, count, quality, status } = body

    if (!staffId) return NextResponse.json({ error: 'staffId inahitajika' }, { status: 400 })
    if (!Array.isArray(leadIds) && !count) {
      return NextResponse.json({ error: 'Taja idadi au chagua leads' }, { status: 400 })
    }

    // Verify staff exists and is active
    const { data: staffUser } = await supabaseAdmin
      .from('users')
      .select('id, full_name, role, staff_active')
      .eq('id', staffId)
      .single()

    if (!staffUser || !['admin', 'staff'].includes(staffUser.role)) {
      return NextResponse.json({ error: 'Mfanyakazi huyu hapatikani' }, { status: 404 })
    }
    if (staffUser.role === 'staff' && staffUser.staff_active === false) {
      return NextResponse.json({ error: 'Akaunti ya mfanyakazi imezimwa' }, { status: 403 })
    }

    let idsToAssign: string[]

    if (Array.isArray(leadIds) && leadIds.length > 0) {
      // Explicit selection
      idsToAssign = leadIds.slice(0, 500)
    } else {
      // Count-based: pick N unassigned leads
      const n = Math.min(Math.max(1, count ?? 0), 500)
      let q = supabaseAdmin
        .from('leads')
        .select('id')
        .is('assigned_to', null)
        .eq('is_dead_lead', false)
        .order('created_at', { ascending: false })
        .limit(n)

      if (quality) q = q.eq('contact_quality', quality)
      if (status)  q = q.eq('status', status)

      const { data: picked } = await q
      idsToAssign = (picked ?? []).map((r: { id: string }) => r.id)
      if (idsToAssign.length === 0) {
        return NextResponse.json({ error: 'Hakuna leads zisizo na mfanyakazi zinazolingana' }, { status: 404 })
      }
    }

    const { error, count: updated } = await supabaseAdmin
      .from('leads')
      .update({ assigned_to: staffId, updated_at: new Date().toISOString() })
      .in('id', idsToAssign)

    if (error) throw error
    cache.delete('leads:stats:global')

    return NextResponse.json({
      success: true,
      distributed: updated ?? idsToAssign.length,
      staffName: staffUser.full_name,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
