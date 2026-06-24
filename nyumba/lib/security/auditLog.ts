import { createClient } from '@supabase/supabase-js'

export type AuditAction =
  | 'login_success'
  | 'login_failed'
  | 'account_deleted'
  | 'role_changed'
  | 'listing_deleted'
  | 'listing_approved'
  | 'listing_rejected'
  | 'user_suspended'
  | 'user_activated'
  | 'user_banned'
  | 'payment_initiated'
  | 'payment_completed'
  | 'payment_failed'
  | 'admin_action'
  | 'unauthorized_access_attempt'

interface AuditEntry {
  action: AuditAction
  user_id?: string
  target_id?: string // ID of affected resource
  target_type?: string // 'listing', 'user', 'payment', etc.
  metadata?: Record<string, unknown>
  ip_address?: string
  severity: 'info' | 'warning' | 'critical'
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return

    const admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    await admin.from('security_audit_log').insert({
      ...entry,
      created_at: new Date().toISOString(),
    })
  } catch {
    // Never let audit logging crash the main flow.
  }
}
