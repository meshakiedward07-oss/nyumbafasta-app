import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'

// ─── PATCH — update staff details or deactivate ───────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  let body: {
    name?: string
    staffTitle?: string
    staffActive?: boolean
    maxLeadsCapacity?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Safety: only allow patching staff profiles
  const { data: target } = await admin
    .from('users')
    .select('role, staff_active')
    .eq('id', params.id)
    .single()

  if (!target || target.role !== 'staff') {
    return NextResponse.json({ error: 'Staff mwanachama haupatikani' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined)             updates.full_name          = body.name
  if (body.staffTitle !== undefined)       updates.staff_title        = body.staffTitle
  if (body.staffActive !== undefined)      updates.staff_active       = body.staffActive
  if (body.maxLeadsCapacity !== undefined) updates.max_leads_capacity = body.maxLeadsCapacity

  const { data, error } = await admin
    .from('users')
    .update(updates)
    .eq('id', params.id)
    .select('id, full_name, email, phone, staff_title, staff_active, max_leads_capacity')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // When deactivating, unassign their open leads so they can be reassigned
  if (body.staffActive === false && target.staff_active === true) {
    await unassignStaffLeads(params.id)
  }

  return NextResponse.json({ success: true, staff: data })
}

// ─── DELETE — remove staff account ───────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const admin = createAdminClient()

  // Safety: only delete staff profiles
  const { data: target } = await admin
    .from('users')
    .select('role, full_name')
    .eq('id', params.id)
    .single()

  if (!target || target.role !== 'staff') {
    return NextResponse.json({ error: 'Staff mwanachama haupatikani' }, { status: 404 })
  }

  // Unassign open leads first
  await unassignStaffLeads(params.id)

  // Deleting auth user cascades to users row via FK ON DELETE CASCADE
  const { error: deleteError } = await admin.auth.admin.deleteUser(params.id)
  if (deleteError) {
    console.error('[Staff] Delete auth user failed:', deleteError.message)
    return NextResponse.json({ error: 'Imeshindwa kufuta akaunti' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function unassignStaffLeads(staffId: string): Promise<void> {
  const admin = createAdminClient()
  const { error, data } = await admin
    .from('agent_leads')
    .update({ assigned_to: null, assigned_at: null })
    .eq('assigned_to', staffId)
    .not('pipeline_stage', 'in', '("registered","lost")')
    .select('id')

  if (error) {
    console.error('[Staff] Unassign leads failed:', error.message)
  } else {
    console.log(`[Staff] Unassigned ${data?.length ?? 0} open leads from staff ${staffId}`)
  }
}
