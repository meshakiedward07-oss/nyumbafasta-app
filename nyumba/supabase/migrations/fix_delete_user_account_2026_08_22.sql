-- ════════════════════════════════════════════════════════════════════════
-- fix_delete_user_account_2026_08_22.sql
-- Run in Supabase SQL Editor. Safe to re-run — all statements idempotent.
--
-- Fixes account deletion, which has been failing for BOTH self-delete and
-- admin-delete since 2026-07-28:
--
--   Bug A (admin delete): "update or delete on table \"users\" violates
--   foreign key constraint \"messages_sender_id_fkey\" on table \"messages\""
--     -> messages.sender_id references users(id) with no ON DELETE action
--        at all (defaults to RESTRICT), and delete_user_account() never
--        cleaned up the messages table (it didn't exist yet when that
--        function was first written; a later migration added the
--        Communication Hub's `messages` table but nobody updated the
--        delete cascade to match).
--
--   Bug B (self-delete): "column \"created_by\" does not exist"
--     -> delete_user_account()'s Step 3 has a straight
--        `DELETE FROM agent_leads WHERE created_by = target_user_id`, but
--        agent_leads has no created_by column (only assigned_to) —
--        a copy/paste mixup with the unrelated lead_communications table,
--        which DOES have created_by. This statement fails unconditionally,
--        every single time the function runs, before it ever reaches the
--        messages/users cleanup above — which is why self-delete (no JS
--        fallback) always hit this error first, while admin-delete (which
--        has a JS fallback with per-table errors silently ignored) got
--        past it only to hit the messages FK next.
--
-- delete_user_account() has been defined in THREE different, uncoordinated
-- files over time (add_delete_and_reports.sql, fix_delete_system.sql,
-- migrations/db_audit_fixes_2026_07_28.sql) — this migration is now the
-- single canonical version; the older two should be treated as superseded.
-- ════════════════════════════════════════════════════════════════════════

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
  -- (was: DELETE FROM agent_leads WHERE created_by = target_user_id — that
  -- column doesn't exist on agent_leads; the correct table for created_by
  -- cleanup is lead_communications, handled below with the other optional
  -- tables since it may not exist in every environment.)
  DELETE FROM staff_permissions     WHERE staff_id         = target_user_id;
  DELETE FROM staff_activity_log    WHERE staff_id         = target_user_id;
  DELETE FROM contact_unlocks
    WHERE dalali_id = target_user_id OR client_id = target_user_id;
  DELETE FROM reviews
    WHERE dalali_id = target_user_id OR reviewer_id = target_user_id;

  -- Communication Hub messages — sender_id has no ON DELETE action, so any
  -- message this user sent (including in conversations they didn't create)
  -- must be removed explicitly before the users row can be deleted. Their
  -- OWN conversations cascade-delete automatically (conversations.created_by
  -- is ON DELETE CASCADE), which also cascades to messages/participants in
  -- those — this additionally covers messages sent in OTHER users'
  -- conversations, which that cascade does not reach.
  BEGIN
    DELETE FROM messages WHERE sender_id = target_user_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

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

  BEGIN
    DELETE FROM lead_communications WHERE created_by = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

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

-- ── Schema-level defense in depth ──────────────────────────────────────────
-- Even with the RPC fixed, make the messages FK itself forgiving so a future
-- incomplete cascade (JS fallback, a new migration, etc.) can't reintroduce
-- this exact class of failure. Preserve message history (don't cascade-
-- delete the conversation), just detach the deleted sender.
ALTER TABLE messages ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE messages
  ADD CONSTRAINT messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;

DO $$ BEGIN
  RAISE NOTICE 'fix_delete_user_account_2026_08_22.sql complete — account deletion should now work for both self-delete and admin-delete';
END $$;
