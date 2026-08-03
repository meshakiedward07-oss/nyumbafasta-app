-- ════════════════════════════════════════════════════════════════════════
-- Payment Gaps — Admin Refund Records
-- Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════

-- ── payment_refunds ───────────────────────────────────────────────────────────
-- Tracks refunds that admins record manually.
-- AzamPay does not expose a programmatic refund API, so refunds are
-- recorded here for accounting purposes; the actual money transfer is
-- done externally (bank/mobile-money reversal).

CREATE TABLE IF NOT EXISTS payment_refunds (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_ref    TEXT        NOT NULL,
  payment_type   TEXT        NOT NULL
                             CHECK (payment_type IN (
                               'unlock', 'subscription', 'boost',
                               'extra_listing', 'org_subscription', 'fundi_subscription'
                             )),
  amount_tzs     INTEGER     NOT NULL CHECK (amount_tzs > 0),
  reason         TEXT        NOT NULL,
  refunded_by    UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  refunded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_ref  ON payment_refunds(payment_ref);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_by   ON payment_refunds(refunded_by);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_type ON payment_refunds(payment_type);

-- Only admins/staff can read/write; RLS is enforced via service role on writes
ALTER TABLE payment_refunds DISABLE ROW LEVEL SECURITY;
