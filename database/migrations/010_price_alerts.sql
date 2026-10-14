-- 010: price_alerts — real "tell me when it drops" alerts set from the in-site product page.
-- Notified by email (Resend) when a live re-check finds a verified price <= target_price.
CREATE TABLE IF NOT EXISTS price_alerts (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT          NOT NULL,
  email          VARCHAR(190) NOT NULL,
  product_title  VARCHAR(300) NOT NULL,
  search_query   VARCHAR(300) NOT NULL,          -- what we re-search to check the price
  source_url     VARCHAR(1000) DEFAULT NULL,     -- the link the user pasted
  image          VARCHAR(1000) DEFAULT NULL,
  target_price   INT          NOT NULL,
  price_at_set   INT          DEFAULT NULL,
  last_price     INT          DEFAULT NULL,
  last_checked_at TIMESTAMP   NULL DEFAULT NULL,
  notified_at    TIMESTAMP    NULL DEFAULT NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  KEY ix_alert_user (user_id),
  KEY ix_alert_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
