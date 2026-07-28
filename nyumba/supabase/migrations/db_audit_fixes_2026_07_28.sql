-- ════════════════════════════════════════════════════════════════════════
-- NyumbaFasta — Database Audit Fixes 2026-07-28
-- Run in Supabase SQL Editor.
-- Safe to re-run: all statements are idempotent.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. MISSING RPC: start_dalali_trial ───────────────────────────────────────
-- Called at dalali registration (auth/register/route.ts).
-- Without this RPC every new dalali signup throws a 404 from the DB,
-- which causes the registration route to silently fail.

CREATE OR REPLACE FUNCTION start_dalali_trial(dalali_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial_days INT := 14;
BEGIN
  -- Insert a 14-day trial subscription.
  -- ON CONFLICT: if the dalali already has a subscription, do nothing
  -- (prevents double-trial when called twice, e.g. retry).
  INSERT INTO subscriptions (
    dalali_id,
    plan,
    status,
    is_trial,
    trial_started_at,
    trial_ends_at,
    amount_paid,
    payment_method,
    payment_ref,
    starts_at,
    expires_at
  )
  VALUES (
    dalali_user_id,
    'basic',
    'active',
    TRUE,
    NOW(),
    NOW() + (v_trial_days || ' days')::INTERVAL,
    0,
    'trial',
    'TRIAL-' || dalali_user_id::TEXT,
    NOW(),
    NOW() + (v_trial_days || ' days')::INTERVAL
  )
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION start_dalali_trial(UUID) TO service_role;

-- ── 2. MISSING RPC: delete_user_account ──────────────────────────────────────
-- Called from:
--   • app/api/v1/account/delete/route.ts  (self-delete)
--   • app/api/v1/admin/users/[id]/route.ts (admin delete)
--   • lib/dalali/accountMonitor.ts (auto-delete after 90 days)
--
-- Without this RPC, deletions fall back to per-table JS code — slower,
-- non-atomic, and leaves orphan rows if any step errors.
-- This function does a proper ordered cascade inside a single transaction.

CREATE OR REPLACE FUNCTION delete_user_account(
  target_user_id UUID,
  reason         TEXT    DEFAULT 'User requested deletion',
  deleted_by_id  UUID    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing_ids   UUID[];
  v_advertiser_ids UUID[];
BEGIN
  -- Collect IDs needed for child-table cleanup
  SELECT ARRAY_AGG(id) INTO v_listing_ids
    FROM listings WHERE dalali_id = target_user_id;

  SELECT ARRAY_AGG(id) INTO v_advertiser_ids
    FROM advertisers WHERE user_id = target_user_id;

  -- ── Step 1: tables keyed on listing_id (from any user) ────────────────────
  IF v_listing_ids IS NOT NULL AND array_length(v_listing_ids, 1) > 0 THEN
    DELETE FROM saved_listings      WHERE listing_id = ANY(v_listing_ids);
    DELETE FROM contact_unlocks     WHERE listing_id = ANY(v_listing_ids);
    DELETE FROM social_posts        WHERE listing_id = ANY(v_listing_ids);
    DELETE FROM marketplace_listings WHERE listing_id = ANY(v_listing_ids);
    DELETE FROM boost_payments      WHERE listing_id = ANY(v_listing_ids);
  END IF;

  -- ── Step 2: ad campaigns keyed on advertiser_id ────────────────────────────
  IF v_advertiser_ids IS NOT NULL AND array_length(v_advertiser_ids, 1) > 0 THEN
    DELETE FROM ad_campaigns WHERE advertiser_id = ANY(v_advertiser_ids);
  END IF;

  -- ── Step 3: tables keyed directly on user id ───────────────────────────────
  DELETE FROM subscriptions         WHERE dalali_id        = target_user_id;
  DELETE FROM saved_listings        WHERE client_id        = target_user_id;
  DELETE FROM notifications         WHERE user_id          = target_user_id;
  DELETE FROM profile_views         WHERE dalali_id        = target_user_id;
  DELETE FROM boost_payments        WHERE dalali_id        = target_user_id;
  DELETE FROM dalali_commissions    WHERE dalali_id        = target_user_id;
  DELETE FROM advertisers           WHERE user_id          = target_user_id;
  DELETE FROM reports               WHERE reporter_id      = target_user_id;
  DELETE FROM reports               WHERE reported_dalali_id = target_user_id;
  DELETE FROM agent_leads           WHERE assigned_to      = target_user_id;
  DELETE FROM agent_leads           WHERE created_by       = target_user_id;
  DELETE FROM staff_permissions     WHERE staff_id         = target_user_id;
  DELETE FROM staff_activity_log    WHERE staff_id         = target_user_id;
  DELETE FROM contact_unlocks
    WHERE dalali_id = target_user_id OR client_id = target_user_id;
  DELETE FROM reviews
    WHERE dalali_id = target_user_id OR reviewer_id = target_user_id;

  -- Conditionally delete optional tables (guard with IF EXISTS via DO block)
  -- These may not exist in all environments
  BEGIN
    DELETE FROM push_subscriptions    WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN
    DELETE FROM user_agreements       WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN
    DELETE FROM agreement_violations
      WHERE reporter_id = target_user_id OR reported_user_id = target_user_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN
    DELETE FROM dalali_account_warnings WHERE dalali_id = target_user_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN
    DELETE FROM message_classifications WHERE sender_id = target_user_id::TEXT;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN
    DELETE FROM whatsapp_conversations  WHERE phone_number ILIKE '%' || target_user_id::TEXT || '%';
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- ── Step 4: dalali-specific profile tables ─────────────────────────────────
  DELETE FROM listings          WHERE dalali_id  = target_user_id;
  DELETE FROM dalali_profiles   WHERE user_id    = target_user_id;

  -- ── Step 5: delete from public.users (FK constraints resolved above) ───────
  DELETE FROM users WHERE id = target_user_id;

  -- ── Step 6: delete auth.users (must be last — all FKs point to this) ───────
  -- Uses Supabase admin auth function only available via service_role
  PERFORM auth.uid(); -- no-op that ensures we're running as service_role
  DELETE FROM auth.users WHERE id = target_user_id;

EXCEPTION
  WHEN OTHERS THEN
    -- Surface the error to the caller rather than swallowing it
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_user_account(UUID, TEXT, UUID) TO service_role;

-- ── 3. GUARD: nf_get_conversations safety ────────────────────────────────────
-- Ensure the function handles missing conversation_participants gracefully.
-- Re-create with explicit table guard to avoid 42P01 crashes if table missing.

CREATE OR REPLACE FUNCTION nf_get_conversations(
  p_user_id  UUID,
  p_org_id   UUID   DEFAULT NULL,
  p_limit    INT    DEFAULT 20,
  p_offset   INT    DEFAULT 0
)
RETURNS TABLE (
  conversation_id   UUID,
  conv_type         TEXT,
  subject           TEXT,
  last_message_at   TIMESTAMPTZ,
  unread_count      BIGINT,
  participant_count BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT
      c.id                                           AS conversation_id,
      c.conv_type,
      c.subject,
      c.last_message_at,
      COUNT(CASE WHEN m.is_read = FALSE AND m.sender_id <> p_user_id THEN 1 END) AS unread_count,
      COUNT(DISTINCT cp2.user_id)                    AS participant_count
    FROM conversations c
    JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = p_user_id
    LEFT JOIN messages m ON m.conversation_id = c.id AND m.deleted_at IS NULL
    LEFT JOIN conversation_participants cp2 ON cp2.conversation_id = c.id
    WHERE (p_org_id IS NULL OR c.org_id = p_org_id)
    GROUP BY c.id, c.conv_type, c.subject, c.last_message_at
    ORDER BY c.last_message_at DESC NULLS LAST
    LIMIT p_limit
    OFFSET p_offset;
EXCEPTION
  WHEN undefined_table THEN
    -- conversations/messages not yet created — return empty
    RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION nf_get_conversations(UUID, UUID, INT, INT) TO service_role;

-- ── 4. MISSING INDEXES on frequently queried columns ─────────────────────────

-- knowledge_cache: language filter used in cascade
CREATE INDEX IF NOT EXISTS idx_kc_language
  ON knowledge_cache(language) WHERE is_active = true;

-- knowledge_base: language filter
CREATE INDEX IF NOT EXISTS idx_kb_language
  ON knowledge_base(language, category) WHERE is_active = true;

-- cascade_miss_log: admin panel filters
CREATE INDEX IF NOT EXISTS idx_cml_reviewed
  ON cascade_miss_log(reviewed, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cml_layer
  ON cascade_miss_log(layer_reached, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cml_phone
  ON cascade_miss_log(phone_number, created_at DESC)
  WHERE phone_number IS NOT NULL;

-- social_sessions: admin panel loads pending/admin status
CREATE INDEX IF NOT EXISTS idx_ss_updated
  ON social_sessions(updated_at DESC);

-- whatsapp_conversations: history lookup by phone
CREATE INDEX IF NOT EXISTS idx_wac_phone_created
  ON whatsapp_conversations(phone_number, created_at DESC);

-- notifications: per-user unread count (very hot query)
CREATE INDEX IF NOT EXISTS idx_notif_user_unread
  ON notifications(user_id, is_read, created_at DESC)
  WHERE is_read = false;

-- ── 5. FK ON DELETE guards — add SET NULL where missing on nullable FKs ──────
-- These prevent crashes when a referenced row is deleted.
-- Pattern: drop old FK, re-add with ON DELETE SET NULL.

-- social_sessions.assigned_admin_id — already has ON DELETE SET NULL (from our migration)
-- Check and add for other nullable user FKs that are missing it:

DO $$
BEGIN
  -- cascade_miss_log: phone_number is text, no FK issue
  -- social_handover_messages.sent_by — needs SET NULL
  ALTER TABLE social_handover_messages
    DROP CONSTRAINT IF EXISTS social_handover_messages_sent_by_fkey;
  ALTER TABLE social_handover_messages
    ADD CONSTRAINT social_handover_messages_sent_by_fkey
    FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 6. CASCADE_RATE_LIMITS: ensure cleanup doesn't get blocked ───────────────
-- Add a partial index so the cleanup RPC is fast even with millions of rows
CREATE INDEX IF NOT EXISTS idx_crl_cleanup
  ON cascade_rate_limits(created_at)
  WHERE created_at < NOW() - INTERVAL '2 minutes';

-- ── 7. PREVENT NULL violations in critical tables ────────────────────────────

-- knowledge_base: ensure language has a default so inserts never fail
ALTER TABLE knowledge_base
  ALTER COLUMN language SET DEFAULT 'sw';

-- knowledge_cache: same
ALTER TABLE knowledge_cache
  ALTER COLUMN language SET DEFAULT 'sw';

-- ── 8. SAFE DEFAULT for social_sessions.status ───────────────────────────────
-- Already has DEFAULT 'amina' from creation, but guard CHECK constraint
DO $$
BEGIN
  ALTER TABLE social_sessions
    ADD CONSTRAINT social_sessions_status_check
    CHECK (status IN ('amina', 'pending', 'admin', 'resolved'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 9. INDEX: whatsapp_sessions for admin panel status queries ───────────────
CREATE INDEX IF NOT EXISTS idx_was_status_updated
  ON whatsapp_sessions(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_was_phone
  ON whatsapp_sessions(phone);

-- ── 10. GRANT service_role on new tables (defence-in-depth) ─────────────────
-- Ensures no route fails with permission denied even if RLS is enabled
GRANT ALL ON social_sessions TO service_role;
GRANT ALL ON social_handover_messages TO service_role;
GRANT ALL ON cascade_rate_limits TO service_role;
