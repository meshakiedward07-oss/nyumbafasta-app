-- Run in Supabase Dashboard → SQL Editor
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS video_url text;
