-- ═══════════════════════════════════════════════════════════
--  ELON CHICKEN ($ECHICK) — Supabase SQL Schema
--  Run this in your Supabase SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════

-- ── Players table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS players (
  id                  BIGSERIAL PRIMARY KEY,
  telegram_id         TEXT UNIQUE NOT NULL,
  username            TEXT,
  display_name        TEXT,
  photo_url           TEXT,
  language_code       TEXT DEFAULT 'en',

  coins               INTEGER DEFAULT 0,
  total_coins         INTEGER DEFAULT 0,
  best_score          INTEGER DEFAULT 0,
  best_distance       INTEGER DEFAULT 0,
  total_runs          INTEGER DEFAULT 0,
  total_play_time     INTEGER DEFAULT 0,   -- seconds

  owned_characters    TEXT[]  DEFAULT ARRAY['og'],
  equipped_character  TEXT    DEFAULT 'og',
  wallet_address      TEXT,

  referral_count      INTEGER DEFAULT 0,
  captcha_done        BOOLEAN DEFAULT FALSE,
  is_banned           BOOLEAN DEFAULT FALSE,

  last_seen           TIMESTAMPTZ DEFAULT NOW(),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Run logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS run_logs (
  id           BIGSERIAL PRIMARY KEY,
  telegram_id  TEXT NOT NULL,
  score        INTEGER DEFAULT 0,
  coins        INTEGER DEFAULT 0,
  distance     INTEGER DEFAULT 0,
  duration     INTEGER DEFAULT 0,   -- seconds
  suspicious   BOOLEAN DEFAULT FALSE,
  flags        TEXT[]  DEFAULT ARRAY[]::TEXT[],
  session_id   TEXT,
  sig          TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_run_player FOREIGN KEY (telegram_id) REFERENCES players(telegram_id) ON DELETE CASCADE
);

-- ── Referrals ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id           BIGSERIAL PRIMARY KEY,
  referrer_id  TEXT NOT NULL,
  referred_id  TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT uq_referral UNIQUE (referrer_id, referred_id)
);

-- ── Purchases ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id           BIGSERIAL PRIMARY KEY,
  telegram_id  TEXT NOT NULL,
  item_id      TEXT NOT NULL,
  item_type    TEXT NOT NULL,   -- 'character' | 'egg'
  cost         INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Admin logs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_logs (
  id           BIGSERIAL PRIMARY KEY,
  action       TEXT NOT NULL,  -- 'ban' | 'unban' | 'manual_score'
  target_id    TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes for performance ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_players_best_score    ON players(best_score DESC);
CREATE INDEX IF NOT EXISTS idx_players_telegram_id   ON players(telegram_id);
CREATE INDEX IF NOT EXISTS idx_run_logs_telegram_id  ON run_logs(telegram_id);
CREATE INDEX IF NOT EXISTS idx_run_logs_created_at   ON run_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_run_logs_suspicious   ON run_logs(suspicious) WHERE suspicious = TRUE;
CREATE INDEX IF NOT EXISTS idx_referrals_referrer    ON referrals(referrer_id);

-- ── Row Level Security (RLS) ───────────────────────────────
ALTER TABLE players    ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases  ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

-- Allow anon key full access (the game uses anon key with security enforced in app layer)
-- For production: restrict to specific telegram_id matching via JWT claims

CREATE POLICY "allow_anon_all_players"   ON players    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_anon_all_runlogs"   ON run_logs   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_anon_all_referrals" ON referrals  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_anon_all_purchases" ON purchases  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_anon_all_adminlogs" ON admin_logs FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── Useful views ───────────────────────────────────────────

-- Weekly leaderboard view
CREATE OR REPLACE VIEW weekly_leaderboard AS
SELECT
  r.telegram_id,
  p.username,
  p.display_name,
  p.photo_url,
  p.equipped_character,
  MAX(r.score)    AS best_score,
  MAX(r.distance) AS best_distance
FROM run_logs r
JOIN players p ON p.telegram_id = r.telegram_id
WHERE r.created_at >= NOW() - INTERVAL '7 days'
  AND r.suspicious = FALSE
  AND p.is_banned = FALSE
GROUP BY r.telegram_id, p.username, p.display_name, p.photo_url, p.equipped_character
ORDER BY best_score DESC
LIMIT 50;

-- Global stats view
CREATE OR REPLACE VIEW global_stats AS
SELECT
  COUNT(DISTINCT telegram_id)          AS total_players,
  SUM(total_runs)                      AS total_runs,
  SUM(total_coins)                     AS total_coins_ever,
  AVG(best_score)                      AS avg_best_score,
  MAX(best_score)                      AS highest_score,
  MAX(best_distance)                   AS longest_run,
  COUNT(*) FILTER (WHERE is_banned)    AS banned_players,
  COUNT(*) FILTER (WHERE wallet_address IS NOT NULL) AS wallets_linked
FROM players;

-- ═══════════════════════════════════════════════════════════
-- DONE! Tables created. Now drop your assets in /assets/ and deploy.
-- ═══════════════════════════════════════════════════════════
