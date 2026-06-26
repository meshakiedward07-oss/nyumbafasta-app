-- ── Ensure push_subscriptions table exists with proper RLS ───────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users manage own push subscriptions"
  ON push_subscriptions
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Enable Supabase Realtime on notifications ─────────────────────────────
-- Run this once — allows NotificationBell to get instant updates via websocket
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ── Verify ───────────────────────────────────────────────────────────────
SELECT
  table_name,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('push_subscriptions', 'notifications')
ORDER BY tablename;

SELECT COUNT(*) AS existing_push_subscriptions FROM push_subscriptions;
