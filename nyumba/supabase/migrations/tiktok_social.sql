-- TikTok OAuth connections (one row per connected TikTok account)
create table if not exists tiktok_connections (
  id                        uuid primary key default gen_random_uuid(),
  open_id                   text unique not null,
  access_token              text not null,
  refresh_token             text not null,
  token_expires_at          timestamptz not null,
  refresh_token_expires_at  timestamptz not null,
  display_name              text not null default '',
  avatar_url                text not null default '',
  follower_count            integer not null default 0,
  scopes                    text[] not null default '{}',
  is_active                 boolean not null default true,
  connected_at              timestamptz not null default now(),
  last_refreshed_at         timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- TikTok video posts (one row per posting attempt)
create table if not exists tiktok_posts (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid references listings(id) on delete set null,
  video_url        text not null,
  caption          text not null default '',
  status           text not null default 'uploading',
  privacy_level    text not null default 'PUBLIC_TO_EVERYONE',
  disable_comment  boolean not null default false,
  disable_duet     boolean not null default false,
  disable_stitch   boolean not null default false,
  publish_id       text,
  tiktok_response  jsonb,
  error_message    text,
  views_count      integer not null default 0,
  likes_count      integer not null default 0,
  comments_count   integer not null default 0,
  shares_count     integer not null default 0,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists tiktok_connections_is_active_idx
  on tiktok_connections (is_active, connected_at desc);

create index if not exists tiktok_posts_listing_id_idx
  on tiktok_posts (listing_id);

create index if not exists tiktok_posts_status_idx
  on tiktok_posts (status);

-- RLS: only service-role (admin) can read/write these tables
alter table tiktok_connections enable row level security;
alter table tiktok_posts enable row level security;

-- No public policies — all access via supabaseAdmin (service role bypasses RLS)
