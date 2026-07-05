-- Add columns that were referenced in code but missing from the original tiktok_social.sql migration.
-- video_id: TikTok's public video ID (available after PUBLISH_COMPLETE)
-- tiktok_video_url: shareable link to the published TikTok video

alter table tiktok_posts
  add column if not exists video_id         text,
  add column if not exists tiktok_video_url text;

-- Index for quick lookup of published posts by video_id
create index if not exists tiktok_posts_video_id_idx
  on tiktok_posts (video_id)
  where video_id is not null;
