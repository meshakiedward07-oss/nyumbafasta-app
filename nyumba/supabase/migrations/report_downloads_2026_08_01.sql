-- report_downloads_2026_08_01.sql
-- Track when dalali downloads PDF reports
-- Run once in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS dalali_report_downloads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dalali_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month         INTEGER NOT NULL,
  year          INTEGER NOT NULL,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rpdl_dalali ON dalali_report_downloads(dalali_id, downloaded_at DESC);

ALTER TABLE dalali_report_downloads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dalali_own_report_downloads" ON dalali_report_downloads;
CREATE POLICY "dalali_own_report_downloads" ON dalali_report_downloads
  FOR ALL USING (dalali_id = auth.uid());
