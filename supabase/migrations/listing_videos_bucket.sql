-- ──────────────────────────────────────────────────────────────────────────────
-- listing-videos Storage Bucket
-- Run this once in Supabase SQL Editor (Dashboard → SQL Editor)
-- ──────────────────────────────────────────────────────────────────────────────

-- Create the bucket (public so videos can be streamed without auth)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-videos',
  'listing-videos',
  true,
  52428800,  -- 50 MB per file
  ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/avi']
)
ON CONFLICT (id) DO UPDATE SET
  public            = true,
  file_size_limit   = 52428800,
  allowed_mime_types = ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/avi'];

-- Authenticated dalali can upload to their own folder (userId/filename)
CREATE POLICY "Authenticated upload listing videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'listing-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Anyone can read/stream videos (bucket is public)
CREATE POLICY "Public read listing videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'listing-videos');

-- Dalali can delete only their own videos
CREATE POLICY "Dalali delete own listing videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'listing-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Verify
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'listing-videos';
