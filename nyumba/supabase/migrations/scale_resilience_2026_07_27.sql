-- ============================================================
-- NyumbaFasta: Scale & Resilience Migration 2026-07-27
-- Safe to run multiple times (IF NOT EXISTS everywhere).
-- Run in the Supabase SQL editor AFTER deploying the app.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. MISSING INDICES
-- ──────────────────────────────────────────────────────────────

-- leads table (heavily filtered in admin queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_status_quality
  ON leads(status, contact_quality, is_duplicate, is_dead_lead);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_import_batch
  ON leads(import_batch_id) WHERE import_batch_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_social_score
  ON leads(social_score DESC NULLS LAST) WHERE is_dead_lead = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_created_status
  ON leads(created_at DESC, status);

-- brokerage_requests
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_brokerage_requests_org_status
  ON brokerage_requests(org_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_brokerage_requests_posted_by
  ON brokerage_requests(posted_by, status) WHERE posted_by IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_brokerage_requests_status
  ON brokerage_requests(status, created_at DESC);

-- maintenance_requests
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_requests_org_status
  ON maintenance_requests(org_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_requests_vendor
  ON maintenance_requests(assigned_vendor_id) WHERE assigned_vendor_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_requests_listing
  ON maintenance_requests(listing_id, status);

-- lease_payments (rent collection queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lease_payments_lease_status
  ON lease_payments(lease_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lease_payments_due_date
  ON lease_payments(due_date, status) WHERE status IN ('pending', 'partial', 'proof_uploaded');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lease_payments_lease_due
  ON lease_payments(lease_id, due_date DESC);

-- conversations & messages (N+1 query fix support)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversation_participants_user
  ON conversation_participants(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversation_participants_conv_user
  ON conversation_participants(conversation_id, user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conv_created
  ON messages(conversation_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conv_sender
  ON messages(conversation_id, sender_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_org_type
  ON conversations(org_id, conv_type, last_message_at DESC) WHERE org_id IS NOT NULL;

-- income_records (analytics time-range scans)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_income_records_date_status
  ON income_records(transaction_date DESC, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_income_records_month_year
  ON income_records(year, month, status);

-- dalali_profiles platform brokers
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dalali_profiles_platform_broker
  ON dalali_profiles(user_id) WHERE is_platform_broker = true;

-- notifications type lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_type
  ON notifications(user_id, type, created_at DESC);

-- organization_members fast lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_members_user_role
  ON organization_members(user_id, role);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_members_org_role
  ON organization_members(organization_id, role);

-- ──────────────────────────────────────────────────────────────
-- 2. DALALI RATING AUTO-UPDATE TRIGGER
-- Replaces the N-row application-level scan in reviews POST.
-- The trigger fires after every INSERT on reviews and updates
-- dalali_profiles atomically in the DB — single SQL round-trip.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION nf_update_dalali_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE dalali_profiles
  SET
    rating_avg   = (
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM reviews
      WHERE dalali_id = NEW.dalali_id
    ),
    rating_count = (
      SELECT COUNT(*)
      FROM reviews
      WHERE dalali_id = NEW.dalali_id
    )
  WHERE user_id = NEW.dalali_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_dalali_rating ON reviews;
CREATE TRIGGER trg_update_dalali_rating
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION nf_update_dalali_rating();

-- ──────────────────────────────────────────────────────────────
-- 3. CONVERSATIONS RPC — single query replaces N+1 pattern
-- Returns enriched conversations (with last message + unread
-- count) for a user in one DB round-trip using DISTINCT ON.
-- Called from GET /api/v1/conversations instead of mapping
-- over conversations and issuing 2 queries per conversation.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION nf_get_conversations(
  p_user_id  uuid,
  p_org_id   uuid    DEFAULT NULL,
  p_type     text    DEFAULT NULL,
  p_limit    integer DEFAULT 50
)
RETURNS TABLE (
  id              uuid,
  title           text,
  conv_type       text,
  status          text,
  context_type    text,
  context_id      uuid,
  org_id          uuid,
  created_by      uuid,
  last_message_at timestamptz,
  created_at      timestamptz,
  last_message    jsonb,
  unread_count    bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Conversations the user participates in
  user_convs AS (
    SELECT cp.conversation_id, cp.last_read_at
    FROM conversation_participants cp
    WHERE cp.user_id = p_user_id
  ),
  -- DISTINCT ON gives the latest message per conversation in one scan
  last_msgs AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id,
      jsonb_build_object(
        'id',           m.id,
        'body',         m.body,
        'sender_id',    m.sender_id,
        'created_at',   m.created_at,
        'message_type', m.message_type,
        'is_internal',  m.is_internal
      ) AS msg_json
    FROM messages m
    JOIN user_convs uc ON m.conversation_id = uc.conversation_id
    WHERE m.deleted_at IS NULL
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  -- Single GROUP BY for all unread counts
  unread AS (
    SELECT m.conversation_id, COUNT(*) AS cnt
    FROM messages m
    JOIN user_convs uc ON m.conversation_id = uc.conversation_id
    WHERE m.deleted_at IS NULL
      AND m.created_at > COALESCE(uc.last_read_at, '1970-01-01'::timestamptz)
    GROUP BY m.conversation_id
  )
  SELECT
    c.id,
    c.title,
    c.conv_type,
    c.status,
    c.context_type,
    c.context_id,
    c.org_id,
    c.created_by,
    c.last_message_at,
    c.created_at,
    lm.msg_json         AS last_message,
    COALESCE(u.cnt, 0)  AS unread_count
  FROM conversations c
  JOIN user_convs uc ON c.id = uc.conversation_id
  LEFT JOIN last_msgs  lm ON c.id = lm.conversation_id
  LEFT JOIN unread     u  ON c.id = u.conversation_id
  WHERE (p_org_id IS NULL OR c.org_id = p_org_id)
    AND (p_type   IS NULL OR c.conv_type = p_type)
  ORDER BY c.last_message_at DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

-- Grant execute to service role (used by createAdminClient)
GRANT EXECUTE ON FUNCTION nf_get_conversations(uuid, uuid, text, integer) TO service_role;

-- ──────────────────────────────────────────────────────────────
-- 4. ANALYTICS AGGREGATE HELPERS
-- Faster count queries used by admin/analytics instead of
-- fetching every row into application memory.
-- ──────────────────────────────────────────────────────────────

-- Active subscription counts by plan (returns one row)
CREATE OR REPLACE FUNCTION nf_subscription_stats()
RETURNS TABLE (
  total_active bigint,
  basic        bigint,
  premium      bigint,
  enterprise   bigint,
  total_unique bigint,
  mrr_tzs      bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE status = 'active')                         AS total_active,
    COUNT(*) FILTER (WHERE status = 'active' AND plan = 'basic')      AS basic,
    COUNT(*) FILTER (WHERE status = 'active' AND plan = 'premium')    AS premium,
    COUNT(*) FILTER (WHERE status = 'active' AND plan = 'enterprise') AS enterprise,
    COUNT(DISTINCT dalali_id) FILTER (WHERE plan <> 'free')          AS total_unique,
    SUM(CASE
      WHEN status = 'active' AND plan = 'basic'      THEN 10000
      WHEN status = 'active' AND plan = 'premium'    THEN 25000
      WHEN status = 'active' AND plan = 'enterprise' THEN 50000
      ELSE 0
    END)::bigint AS mrr_tzs
  FROM subscriptions
  WHERE plan <> 'free';
$$;

GRANT EXECUTE ON FUNCTION nf_subscription_stats() TO service_role;
