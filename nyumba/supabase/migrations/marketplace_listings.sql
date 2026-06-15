-- Facebook Marketplace listings tracker
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id          UUID REFERENCES listings(id) ON DELETE CASCADE,
  catalog_id          TEXT,
  marketplace_item_id TEXT,
  retailer_id         TEXT UNIQUE,
  status              TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','sold','expired','failed','deleted')),
  availability        TEXT NOT NULL DEFAULT 'IN_STOCK'
    CHECK (availability IN ('IN_STOCK','OUT_OF_STOCK')),
  price_tzs           INTEGER,
  title               TEXT,
  description         TEXT,
  image_urls          TEXT[],
  property_type       TEXT,
  listing_type        TEXT,
  location            TEXT,
  error_message       TEXT,
  views               INTEGER NOT NULL DEFAULT 0,
  inquiries           INTEGER NOT NULL DEFAULT 0,
  posted_at           TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  last_synced_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Marketplace inquiries (messages from FB buyers)
CREATE TABLE IF NOT EXISTS marketplace_inquiries (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  marketplace_listing_id  UUID REFERENCES marketplace_listings(id) ON DELETE SET NULL,
  listing_id              UUID REFERENCES listings(id) ON DELETE SET NULL,
  sender_fb_id            TEXT,
  sender_name             TEXT,
  message                 TEXT NOT NULL,
  replied                 BOOLEAN NOT NULL DEFAULT false,
  reply_text              TEXT,
  replied_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (no CONCURRENTLY — SQL Editor runs in transaction)
CREATE INDEX IF NOT EXISTS idx_ml_listing    ON marketplace_listings(listing_id);
CREATE INDEX IF NOT EXISTS idx_ml_status     ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_ml_retailer   ON marketplace_listings(retailer_id);
CREATE INDEX IF NOT EXISTS idx_ml_item       ON marketplace_listings(marketplace_item_id);
CREATE INDEX IF NOT EXISTS idx_mi_listing    ON marketplace_inquiries(listing_id);
CREATE INDEX IF NOT EXISTS idx_mi_ml_listing ON marketplace_inquiries(marketplace_listing_id);

ALTER TABLE marketplace_listings DISABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_inquiries DISABLE ROW LEVEL SECURITY;

-- Add marketplace columns to listings table
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS marketplace_posted     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketplace_item_id    TEXT,
  ADD COLUMN IF NOT EXISTS marketplace_posted_at  TIMESTAMPTZ;
