-- Try1Second initial schema (Section 16 — logical inventory)
-- MySQL/MariaDB durable source of truth. Optimized for KVM4 (modest CPU/RAM):
-- InnoDB, FKs where they aid integrity, indexes on all hot lookup paths.

-- ============ Identity & access ============
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(120),
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  referred_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_user (user_id)
) ENGINE=InnoDB;

-- ============ Catalogue (Section 7) ============
CREATE TABLE IF NOT EXISTS canonical_entities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vertical ENUM('food','grocery','ecommerce','flights','hotels','cab','loans','insurance','movies','bus','coupons','giftcards','banking') NOT NULL,
  name VARCHAR(500) NOT NULL,
  brand VARCHAR(160),
  model VARCHAR(160),
  category VARCHAR(160),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_entity (vertical, name(191)),
  INDEX idx_entities_vertical (vertical)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS entity_aliases (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  alias VARCHAR(500) NOT NULL,
  source VARCHAR(120),
  FOREIGN KEY (entity_id) REFERENCES canonical_entities(id) ON DELETE CASCADE,
  INDEX idx_alias (alias(191))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS entity_identifiers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  id_type ENUM('gtin','ean','upc','mpn','sku','vendor_product_id','internal') NOT NULL,
  id_value VARCHAR(190) NOT NULL,
  FOREIGN KEY (entity_id) REFERENCES canonical_entities(id) ON DELETE CASCADE,
  UNIQUE KEY uq_ident (id_type, id_value)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS entity_variants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  variant_key VARCHAR(255) NOT NULL, -- e.g. "color=black|storage=128gb"
  attributes JSON,
  FOREIGN KEY (entity_id) REFERENCES canonical_entities(id) ON DELETE CASCADE,
  UNIQUE KEY uq_variant (entity_id, variant_key)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vendors (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  domain VARCHAR(255)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sellers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendor_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  city VARCHAR(120),
  pincode VARCHAR(12),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  UNIQUE KEY uq_seller (vendor_id, name)
) ENGINE=InnoDB;

-- ============ Source management (Sections 4, 9, 20) ============
CREATE TABLE IF NOT EXISTS source_adapters (
  id VARCHAR(120) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  method ENUM('direct_http','structured_data','affiliate_feed','partner_feed','official_api','search_provider') NOT NULL,
  verticals JSON NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  priority INT NOT NULL DEFAULT 100,
  config JSON, -- credentials redacted from API responses
  rate_limit_pm INT NOT NULL DEFAULT 30,
  max_concurrency INT NOT NULL DEFAULT 2,
  adapter_version VARCHAR(40) NOT NULL DEFAULT '1.0.0',
  parser_version VARCHAR(40) NOT NULL DEFAULT '1.0.0',
  requires_authorization BOOLEAN NOT NULL DEFAULT FALSE,
  retention_permitted BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS source_health (
  source_id VARCHAR(120) PRIMARY KEY,
  state ENUM('HEALTHY','DEGRADED','CIRCUIT_OPEN','UNVERIFIED','DISABLED') NOT NULL DEFAULT 'UNVERIFIED',
  consecutive_failures INT NOT NULL DEFAULT 0,
  last_success_at TIMESTAMP NULL,
  last_failure_at TIMESTAMP NULL,
  last_failure_class VARCHAR(40) NULL,
  circuit_open_until TIMESTAMP NULL,
  total_attempts INT NOT NULL DEFAULT 0,
  total_successes INT NOT NULL DEFAULT 0,
  avg_latency_ms INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS source_jobs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source_id VARCHAR(120) NOT NULL,
  job_type VARCHAR(60) NOT NULL, -- refresh | health_check | feed_sync
  status ENUM('queued','running','succeeded','failed','dead_letter') NOT NULL DEFAULT 'queued',
  attempts INT NOT NULL DEFAULT 0,
  payload JSON,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP NULL,
  INDEX idx_jobs_status (status, created_at),
  INDEX idx_jobs_source (source_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS source_evidence (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  offer_id BIGINT UNSIGNED NOT NULL,
  source_id VARCHAR(120) NOT NULL,
  source_method VARCHAR(40) NOT NULL,
  source_url TEXT,
  source_reference VARCHAR(500),
  fetched_at TIMESTAMP NOT NULL,
  extracted_fields JSON,
  evidence_hash CHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_evidence_offer (offer_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS validation_records (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  offer_id BIGINT UNSIGNED NOT NULL,
  validation_status ENUM('VALID','INVALID','PARTIAL') NOT NULL,
  checks JSON,
  confidence DECIMAL(4,3) NOT NULL,
  validated_at TIMESTAMP NOT NULL,
  INDEX idx_validation_offer (offer_id)
) ENGINE=InnoDB;

-- ============ Offers & price history ============
CREATE TABLE IF NOT EXISTS offers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  canonical_entity_id BIGINT UNSIGNED NULL,
  canonical_variant_id BIGINT UNSIGNED NULL,
  vertical ENUM('food','grocery','ecommerce','flights','hotels','cab','loans','insurance','movies','bus','coupons','giftcards','banking') NOT NULL,
  title VARCHAR(500) NOT NULL,
  brand VARCHAR(160),
  model VARCHAR(160),
  identifiers JSON,
  attributes JSON,
  vendor VARCHAR(255) NOT NULL,
  seller VARCHAR(255) NOT NULL,
  seller_url TEXT,
  location_pincode VARCHAR(12),
  location_city VARCHAR(120),
  travel JSON,
  list_price DECIMAL(12,2) NULL,
  mandatory_total DECIMAL(12,2) NULL,
  effective_price DECIMAL(12,2) NULL,
  verified_savings DECIMAL(12,2) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  fees JSON,
  availability ENUM('in_stock','out_of_stock','unknown') NOT NULL DEFAULT 'unknown',
  match_state ENUM('MATCHED','PROBABLE_MATCH','REVIEW_REQUIRED','NOT_MATCHED') NOT NULL DEFAULT 'NOT_MATCHED',
  match_evidence VARCHAR(500) NULL,
  freshness_status ENUM('LIVE_VERIFIED','FRESH','CACHED_VERIFIED','AGING','STALE','EXPIRED','PARTIAL','UNVERIFIED','SOURCE_UNAVAILABLE','INVALID','UNKNOWN') NOT NULL DEFAULT 'UNVERIFIED',
  validation_status ENUM('VALID','INVALID','PARTIAL') NOT NULL DEFAULT 'PARTIAL',
  confidence DECIMAL(4,3) NOT NULL DEFAULT 0.0,
  source_id VARCHAR(120) NOT NULL,
  source_method VARCHAR(40) NOT NULL,
  source_url TEXT,
  affiliate_network VARCHAR(120) NULL,
  affiliate_deep_link TEXT NULL,
  fetched_at TIMESTAMP NOT NULL,
  validated_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_offers_entity (canonical_entity_id),
  INDEX idx_offers_vertical (vertical, freshness_status),
  INDEX idx_offers_source (source_id),
  INDEX idx_offers_geo (location_pincode, vertical)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS price_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  offer_id BIGINT UNSIGNED NOT NULL,
  canonical_entity_id BIGINT UNSIGNED NULL,
  mandatory_total DECIMAL(12,2) NULL,
  effective_price DECIMAL(12,2) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  source_id VARCHAR(120) NOT NULL,
  freshness_status VARCHAR(30) NOT NULL,
  captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_history_offer (offer_id, captured_at),
  INDEX idx_history_entity (canonical_entity_id, captured_at)
) ENGINE=InnoDB;

-- ============ Coupons / bank offers / gift cards ============
CREATE TABLE IF NOT EXISTS coupons (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  merchant VARCHAR(255) NOT NULL,
  code VARCHAR(120) NULL,
  description VARCHAR(500) NOT NULL,
  discount_type ENUM('flat','percent','unknown') NOT NULL DEFAULT 'unknown',
  discount_value DECIMAL(12,2) NULL,
  min_spend DECIMAL(12,2) NULL,
  max_discount DECIMAL(12,2) NULL,
  eligibility TEXT,
  expires_at TIMESTAMP NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  source_id VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_coupons_merchant (merchant)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bank_offers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bank VARCHAR(160) NOT NULL,
  card_type VARCHAR(160) NULL,
  offer_text VARCHAR(500) NOT NULL,
  min_spend DECIMAL(12,2) NULL,
  max_discount DECIMAL(12,2) NULL,
  valid_from DATE NULL,
  valid_to DATE NULL,
  eligibility TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  source_id VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gift_cards (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  merchant VARCHAR(255) NOT NULL,
  denomination DECIMAL(12,2) NOT NULL,
  sale_price DECIMAL(12,2) NULL,
  discount_percent DECIMAL(5,2) NULL,
  validity_months INT NULL,
  source_id VARCHAR(120) NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============ Affiliate (Section 15) ============
CREATE TABLE IF NOT EXISTS affiliate_networks (
  id VARCHAR(120) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  config JSON NOT NULL, -- API key, campaign templates (redacted in API responses)
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS affiliate_links (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  network_id VARCHAR(120) NOT NULL,
  vendor_domain VARCHAR(255) NOT NULL,
  destination_url TEXT NOT NULL,
  deep_link_template TEXT NOT NULL,
  campaign_id VARCHAR(160) NULL,
  sub_id VARCHAR(160) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_afflink (network_id, vendor_domain, destination_url(191))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  offer_id BIGINT UNSIGNED NULL,
  network_id VARCHAR(120) NOT NULL,
  vendor_domain VARCHAR(255) NOT NULL,
  destination_url TEXT NOT NULL,
  click_id VARCHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_clicks_offer (offer_id),
  INDEX idx_clicks_time (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS affiliate_conversions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  click_id VARCHAR(64) NOT NULL,
  network_id VARCHAR(120) NOT NULL,
  order_value DECIMAL(12,2) NULL,
  commission DECIMAL(12,2) NULL,
  confirmed_at TIMESTAMP NULL,
  source_report VARCHAR(255) NOT NULL, -- which authorized report confirmed it
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_conversion (click_id)
) ENGINE=InnoDB;

-- ============ Search & analytics (Section 20) ============
CREATE TABLE IF NOT EXISTS searches (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  raw_query VARCHAR(500) NOT NULL,
  vertical VARCHAR(30) NULL,
  detected_vertical VARCHAR(30) NULL,
  pincode VARCHAR(12) NULL,
  city VARCHAR(120) NULL,
  served_from VARCHAR(20) NOT NULL,
  results_count INT NOT NULL DEFAULT 0,
  latency_ms INT NOT NULL DEFAULT 0,
  first_result_ms INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_searches_time (created_at),
  INDEX idx_searches_vertical (vertical, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS feature_flags (
  name VARCHAR(120) PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS system_config (
  config_key VARCHAR(190) PRIMARY KEY,
  config_value JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor VARCHAR(190) NOT NULL,
  action VARCHAR(190) NOT NULL,
  target VARCHAR(255) NULL,
  details JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_time (created_at)
) ENGINE=InnoDB;

-- ============ Rewards: referrals, points, spins (Section 18) ============
CREATE TABLE IF NOT EXISTS referrals (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  referrer_id BIGINT UNSIGNED NOT NULL,
  referee_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending','valid','invalid') NOT NULL DEFAULT 'pending',
  validated_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_referral (referrer_id, referee_id),
  FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (referee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS referral_point_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  referral_id BIGINT UNSIGNED NOT NULL,
  points INT NOT NULL DEFAULT 1,
  awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_point_event (referral_id), -- exactly one +1 point per valid referral
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (referral_id) REFERENCES referrals(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS spin_eligibilities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  consumed_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_elig_user (user_id, consumed_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prizes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description VARCHAR(500) NULL,
  weight INT NOT NULL DEFAULT 1, -- relative probability weight, admin-configured
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prize_inventory (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  prize_id BIGINT UNSIGNED NOT NULL,
  quantity INT NOT NULL,
  FOREIGN KEY (prize_id) REFERENCES prizes(id) ON DELETE CASCADE,
  UNIQUE KEY uq_prize_inventory (prize_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS spins (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  eligibility_id BIGINT UNSIGNED NOT NULL,
  prize_id BIGINT UNSIGNED NULL,
  idempotency_key VARCHAR(120) NOT NULL,
  result_visible_to_user BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_spin_eligibility (eligibility_id), -- one eligibility → at most one successful spin
  UNIQUE KEY uq_spin_idempotency (user_id, idempotency_key), -- duplicate requests are idempotent
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (eligibility_id) REFERENCES spin_eligibilities(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fulfilment_records (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  spin_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  prize_id BIGINT UNSIGNED NOT NULL,
  status ENUM('PENDING','CONTACT_REQUIRED','APPROVED','SENT','DELIVERED','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  contact_name VARCHAR(160) NULL, -- only collected data: name, phone, location
  contact_phone VARCHAR(30) NULL,
  contact_location VARCHAR(500) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fulfilment_spin (spin_id),
  FOREIGN KEY (spin_id) REFERENCES spins(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============ Alerts ============
CREATE TABLE IF NOT EXISTS alerts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  vertical VARCHAR(30) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  target_price DECIMAL(12,2) NULL,
  pincode VARCHAR(12) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_alerts_user (user_id, active)
) ENGINE=InnoDB;

-- ============ AI outputs (Section 10: AI assists understanding, never invents data) ============
CREATE TABLE IF NOT EXISTS ai_outputs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purpose VARCHAR(120) NOT NULL, -- query_understanding | candidate_matching
  input_hash CHAR(64) NOT NULL,
  output JSON NOT NULL,
  model VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_purpose (purpose, created_at)
) ENGINE=InnoDB;
