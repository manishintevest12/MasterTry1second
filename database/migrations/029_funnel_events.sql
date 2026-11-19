-- 029_funnel_events.sql
--
-- Funnel telemetry (owner 19 Nov growth brief): "Instrument clear funnel events across search,
-- results, card clicks, outbound redirects, shares, and repeat sessions so optimization focuses on
-- real drop-off points and retention rather than vanity metrics."
--
-- Until now the only behavioural data was `searches` and `affiliate_clicks`, so nobody could see where
-- a user leaves: did they search and see nothing, see results and never click, click and never leave for
-- the merchant? This table is the missing middle of that chain.
--
-- Deliberate limits:
--   * NO IP, user agent, email or phone is stored. `session_id` is a client-generated random id that the
--     user can reset by clearing storage; `user_id` is our own numeric id when the caller is signed in.
--   * `query` is the search text (product data, not personal data) and is scrubbed of anything that looks
--     like an email or a long digit string before insert.
--   * One row per event, append-only, no updates. Retention is handled by the existing prune job.

CREATE TABLE IF NOT EXISTS funnel_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event VARCHAR(40) NOT NULL,
  session_id VARCHAR(64) NOT NULL DEFAULT '',
  user_id BIGINT UNSIGNED NULL,
  vertical VARCHAR(24) NOT NULL DEFAULT '',
  query VARCHAR(200) NOT NULL DEFAULT '',
  item_id VARCHAR(120) NOT NULL DEFAULT '',
  seller VARCHAR(80) NOT NULL DEFAULT '',
  city VARCHAR(60) NOT NULL DEFAULT '',
  platform VARCHAR(16) NOT NULL DEFAULT '',
  value DECIMAL(12,2) NULL,
  meta VARCHAR(512) NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_funnel_event_time (event, created_at),
  KEY idx_funnel_session (session_id),
  KEY idx_funnel_vertical_time (vertical, created_at)
) ENGINE=InnoDB;
