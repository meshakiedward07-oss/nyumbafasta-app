/**
 * One-time setup route — creates the 4 WhatsApp handoff tables.
 * Call once from admin dashboard, then this endpoint becomes a no-op.
 * GET /api/v1/admin/setup-whatsapp   (admin auth required)
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminUser } from '@/lib/security/adminAuth'

// Each statement as a separate string so we can run them one by one
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'amina'
      CHECK (status IN ('amina','pending','admin','resolved')),
    assigned_admin_id UUID,
    escalation_reason TEXT,
    escalated_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone_number TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
    sender TEXT NOT NULL CHECK (sender IN ('user','amina','admin','system')),
    content TEXT NOT NULL,
    message_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'sent',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS whatsapp_broadcasts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID,
    target TEXT NOT NULL,
    message TEXT NOT NULL,
    tone TEXT NOT NULL DEFAULT 'personal',
    recipients_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
  )`,

  `CREATE TABLE IF NOT EXISTS amina_instructions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID,
    instruction TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'global'
      CHECK (scope IN ('global','phone_specific')),
    phone_number TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_ws_phone   ON whatsapp_sessions(phone_number)`,
  `CREATE INDEX IF NOT EXISTS idx_ws_status  ON whatsapp_sessions(status)`,
  `CREATE INDEX IF NOT EXISTS idx_ws_updated ON whatsapp_sessions(updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_wm_phone   ON whatsapp_messages(phone_number)`,
  `CREATE INDEX IF NOT EXISTS idx_wm_created ON whatsapp_messages(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_wm_phone_created ON whatsapp_messages(phone_number, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_wb_status  ON whatsapp_broadcasts(status)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_scope   ON amina_instructions(scope, active)`,
  `ALTER TABLE whatsapp_sessions   DISABLE ROW LEVEL SECURITY`,
  `ALTER TABLE whatsapp_messages   DISABLE ROW LEVEL SECURITY`,
  `ALTER TABLE whatsapp_broadcasts DISABLE ROW LEVEL SECURITY`,
  `ALTER TABLE amina_instructions  DISABLE ROW LEVEL SECURITY`,
]

export async function GET() {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const results: { stmt: string; ok: boolean; error?: string }[] = []

  for (const stmt of STATEMENTS) {
    try {
      // Supabase JS client doesn't expose raw SQL, but we can use the auth admin API
      // as a workaround via the REST API with a direct query
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        },
        body: JSON.stringify({ query: stmt }),
      })
      if (res.ok) {
        results.push({ stmt: stmt.slice(0, 60) + '…', ok: true })
      } else {
        const err = await res.json()
        // PGRST202 means exec_sql function doesn't exist — skip
        if (err.code === 'PGRST202') {
          results.push({ stmt: stmt.slice(0, 60) + '…', ok: false, error: 'exec_sql function missing — run migration manually in Supabase SQL editor' })
          break
        }
        results.push({ stmt: stmt.slice(0, 60) + '…', ok: false, error: err.message })
      }
    } catch (e) {
      results.push({ stmt: stmt.slice(0, 60) + '…', ok: false, error: String(e) })
    }
  }

  // Also try direct table access to check if tables exist now
  const checks = await Promise.all([
    supabaseAdmin.from('whatsapp_sessions').select('id').limit(1),
    supabaseAdmin.from('whatsapp_messages').select('id').limit(1),
    supabaseAdmin.from('whatsapp_broadcasts').select('id').limit(1),
    supabaseAdmin.from('amina_instructions').select('id').limit(1),
  ])

  const tableStatus = {
    whatsapp_sessions:   !checks[0].error,
    whatsapp_messages:   !checks[1].error,
    whatsapp_broadcasts: !checks[2].error,
    amina_instructions:  !checks[3].error,
  }

  const allOk = Object.values(tableStatus).every(Boolean)

  return NextResponse.json({
    migration_results: results,
    table_status:      tableStatus,
    all_tables_ready:  allOk,
    manual_sql_path:   'supabase/migrations/whatsapp_handoff.sql',
  })
}
