-- Internal messaging: add source_role to conversations + update RPC
-- Run in Supabase SQL Editor

-- 1. Add source_role column
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS source_role TEXT;

-- 2. Backfill existing conversations from known roles
UPDATE conversations c
SET source_role = 'dalali'
FROM users u
WHERE c.created_by = u.id
  AND u.role = 'dalali'
  AND c.source_role IS NULL;

-- 3. Replace nf_get_conversations to expose + filter by source_role
CREATE OR REPLACE FUNCTION nf_get_conversations(
  p_user_id     uuid,
  p_org_id      uuid    DEFAULT NULL,
  p_type        text    DEFAULT NULL,
  p_limit       integer DEFAULT 50,
  p_source_role text    DEFAULT NULL
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
  source_role     text,
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
  user_convs AS (
    SELECT cp.conversation_id, cp.last_read_at
    FROM conversation_participants cp
    WHERE cp.user_id = p_user_id
  ),
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
    c.source_role,
    c.last_message_at,
    c.created_at,
    lm.msg_json         AS last_message,
    COALESCE(u.cnt, 0)  AS unread_count
  FROM conversations c
  JOIN user_convs uc ON c.id = uc.conversation_id
  LEFT JOIN last_msgs  lm ON c.id = lm.conversation_id
  LEFT JOIN unread     u  ON c.id = u.conversation_id
  WHERE (p_org_id      IS NULL OR c.org_id      = p_org_id)
    AND (p_type        IS NULL OR c.conv_type   = p_type)
    AND (p_source_role IS NULL OR c.source_role = p_source_role)
  ORDER BY c.last_message_at DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION nf_get_conversations(uuid, uuid, text, integer, text) TO service_role;
