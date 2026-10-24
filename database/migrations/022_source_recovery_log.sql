-- 022: SOURCE RECOVERY LOG (owner 24 Oct — "kabhi band na ho" rule): the
-- recovery scanner probes broken/gated sources in the background; every
-- automatic RECOVERY it detects is recorded here so the owner can see, in
-- production, which sources came back on their own and when.
CREATE TABLE IF NOT EXISTS source_recovery_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  source_id VARCHAR(64) NOT NULL,
  source_name VARCHAR(120) NULL,
  vertical VARCHAR(32) NULL,
  prior_state VARCHAR(24) NOT NULL,
  prior_failure_class VARCHAR(48) NULL,
  probe_query VARCHAR(200) NULL,
  rows_found INT NOT NULL DEFAULT 0,
  detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_source_detected (source_id, detected_at),
  KEY idx_detected (detected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
