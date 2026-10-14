-- 012: deals — merchant-wise offers, coupon codes, bank/card/gift-card/loan/insurance/movie offers.
-- Managed from Admin -> Deals. Affiliate IDs are NEVER stored here: the click goes through
-- /api/out (masking pointer) and buildSecureDeeplink() attaches the affiliate profile server-side.
CREATE TABLE IF NOT EXISTS deals (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  merchant_key  VARCHAR(60)  NOT NULL,          -- flipkart | amazon | myntra | ajio | tatacliq | meesho | bookmyshow | district | ticketnew | hdfc-bank ...
  merchant_name VARCHAR(120) NOT NULL,
  kind          VARCHAR(24)  NOT NULL,          -- bank_offer | coupon | gift_card | credit_card | loan | insurance | movie | cashback | sale
  title         VARCHAR(200) NOT NULL,
  description   VARCHAR(600) DEFAULT NULL,
  code          VARCHAR(60)  DEFAULT NULL,      -- coupon code, shown + copy button
  discount_text VARCHAR(80)  DEFAULT NULL,      -- "10% off up to Rs 1,500"
  min_order     INT          DEFAULT NULL,
  terms         VARCHAR(600) DEFAULT NULL,
  dest_url      VARCHAR(1000) NOT NULL,         -- the merchant page the customer lands on
  image_url     VARCHAR(500)  DEFAULT NULL,      -- merchant's own product/banner image
  valid_till    DATE         DEFAULT NULL,
  sort_weight   INT          NOT NULL DEFAULT 0,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  clicks        INT          NOT NULL DEFAULT 0,
  source        VARCHAR(16)  NOT NULL DEFAULT 'admin',   -- admin | auto (cffi-acquired)
  dedupe_key    VARCHAR(180) DEFAULT NULL,               -- auto deals: stable merchant+item key
  last_seen_at  TIMESTAMP    NULL,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_deal_merchant (merchant_key, is_active),
  INDEX idx_deal_kind (kind, is_active),
  INDEX idx_deal_source (source, last_seen_at),
  INDEX idx_deal_dedupe (dedupe_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
