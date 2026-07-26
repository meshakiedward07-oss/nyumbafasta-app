import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/admin/workload
// Returns each staff member merged with their property workload + leads stats + service request assignments
export async function GET() {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const admin = createAdminClient()

    const [staffRes, workloadRes, serviceReqRes] = await Promise.all([
      admin
        .from('users')
        .select('id, full_name, phone, staff_title, staff_active, max_leads_capacity, created_at')
        .eq('role', 'staff')
        .order('full_name', { ascending: true }),
      admin
        .from('staff_workload')
        .select('staff_id, active_managed_properties, max_capacity, updated_at'),
      admin
        .from('service_requests')
        .select('id, assigned_to, request_type, status')
        .not('assigned_to', 'is', null)
        .in('status', ['assigned', 'in_progress']),
    ])

    const staff      = staffRes.data      ?? []
    const workloads  = workloadRes.data   ?? []
    const serviceReqs = serviceReqRes.data ?? []

    // Build lookup maps
    const workloadMap: Record<string, { active_managed_properties: number; max_capacity: number }> = {}
    for (const w of workloads) workloadMap[w.staff_id] = { active_managed_properties: w.active_managed_properties, max_capacity: w.max_capacity }

    const assignedMap: Record<string, { total: number; kyc: number; listing: number; management: number }> = {}
    for (const r of serviceReqs) {
      const id = r.assigned_to as string
      if (!assignedMap[id]) assignedMap[id] = { total: 0, kyc: 0, listing: 0, management: 0 }
      assignedMap[id].total++
      if (r.request_type === 'kyc_only')                assignedMap[id].kyc++
      else if (r.request_type === 'staff_assisted_listing') assignedMap[id].listing++
      else if (r.request_type === 'management_setup')   assignedMap[id].management++
    }

    // Also fetch active leads per staff
    const staffIds = staff.map(s => s.id)
    const leadsMap: Record<string, number> = {}
    if (staffIds.length > 0) {
      const { data: leads } = await admin
        .from('agent_leads')
        .select('assigned_to')
        .in('assigned_to', staffIds)
        .not('pipeline_stage', 'in', '("amefanikiwa","amepotea")')
      for (const l of leads ?? []) leadsMap[l.assigned_to] = (leadsMap[l.assigned_to] ?? 0) + 1
    }

    const result = staff.map(s => ({
      ...s,
      active_managed_properties: workloadMap[s.id]?.active_managed_properties ?? 0,
      max_property_capacity:     workloadMap[s.id]?.max_capacity ?? 0,
      active_leads:              leadsMap[s.id] ?? 0,
      assigned_requests:         assignedMap[s.id] ?? { total: 0, kyc: 0, listing: 0, management: 0 },
    }))

    // Summary
    const summary = {
      total_staff:       staff.length,
      active_staff:      staff.filter(s => s.staff_active).length,
      overloaded:        result.filter(r => r.max_property_capacity > 0 && r.active_managed_properties >= r.max_property_capacity).length,
      pending_requests:  serviceReqs.filter(r => r.status === 'assigned').length,
    }

    return NextResponse.json({ staff: result, summary })
  } catch (err) {
    console.error('[GET /admin/workload]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// PATCH /api/v1/admin/workload — update a staff member's property max_capacity
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const { staff_id, max_capacity } = await req.json()
    if (!staff_id || max_capacity === undefined) {
      return NextResponse.json({ error: 'staff_id na max_capacity vinahitajika' }, { status: 400 })
    }
    if (Number(max_capacity) < 0) {
      return NextResponse.json({ error: 'max_capacity haiwezi kuwa chini ya sifuri' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('staff_workload')
      .upsert({ staff_id, max_capacity: Number(max_capacity), updated_at: new Date().toISOString() }, { onConflict: 'staff_id' })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ workload: data })
  } catch (err) {
    console.error('[PATCH /admin/workload]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
