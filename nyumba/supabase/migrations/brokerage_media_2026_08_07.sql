-- brokerage_media_2026_08_07.sql
-- Adds video_url to brokerage_requests so orgs can attach a property video
-- alongside photos when submitting a brokerage request.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS
ALTER TABLE brokerage_requests ADD COLUMN IF NOT EXISTS video_url TEXT;
