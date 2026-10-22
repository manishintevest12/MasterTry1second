-- 017: app_settings key-value store (22 Oct, owner request: Uber/Ola in-app
-- booking deep links with admin-editable affiliate parameters end to end).
-- Admin-managed runtime config that is NOT a secret (secrets stay in env):
-- cab booking deeplink client ids / utm affiliate params.
CREATE TABLE IF NOT EXISTS `app_settings` (
  `k` VARCHAR(64) PRIMARY KEY,
  `v` MEDIUMTEXT NOT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
