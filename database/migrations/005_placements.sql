-- Admin-managed marketing placements (Section 19 admin + Section 6 honesty).
-- Top Picks: admin-curated sponsored picks per vertical; shown ONLY when an admin
-- adds them. Ad slots: AdSense or custom-HTML ad configuration per slot key.

CREATE TABLE IF NOT EXISTS top_picks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  vertical VARCHAR(32) NOT NULL,
  partner_name VARCHAR(120) NOT NULL,
  partner_code VARCHAR(16) DEFAULT NULL,
  badge_text VARCHAR(60) DEFAULT 'Sponsored Top Pick',
  headline VARCHAR(200) NOT NULL,
  offer_text VARCHAR(400) DEFAULT NULL,
  price_badge VARCHAR(60) DEFAULT NULL,
  perks TEXT DEFAULT NULL,              -- JSON array of strings
  cta_text VARCHAR(80) DEFAULT 'View Deal',
  destination_url VARCHAR(500) NOT NULL,
  image_url VARCHAR(500) DEFAULT NULL,
  logo_bg VARCHAR(40) DEFAULT 'bg-slate-900',
  logo_text VARCHAR(8) DEFAULT NULL,
  rating DECIMAL(3,1) DEFAULT 0,       -- 0 = not shown (never fabricated)
  position INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_top_picks_vertical (vertical, is_active, position)
);

CREATE TABLE IF NOT EXISTS ad_slots (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  slot_key VARCHAR(60) NOT NULL,       -- e.g. feed_top, sidebar_top
  provider VARCHAR(20) NOT NULL DEFAULT 'adsense', -- adsense | custom_html
  adsense_client VARCHAR(60) DEFAULT NULL,  -- ca-pub-XXXXXXXX
  adsense_slot VARCHAR(60) DEFAULT NULL,     -- ad unit slot id
  custom_html TEXT DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ad_slot_key (slot_key)
);
