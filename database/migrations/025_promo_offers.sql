-- Owner 27 Oct: "admin mai offer coupon cashback ye sb v add kr ske manually jisme image
-- upload affiliate sb ho aur wo coupon, offer redirection page pr copy v ho."
-- One table for every manual promo per merchant; the /redirect exit page reads it and
-- gives the user a one-tap "Copy code".
CREATE TABLE IF NOT EXISTS promo_offers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  merchant_slug VARCHAR(80) NOT NULL,
  merchant_domain VARCHAR(160) NOT NULL,
  kind VARCHAR(20) NOT NULL DEFAULT 'coupon',      -- coupon | offer | cashback
  title VARCHAR(200) NOT NULL,
  code VARCHAR(60) NULL,                            -- coupon code (copyable)
  discount_label VARCHAR(80) NULL,                  -- '₹500 OFF' | '10% cashback'
  description VARCHAR(500) NULL,
  image_url VARCHAR(500) NULL,                      -- admin upload (/api/logos/<key>) or https image
  url VARCHAR(700) NULL,                            -- destination; blank = merchant home
  affiliate_url VARCHAR(900) NULL,                  -- our tracking template, {url} = destination
  starts_at DATE NULL,
  ends_at DATE NULL,
  priority INT NOT NULL DEFAULT 100,                -- lower shows first
  active TINYINT(1) NOT NULL DEFAULT 1,
  clicks INT NOT NULL DEFAULT 0,
  copies INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_promo_merchant (merchant_slug, active),
  KEY idx_promo_domain (merchant_domain, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
