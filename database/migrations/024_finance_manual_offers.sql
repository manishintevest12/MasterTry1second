-- Owner 27 Oct: "muje option do loan, credit card, insurance, account verticals ka
-- manually v add krne ka" — manual finance inventory.
--
-- Manual finance entries live in the existing `offers` table (MySQL stays the single
-- source of truth) flagged with attributes.manual = 1 and source_id 'admin_manual', so
-- every existing vertical feed / comparison card / lead form picks them up with no
-- parallel pipeline. This migration only adds the index the admin list needs.
SET NAMES utf8mb4;

CREATE INDEX IF NOT EXISTS idx_offers_manual_finance ON offers (vertical, source_id);

-- Audit of who typed what (the offers row keeps the content; this keeps the trail).
CREATE TABLE IF NOT EXISTS finance_manual_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  offer_id BIGINT UNSIGNED NOT NULL,
  vertical VARCHAR(30) NOT NULL,
  action ENUM('create','update','delete') NOT NULL,
  actor VARCHAR(120) NULL,
  snapshot JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY k_fml_offer (offer_id),
  KEY k_fml_vertical (vertical, created_at)
) ENGINE=InnoDB;
