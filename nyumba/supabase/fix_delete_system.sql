-- ══════════════════════════════════════════════════════════════════
-- fix_delete_system.sql
-- Run once in Supabase SQL Editor
-- Fixes:
--   1. delete_user_account RPC crashes with "column email of relation users does not exist"
--   2. listing_occupancy_log.changed_by FK has no ON DELETE → blocks user row delete
--   3. agent_leads.converted_to_profile_id FK has no ON DELETE → blocks user row delete
-- ══════════════════════════════════════════════════════════════════

-- 1. Fix listing_occupancy_log.changed_by FK (add ON DELETE SET NULL)
ALTER TABLE listing_occupancy_log
  DROP CONSTRAINT IF EXISTS listing_occupancy_log_changed_by_fkey;

ALTER TABLE listing_occupancy_log
  ADD CONSTRAINT listing_occupancy_log_changed_by_fkey
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL;

-- 2. Fix agent_leads.converted_to_profile_id FK (add ON DELETE SET NULL)
ALTER TABLE agent_leads
  DROP CONSTRAINT IF EXISTS agent_leads_converted_to_profile_id_fkey;

ALTER TABLE agent_leads
  ADD CONSTRAINT agent_leads_converted_to_profile_id_fkey
  FOREIGN KEY (converted_to_profile_id) REFERENCES users(id) ON DELETE SET NULL;

-- 3. Recreate delete_user_account WITHOUT the email = NULL line
--    (users.email column does not exist — email lives in auth.users only)
CREATE OR REPLACE FUNCTION public.delete_user_account(
  target_user_id  UUID,
  reason          TEXT    DEFAULT NULL,
  deleted_by_id   UUID    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Archive all listings
  UPDATE listings
  SET status = 'deleted'
  WHERE dalali_id = target_user_id
    AND status NOT IN ('deleted');

  -- Delete FK-constrained child tables (all have ON DELETE CASCADE or must be done manually)
  DELETE FROM dalali_profiles         WHERE user_id   = target_user_id;
  DELETE FROM subscriptions           WHERE dalali_id = target_user_id;
  DELETE FROM push_subscriptions      WHERE user_id   = target_user_id;
  DELETE FROM notifications           WHERE user_id   = target_user_id;

  -- Soft-delete: scrub PII from public.users, mark inactive
  -- Note: email is NOT in public.users — it lives in auth.users only
  UPDATE public.users
  SET
    deleted_at      = now(),
    deleted_by      = deleted_by_id,
    deletion_reason = reason,
    is_active       = false,
    full_name       = 'Akaunti Iliyofutwa',
    phone           = NULL,
    avatar_url      = NULL
  WHERE id = target_user_id;

  -- Remove auth login (prevents any future sign-in)
  DELETE FROM auth.users WHERE id = target_user_id;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'delete_user_account failed: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID, TEXT, UUID) TO service_role;
