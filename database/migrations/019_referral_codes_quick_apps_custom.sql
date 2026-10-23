-- Owner 23 Oct: referral CODES (shareable per-user, verified at sign-in) and
-- admin-managed manual Quick Apps entries.
ALTER TABLE users ADD COLUMN referral_code VARCHAR(20) NULL, ADD UNIQUE KEY uq_referral_code (referral_code);

CREATE TABLE IF NOT EXISTS quick_apps_custom (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  web_url VARCHAR(500) NOT NULL,
  icon_url VARCHAR(500) NULL,
  category VARCHAR(60) NULL,
  badge VARCHAR(40) NULL,
  description VARCHAR(500) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Owner 23 Oct: dynamic home banners (wide landscape strips between home
-- sections, web + app). Seeded with the owner-attached Jailer banner linking
-- to the Movies vertical.
CREATE TABLE IF NOT EXISTS home_banners (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  image_url VARCHAR(600) NOT NULL,
  link_url VARCHAR(600) NOT NULL DEFAULT 'movies',
  title VARCHAR(120) NULL,
  subtitle VARCHAR(200) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO home_banners (image_url, link_url, title, subtitle, is_active, position)
VALUES ('https://www.try1second.com/banners/jailer.jpg', 'movies', 'Jailer', 'Superstar is here — book movie tickets', 1, 0);
