-- Owner 27 Oct: "admin mai ek section ye v bnao ki adsence se hume kitna reveneue aaya hai"
-- Daily AdSense earnings cache. Micros integers (currency * 1e6) so sums never drift.
-- source: 'adsense_api' (live Management API) or 'adsense_csv' (owner's UI export).
CREATE TABLE IF NOT EXISTS adsense_daily (
  day DATE NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'adsense_api',
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  earnings_micros BIGINT NOT NULL DEFAULT 0,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  page_views BIGINT NOT NULL DEFAULT 0,
  rpm_micros BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (day, source),
  KEY idx_adsense_day (day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS adsense_sync_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind VARCHAR(20) NOT NULL,              -- api | csv
  ok TINYINT(1) NOT NULL,
  rows_seen INT NOT NULL DEFAULT 0,
  message VARCHAR(400) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_adsense_sync (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
