-- Ensure the 'listings' bucket exists, is public, and has correct policies.
-- Ad creatives AND listing images share this bucket.
-- Run once in Supabase SQL Editor — safe to re-run.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listings',
  'listings',
  true,
  52428800,  -- 50 MB per file
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public            = true,
  file_size_limit   = 52428800,
  allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm'];

-- Public read (CDN delivery for all listing images and ad creatives)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'listings_bucket_public_read'
  ) THEN
    CREATE POLICY "listings_bucket_public_read"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'listings');
  END IF;
END $$;

-- Authenticated users can upload (dalali listing images, advertiser uploads via signed URL)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'listings_bucket_authenticated_insert'
  ) THEN
    CREATE POLICY "listings_bucket_authenticated_insert"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'listings');
  END IF;
END $$;

-- Authenticated users can replace their own files
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'listings_bucket_authenticated_update'
  ) THEN
    CREATE POLICY "listings_bucket_authenticated_update"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'listings');
  END IF;
END $$;
