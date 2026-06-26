-- ── Add share_count column to listings ───────────────────────────────────
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS share_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_listings_share_count
  ON listings(share_count DESC);

-- ── Atomic increment function (avoids read-then-write race condition) ─────
CREATE OR REPLACE FUNCTION increment_share_count(listing_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE listings
  SET share_count = share_count + 1
  WHERE id = listing_id;
$$;

-- ── Verify ────────────────────────────────────────────────────────────────
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'listings' AND column_name = 'share_count';
