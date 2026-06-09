-- Run this in the Supabase SQL editor (or via the CLI) before deploying.
-- Stores security-relevant events written by lib/security/auditLog.ts.

CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_id TEXT,
  target_type TEXT,
  metadata JSONB,
  ip_address TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_created_at ON security_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_action ON security_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_id ON security_audit_log (user_id);

-- RLS: only the service role may read/write. The service role bypasses RLS,
-- so a deny-all policy keeps anon/authenticated clients fully locked out.
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON security_audit_log;
CREATE POLICY "Service role only" ON security_audit_log
  USING (false)
  WITH CHECK (false);
