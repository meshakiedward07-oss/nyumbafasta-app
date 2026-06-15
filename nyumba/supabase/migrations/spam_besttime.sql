-- ── Spam Detection + Best Time Analyzer ───────────────────────────────────
-- Run in Supabase SQL Editor

-- 1. Deleted / hidden spam comments log
CREATE TABLE IF NOT EXISTS spam_comments (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  platform       TEXT        NOT NULL CHECK (platform IN ('instagram','facebook')),
  comment_id     TEXT        UNIQUE NOT NULL,
  post_id        TEXT        NOT NULL,
  commenter_id   TEXT,
  commenter_name TEXT,
  comment_text   TEXT        NOT NULL,
  spam_reason    TEXT        NOT NULL,
  spam_score     INTEGER,
  action_taken   TEXT        NOT NULL DEFAULT 'deleted'
                             CHECK (action_taken IN ('deleted','hidden','flagged','ignored')),
  deleted_at     TIMESTAMPTZ DEFAULT NOW(),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Admin-managed spam keyword list
CREATE TABLE IF NOT EXISTS spam_keywords (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword     TEXT        UNIQUE NOT NULL,
  category    TEXT        NOT NULL DEFAULT 'general'
                          CHECK (category IN ('general','adult','competitor','scam','offensive')),
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  match_count INTEGER     NOT NULL DEFAULT 0,
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Known spam accounts
CREATE TABLE IF NOT EXISTS spam_accounts (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  platform     TEXT        NOT NULL CHECK (platform IN ('instagram','facebook')),
  account_id   TEXT        NOT NULL,
  account_name TEXT,
  spam_count   INTEGER     NOT NULL DEFAULT 1,
  is_blocked   BOOLEAN     NOT NULL DEFAULT false,
  last_spam_at TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, account_id)
);

-- 4. Per-post performance data (for best time analysis)
CREATE TABLE IF NOT EXISTS post_performance (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  platform        TEXT        NOT NULL CHECK (platform IN ('instagram','facebook')),
  post_id         TEXT        UNIQUE NOT NULL,
  post_type       TEXT        DEFAULT 'image'
                              CHECK (post_type IN ('image','video','carousel','reel','story')),
  posted_at       TIMESTAMPTZ NOT NULL,
  posted_hour     INTEGER     CHECK (posted_hour BETWEEN 0 AND 23),
  posted_day      INTEGER     CHECK (posted_day  BETWEEN 0 AND 6),
  likes           INTEGER     NOT NULL DEFAULT 0,
  comments        INTEGER     NOT NULL DEFAULT 0,
  shares          INTEGER     NOT NULL DEFAULT 0,
  reach           INTEGER     NOT NULL DEFAULT 0,
  impressions     INTEGER     NOT NULL DEFAULT 0,
  saves           INTEGER     NOT NULL DEFAULT 0,
  engagement_rate DECIMAL(5,2),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Cached AI posting recommendations
CREATE TABLE IF NOT EXISTS posting_recommendations (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  platform            TEXT        NOT NULL CHECK (platform IN ('instagram','facebook')),
  analysis_date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  best_hours          INTEGER[],
  best_days           INTEGER[],
  worst_hours         INTEGER[],
  worst_days          INTEGER[],
  recommendation_text TEXT,
  data_points         INTEGER     NOT NULL DEFAULT 0,
  avg_engagement      DECIMAL(5,2),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, analysis_date)
);

-- Indexes (no CONCURRENTLY — SQL Editor runs inside a transaction)
CREATE INDEX IF NOT EXISTS idx_spc_platform   ON spam_comments(platform);
CREATE INDEX IF NOT EXISTS idx_spc_commenter  ON spam_comments(commenter_id);
CREATE INDEX IF NOT EXISTS idx_spc_created    ON spam_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skw_active     ON spam_keywords(is_active);
CREATE INDEX IF NOT EXISTS idx_sa_account     ON spam_accounts(platform, account_id);
CREATE INDEX IF NOT EXISTS idx_pp_platform    ON post_performance(platform);
CREATE INDEX IF NOT EXISTS idx_pp_posted      ON post_performance(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_pp_hour        ON post_performance(posted_hour);
CREATE INDEX IF NOT EXISTS idx_pp_day         ON post_performance(posted_day);
CREATE INDEX IF NOT EXISTS idx_pr_platform    ON posting_recommendations(platform, analysis_date DESC);

-- Disable RLS (admin-only, service role)
ALTER TABLE spam_comments            DISABLE ROW LEVEL SECURITY;
ALTER TABLE spam_keywords            DISABLE ROW LEVEL SECURITY;
ALTER TABLE spam_accounts            DISABLE ROW LEVEL SECURITY;
ALTER TABLE post_performance         DISABLE ROW LEVEL SECURITY;
ALTER TABLE posting_recommendations  DISABLE ROW LEVEL SECURITY;

-- ── upsert_spam_account function ─────────────────────────────────────────────
-- Called after every confirmed spam detection
CREATE OR REPLACE FUNCTION upsert_spam_account(
  p_platform     TEXT,
  p_account_id   TEXT,
  p_account_name TEXT
) RETURNS void AS $$
BEGIN
  INSERT INTO spam_accounts (platform, account_id, account_name, spam_count, last_spam_at)
  VALUES (p_platform, p_account_id, p_account_name, 1, NOW())
  ON CONFLICT (platform, account_id) DO UPDATE SET
    spam_count   = spam_accounts.spam_count + 1,
    account_name = EXCLUDED.account_name,
    last_spam_at = NOW(),
    -- Auto-block after 5 confirmed spam comments
    is_blocked   = CASE
      WHEN spam_accounts.spam_count + 1 >= 5 THEN true
      ELSE spam_accounts.is_blocked
    END;
END;
$$ LANGUAGE plpgsql;

-- ── Seed default spam keywords ────────────────────────────────────────────────
INSERT INTO spam_keywords (keyword, category) VALUES
  ('follow for follow', 'general'),
  ('f4f',               'general'),
  ('like for like',     'general'),
  ('l4l',               'general'),
  ('check my profile',  'general'),
  ('check my page',     'general'),
  ('buy followers',     'general'),
  ('click link in bio', 'general'),
  ('bitcoin',           'scam'),
  ('crypto',            'scam'),
  ('investment opportunity', 'scam'),
  ('double your money', 'scam'),
  ('free money',        'scam'),
  ('make money online', 'scam'),
  ('work from home earn','scam'),
  ('visit our page',    'competitor'),
  ('our services are better','competitor'),
  ('18+',               'adult'),
  ('adult content',     'adult'),
  ('mjinga',            'offensive'),
  ('malaya',            'offensive'),
  ('mwizi',             'offensive')
ON CONFLICT (keyword) DO NOTHING;
