-- Wallet system: in-app balance for quick payments (no USSD each time)
-- Run in Supabase SQL editor

-- ── wallets: one per user ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance     INTEGER     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency    VARCHAR(3)  NOT NULL DEFAULT 'TZS',
  is_frozen   BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wallets_user_id_unique UNIQUE (user_id)
);

-- ── wallet_transactions: immutable audit log ───────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id        UUID        NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type             VARCHAR(20) NOT NULL CHECK (type IN ('topup', 'payment', 'refund')),
  amount           INTEGER     NOT NULL CHECK (amount > 0),
  balance_before   INTEGER     NOT NULL,
  balance_after    INTEGER     NOT NULL,
  description      TEXT,
  reference_type   VARCHAR(30),      -- 'unlock' | 'subscription' | 'boost' | 'topup'
  reference_id     UUID,             -- contact_unlocks.id, subscriptions.id, etc.
  external_id      VARCHAR(100),     -- AzamPay externalId for topups
  msisdn           VARCHAR(20),      -- phone used for topup
  provider         VARCHAR(20),      -- Mpesa | Airtel | Tigo | Halopesa | Azampesa
  status           VARCHAR(20) NOT NULL DEFAULT 'completed'
                   CHECK (status IN ('pending', 'completed', 'failed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_transactions_wallet_id_idx  ON wallet_transactions (wallet_id);
CREATE INDEX IF NOT EXISTS wallet_transactions_user_id_idx    ON wallet_transactions (user_id);
CREATE INDEX IF NOT EXISTS wallet_transactions_external_id_idx ON wallet_transactions (external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS wallet_transactions_status_idx     ON wallet_transactions (status) WHERE status = 'pending';

-- ── updated_at trigger ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_wallet_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wallet_updated_at_trigger ON wallets;
CREATE TRIGGER wallet_updated_at_trigger
  BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_wallet_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own wallet
DROP POLICY IF EXISTS "users_read_own_wallet" ON wallets;
CREATE POLICY "users_read_own_wallet" ON wallets
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only read their own transactions
DROP POLICY IF EXISTS "users_read_own_wallet_transactions" ON wallet_transactions;
CREATE POLICY "users_read_own_wallet_transactions" ON wallet_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Service role (admin client) bypasses RLS for writes
