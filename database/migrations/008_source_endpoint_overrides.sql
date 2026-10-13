-- 008: source_endpoint_overrides — durable endpoint config written by the
-- DynamicScannerEngine (self-healing). Workers read these at acquisition time;
-- the code default stays the fallback when no override row exists.
CREATE TABLE IF NOT EXISTS source_endpoint_overrides (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  source_id     VARCHAR(120) NOT NULL,
  rule_key      VARCHAR(80)  NOT NULL,
  value         VARCHAR(500) NOT NULL,
  evidence_url  VARCHAR(500) NULL,
  bundle_url    VARCHAR(500) NULL,
  healed_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_source_rule (source_id, rule_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
