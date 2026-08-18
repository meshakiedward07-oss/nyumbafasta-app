-- Occupancy System Migration — 2026-08-18
-- Ensures all columns and tables needed by the capacity/auto-close feature exist.
-- Safe to run multiple times (IF NOT EXISTS throughout).

-- 1. Ensure listing_occupancy_log table exists
CREATE TABLE IF NOT EXISTS public.listing_occupancy_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  previous_occupancy integer,
  new_occupancy   integer NOT NULL,
  changed_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  change_reason   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup per listing
CREATE INDEX IF NOT EXISTS idx_occupancy_log_listing ON public.listing_occupancy_log(listing_id);

-- 2. Ensure auto_deactivated_at column exists on listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS auto_deactivated_at timestamptz DEFAULT NULL;

-- 3. Ensure current_occupancy and total_capacity have correct defaults
ALTER TABLE public.listings
  ALTER COLUMN current_occupancy SET DEFAULT 0;

-- 4. RLS: service_role (admin client) can INSERT into listing_occupancy_log
ALTER TABLE public.listing_occupancy_log ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'listing_occupancy_log' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON public.listing_occupancy_log
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END$$;

-- Allow dalali to read their own listing logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'listing_occupancy_log' AND policyname = 'dalali_read_own'
  ) THEN
    CREATE POLICY dalali_read_own ON public.listing_occupancy_log
      FOR SELECT TO authenticated
      USING (
        listing_id IN (
          SELECT id FROM public.listings WHERE dalali_id = auth.uid()
        )
      );
  END IF;
END$$;
