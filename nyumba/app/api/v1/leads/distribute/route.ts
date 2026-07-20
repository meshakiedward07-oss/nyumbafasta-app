import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminUser } from '@/lib/security/adminAuth'
import { cache } from '@/lib/cache/memoryCache'

export const dynamic = 'force-dynamic'

// POST — bulk assign leads to a staff member
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Admin tu anaweza kugawa leads' }, { status: 403 })

  try {
    const body = await req.json() as { staffId: string; leadIds: string[] }
    const { staffId, leadIds } = body

    if (!staffId) return NextResponse.json({ error: 'staffId inahitajika' }, { status: 400 })
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: 'Chagua angalau lead moja' }, { status: 400 })
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

    const { error, count } = await supabaseAdmin
      .from('leads')
      .update({ assigned_to: staffId, updated_at: new Date().toISOString() })
      .in('id', leadIds.slice(0, 500))

    if (error) throw error
    cache.delete('leads:stats:global')

    return NextResponse.json({
      success: true,
      distributed: count ?? leadIds.length,
      staffName: staffUser.full_name,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
