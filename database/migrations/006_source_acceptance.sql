-- 006: Section 16 mandatory source-by-source acceptance testing results.
-- One row per (source, capability) live test. Evidence-based statuses only; no mock rows.
CREATE TABLE IF NOT EXISTS source_acceptance_tests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_id VARCHAR(80) NOT NULL,
  source_name VARCHAR(120) NOT NULL,
  vertical VARCHAR(30) NOT NULL,
  capability VARCHAR(80) NOT NULL,
  status VARCHAR(30) NOT NULL,
  failure_category VARCHAR(40) NULL,
  http_status INT NULL,
  bytes INT NULL,
  latency_ms INT NULL,
  items_extracted INT NULL,
  fields_verified TEXT NULL,
  evidence TEXT NULL,
  next_action VARCHAR(300) NULL,
  tested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_source_capability (source_id, capability)
);
