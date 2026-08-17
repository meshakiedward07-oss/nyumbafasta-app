-- =============================================================
-- NEIGHBORHOOD CACHE FIX — 2026-08-17
-- =============================================================
-- Bugs in original neighborhood_cache.sql:
--   1. Missing cache_key column — all upserts failed silently
--   2. Missing cbd_label column — all upserts failed silently
--   3. latitude/longitude NOT NULL but code can pass NULL when
--      Nominatim geocoding fails → constraint violation
-- Net effect: cache was never written → fresh API call on every page view
-- =============================================================

-- Add the two missing columns
ALTER TABLE public.neighborhood_cache
  ADD COLUMN IF NOT EXISTS cache_key TEXT,
  ADD COLUMN IF NOT EXISTS cbd_label TEXT;

-- Allow NULL lat/lng for listings where geocoding fails
ALTER TABLE public.neighborhood_cache
  ALTER COLUMN latitude  DROP NOT NULL,
  ALTER COLUMN longitude DROP NOT NULL;

-- Index for the cache_key lookups
CREATE INDEX IF NOT EXISTS idx_nc_cache_key ON public.neighborhood_cache(cache_key);
