-- 009: app_links — admin-managed download/install links shown in the website
-- footer and the mobile app (Chrome extension, Android app, iOS app).
-- Nothing is hardcoded: a link is shown only when an admin has saved one.
CREATE TABLE IF NOT EXISTS app_links (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  link_key    VARCHAR(40)  NOT NULL,          -- chrome_extension | android_app | ios_app
  url         VARCHAR(500) NOT NULL,
  version     VARCHAR(30)  DEFAULT NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_app_link_key (link_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
