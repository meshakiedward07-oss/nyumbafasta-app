import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { STAFF_PERMISSIONS, STAFF_ROLE_TEMPLATES } from '@/lib/staff/permissions'
import type { PermissionKey, RoleTemplate } from '@/lib/staff/permissions'

// ─── GET — current permissions for a staff member ────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const admin = createAdminClient()

  const { data: rows } = await admin
    .from('staff_permissions')
    .select('permission_key, granted_at')
    .eq('staff_id', params.id)

  return NextResponse.json({
    granted: (rows ?? []).map(r => r.permission_key),
    allAvailable: Object.values(STAFF_PERMISSIONS),
  })
}

// ─── PUT — replace all permissions for a staff member ────────────────────────
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  let body: { permissions: PermissionKey[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const validKeys = Object.keys(STAFF_PERMISSIONS)
  const invalid   = (body.permissions ?? []).filter(p => !validKeys.includes(p))
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Ruhusa zisizo sahihi: ${invalid.join(', ')}` },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // Safety: only update staff profiles
  const { data: target } = await admin
    .from('users')
    .select('role')
    .eq('id', params.id)
    .single()

  if (!target || target.role !== 'staff') {
    return NextResponse.json({ error: 'Staff mwanachama haupatikani' }, { status: 404 })
  }

  const { error: deleteError } = await admin
    .from('staff_permissions')
    .delete()
    .eq('staff_id', params.id)

  if (deleteError) {
    return NextResponse.json({ error: 'Imeshindwa kufuta ruhusa za zamani' }, { status: 500 })
  }

  if (body.permissions.length > 0) {
    const { error: insertError } = await admin.from('staff_permissions').insert(
      body.permissions.map(key => ({
        staff_id:       params.id,
        permission_key: key,
      }))
    )
    if (insertError) {
      console.error('[Permissions] Insert failed after delete:', insertError.message)
      return NextResponse.json(
        { error: 'Ruhusa zilifutwa lakini kuongeza kulishindwa — wasiliana na msimamizi' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ success: true, message: 'Ruhusa zimesasishwa' })
}

// ─── POST — apply a role template ────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  let body: { template: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const template = STAFF_ROLE_TEMPLATES[body.template as RoleTemplate]
  if (!template) {
    return NextResponse.json({ error: 'Template haijapatikana' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Safety: only apply templates to staff profiles
  const { data: target } = await admin
    .from('users')
    .select('role')
    .eq('id', params.id)
    .single()

  if (!target || target.role !== 'staff') {
    return NextResponse.json({ error: 'Staff mwanachama haupatikani' }, { status: 404 })
  }

  const { error: deleteError } = await admin
    .from('staff_permissions')
    .delete()
    .eq('staff_id', params.id)

  if (deleteError) {
    return NextResponse.json({ error: 'Imeshindwa kufuta ruhusa za zamani' }, { status: 500 })
  }

  const { error: insertError } = await admin.from('staff_permissions').insert(
    template.permissions.map(key => ({
      staff_id:       params.id,
      permission_key: key,
    }))
  )

  if (insertError) {
    console.error('[Permissions] Template insert failed after delete:', insertError.message)
    return NextResponse.json(
      { error: 'Ruhusa zilifutwa lakini template haikuwekwa — wasiliana na msimamizi' },
      { status: 500 }
    )
  }

  const { error: updateError } = await admin
    .from('users')
    .update({ role_template: body.template })
    .eq('id', params.id)

  if (updateError) {
    console.error('[Permissions] role_template update failed:', updateError.message)
  }

  return NextResponse.json({
    success: true,
    appliedPermissions: template.permissions,
  })
}
