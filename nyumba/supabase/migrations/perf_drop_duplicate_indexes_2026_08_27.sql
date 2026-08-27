-- ═══════════════════════════════════════════════════════════════════════════
-- perf_drop_duplicate_indexes_2026_08_27.sql
-- Run in Supabase SQL Editor. Safe to re-run.
--
-- 30 groups of literally duplicate indexes found (identical index
-- definition, different names — almost certainly created by different
-- uncoordinated migrations over time, per this project's established
-- pattern). Each duplicate costs extra disk space and slows down every
-- INSERT/UPDATE on that table (Postgres must maintain every index), with
-- zero query-speed benefit since the planner only needs one.
--
-- For each duplicate group this keeps the alphabetically-first index name
-- and drops the rest. Two pairs (contact_unlocks/subscriptions payment_ref)
-- are backed by a UNIQUE constraint rather than a plain index — Postgres
-- refuses to DROP INDEX on those directly (the constraint owns it), so the
-- attempt is wrapped in an exception handler that logs a warning and moves
-- on instead of failing the whole script; nothing is broken either way.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
  idx_name  TEXT;
  keep_name TEXT;
  i INT;
  dropped_count INT := 0;
  skipped_count INT := 0;
BEGIN
  FOR r IN
    SELECT
      tablename,
      regexp_replace(indexdef, 'INDEX [a-zA-Z0-9_]+ ON', 'INDEX ON') AS norm,
      array_agg(indexname ORDER BY indexname) AS names
    FROM pg_indexes
    WHERE schemaname = 'public'
    GROUP BY tablename, norm
    HAVING count(*) > 1
  LOOP
    keep_name := r.names[1];
    FOR i IN 2..array_length(r.names, 1) LOOP
      idx_name := r.names[i];
      BEGIN
        EXECUTE format('DROP INDEX IF EXISTS public.%I', idx_name);
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped duplicate index % (kept % on %)', idx_name, keep_name, r.tablename;
      EXCEPTION WHEN OTHERS THEN
        skipped_count := skipped_count + 1;
        RAISE WARNING 'Could not drop % on % (likely backs a UNIQUE constraint — left both in place, harmless): %', idx_name, r.tablename, SQLERRM;
      END;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'perf_drop_duplicate_indexes_2026_08_27.sql complete — % dropped, % skipped (see warnings above for skipped ones).', dropped_count, skipped_count;
END $$;

-- Verification: should return far fewer groups than the 30 found before
-- (only the constraint-backed pairs, if any, may still show up).
SELECT
  array_agg(indexname) AS duplicate_index_names,
  tablename,
  indexdef_normalized
FROM (
  SELECT
    indexname, tablename,
    regexp_replace(indexdef, 'INDEX [a-zA-Z0-9_]+ ON', 'INDEX ON') AS indexdef_normalized
  FROM pg_indexes
  WHERE schemaname = 'public'
) sub
GROUP BY tablename, indexdef_normalized
HAVING count(*) > 1;

-- ── Follow-up: the one pair the exception handler above correctly
-- couldn't resolve automatically (alphabetical-first happened to be the
-- non-constraint one for this specific pair). subscriptions_payment_ref_key
-- is the UNIQUE-constraint-backed index (keep); idx_subscriptions_payment_ref
-- is the redundant plain duplicate (drop).
DROP INDEX IF EXISTS public.idx_subscriptions_payment_ref;
