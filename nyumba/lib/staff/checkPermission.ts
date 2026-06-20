import { createAdminClient } from '@/lib/supabase/server'
import type { PermissionKey } from './permissions'

// Returns all permission keys for a user.
// Admins implicitly have every permission — no DB query needed for them.
export async function getStaffPermissions(userId: string): Promise<PermissionKey[]> {
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (profile?.role === 'admin') {
    const { STAFF_PERMISSIONS } = await import('./permissions')
    return Object.keys(STAFF_PERMISSIONS) as PermissionKey[]
  }

  const { data: rows } = await admin
    .from('staff_permissions')
    .select('permission_key')
    .eq('staff_id', userId)

  return (rows ?? []).map(r => r.permission_key as PermissionKey)
}

export async function hasPermission(userId: string, permission: PermissionKey): Promise<boolean> {
  const perms = await getStaffPermissions(userId)
  return perms.includes(permission)
}

// Returns { allowed: true } or { allowed: false, error }
export async function requirePermission(
  userId: string,
  permission: PermissionKey,
): Promise<{ allowed: boolean; error?: string }> {
  const allowed = await hasPermission(userId, permission)
  if (!allowed) {
    return { allowed: false, error: 'Huna ruhusa ya kufikia sehemu hii. Wasiliana na admin.' }
  }
  return { allowed: true }
}

export async function logStaffActivity(params: {
  staffId: string
  actionType: string
  resourceType?: string
  resourceId?: string
  description: string
}): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('staff_activity_log').insert({
      staff_id:      params.staffId,
      action_type:   params.actionType,
      resource_type: params.resourceType ?? null,
      resource_id:   params.resourceId ?? null,
      description:   params.description,
    })
  } catch (err) {
    // Non-fatal — never let logging break the main action
    console.error('[StaffActivity] Log failed:', err)
  }
}
