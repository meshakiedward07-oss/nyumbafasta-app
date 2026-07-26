-- NyumbaFasta: Property Management — Phase 3: Communication Hub
-- Tables: conversations, conversation_participants, messages, message_attachments
-- Safe to re-run: IF NOT EXISTS throughout

-- ── 1. Conversations ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text,
  conv_type       text        NOT NULL DEFAULT 'general'
                              CHECK (conv_type IN ('lease','service_request','agreement','maintenance','general')),
  status          text        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','closed','archived')),
  context_type    text        CHECK (context_type IN ('lease','service_request','agreement','listing')),
  context_id      uuid,
  org_id          uuid        REFERENCES organizations(id) ON DELETE SET NULL,
  created_by      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

-- ── 2. Conversation Participants ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversation_participants (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            text        NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member','observer')),
  last_read_at    timestamptz,
  joined_at       timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- ── 3. Messages ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid        NOT NULL REFERENCES users(id),
  body            text        NOT NULL CHECK (char_length(body) > 0),
  message_type    text        NOT NULL DEFAULT 'text'
                              CHECK (message_type IN ('text','system','note')),
  is_internal     boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  deleted_at      timestamptz
);

-- ── 4. Message Attachments ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_attachments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  file_url    text        NOT NULL,
  file_name   text,
  file_type   text,
  file_size   bigint,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

-- ── 5. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_conversations_org         ON conversations(org_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_context     ON conversations(context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user    ON conversation_participants(user_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_conv    ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation     ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender          ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_msg_attachments_message  ON message_attachments(message_id);

-- ── 6. Row-Level Security ─────────────────────────────────────────────────────
ALTER TABLE conversations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments      ENABLE ROW LEVEL SECURITY;

-- conversations: participants see their own; org members see org convs; admin/staff all
DROP POLICY IF EXISTS "conversations_access" ON conversations;
CREATE POLICY "conversations_access" ON conversations FOR ALL TO authenticated
  USING (
    id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid())
    OR org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
  )
  WITH CHECK (
    created_by = auth.uid()
    OR org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
                  AND role IN ('owner','branch_manager','agent'))
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
  );

-- conversation_participants: participants see their conversation members
DROP POLICY IF EXISTS "conv_participants_access" ON conversation_participants;
CREATE POLICY "conv_participants_access" ON conversation_participants FOR ALL TO authenticated
  USING (
    conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
                       AND role IN ('owner','branch_manager'))
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
  );

-- messages: participants can read; non-internal messages visible to all participants
DROP POLICY IF EXISTS "messages_access" ON messages;
CREATE POLICY "messages_access" ON messages FOR ALL TO authenticated
  USING (
    conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid())
    AND (is_internal = false OR EXISTS (
      SELECT 1 FROM conversations c
      JOIN organization_members om ON om.organization_id = c.org_id
      WHERE c.id = messages.conversation_id AND om.user_id = auth.uid()
    ))
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
  )
  WITH CHECK (
    sender_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
  );

-- message_attachments: via message access
DROP POLICY IF EXISTS "msg_attachments_access" ON message_attachments;
CREATE POLICY "msg_attachments_access" ON message_attachments FOR ALL TO authenticated
  USING (
    message_id IN (
      SELECT m.id FROM messages m
      JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE cp.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
  )
  WITH CHECK (
    message_id IN (
      SELECT m.id FROM messages m WHERE m.sender_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
  );
