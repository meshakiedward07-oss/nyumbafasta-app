-- NyumbaFasta — listing-videos Supabase Storage bucket + RLS policies
-- Run in Supabase SQL Editor

-- ── 1. Ensure bucket exists, is public, correct MIME types ─────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-videos',
  'listing-videos',
  true,           -- MUST be public for <video> streaming
  524288000,      -- 500 MB
  ARRAY[
    'video/mp4',
    'video/quicktime',    -- .mov
    'video/webm',
    'video/x-msvideo',   -- .avi
    'video/3gpp',        -- .3gp mobile
    'video/x-matroska'   -- .mkv
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public             = true,
  file_size_limit    = 524288000,
  allowed_mime_types = ARRAY[
    'video/mp4', 'video/quicktime', 'video/webm',
    'video/x-msvideo', 'video/3gpp', 'video/x-matroska'
  ];

-- ── 2. Drop old broken policies ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can view listing videos"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload videos"  ON storage.objects;
DROP POLICY IF EXISTS "Dalali can delete own videos"     ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload listing videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own listing videos"     ON storage.objects;

-- ── 3. Public SELECT — anyone can stream a video ────────────────────────────
CREATE POLICY "Public can view listing videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'listing-videos');

-- ── 4. Authenticated INSERT — logged-in users upload ────────────────────────
CREATE POLICY "Authenticated can upload listing videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'listing-videos');

-- ── 5. Owner DELETE — users delete only their own folder ────────────────────
CREATE POLICY "Users can delete own listing videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'listing-videos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ── 6. Fix existing URLs missing /public/ ───────────────────────────────────
UPDATE listings
SET video_url = REPLACE(
  video_url,
  '/storage/v1/object/listing-videos/',
  '/storage/v1/object/public/listing-videos/'
)
WHERE video_url LIKE '%/object/listing-videos/%'
  AND video_url NOT LIKE '%/object/public/%';

-- ── 7. Verify ────────────────────────────────────────────────────────────────
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'listing-videos';
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname ILIKE '%video%';
SELECT id, title, video_url FROM listings WHERE video_url IS NOT NULL LIMIT 5;
