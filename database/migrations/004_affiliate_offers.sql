-- 004: Unified affiliate offers aggregator (multi-network, Section: Affiliate Engine)
-- Every network normalizes into ONE schema; unique compound index drives upserts.
CREATE TABLE IF NOT EXISTS affiliate_offers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  network_source VARCHAR(32) NOT NULL,
  network_offer_id VARCHAR(128) NOT NULL,
  merchant_name VARCHAR(255) NOT NULL,
  merchant_logo VARCHAR(1024) NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT NULL,
  coupon_code VARCHAR(128) NULL,
  discount_value DECIMAL(12,2) NULL,
  discount_type VARCHAR(32) NULL,
  affiliate_url VARCHAR(2048) NULL,
  original_url VARCHAR(2048) NULL,
  categories VARCHAR(512) NULL,
  starts_at DATETIME NULL,
  expires_at DATETIME NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  commission_note VARCHAR(255) NULL,
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_network_offer (network_source, network_offer_id),
  INDEX idx_status_expiry (status, expires_at),
  INDEX idx_merchant (merchant_name),
  INDEX idx_categories (categories(64))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Click attribution (affiliate-safe redirects, Section 15)
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  offer_id BIGINT UNSIGNED NOT NULL,
  network_source VARCHAR(32) NOT NULL,
  sub_id VARCHAR(128) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_offer (offer_id),
  INDEX idx_network_time (network_source, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
