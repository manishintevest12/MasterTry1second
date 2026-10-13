-- Module 4: admin-managed affiliate profiles (deeplink interceptor).
-- Mirrors docs/BROWSERLESS-ACQUISITION-BLUEPRINT.md section 1.
CREATE TABLE IF NOT EXISTS affiliate_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(64) NOT NULL,
  company_domain VARCHAR(190) NOT NULL,
  network ENUM('cuelinks','vcommission','admitad','optimise','direct') NOT NULL,
  campaign_key VARCHAR(160) NULL,
  template VARCHAR(500) NOT NULL,
  subid_param VARCHAR(40) DEFAULT 'subid',
  extra_params JSON NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_affcfg_slug (slug), KEY k_affcfg_domain (company_domain)
) ENGINE=InnoDB;
