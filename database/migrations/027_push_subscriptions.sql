-- 027: device push subscriptions (29 Oct, owner request: real device push with image).
-- kind 'webpush' = browser / installed PWA (VAPID endpoint + p256dh/auth keys).
-- kind 'fcm'     = Android app (Firebase registration token; keys stay NULL).
-- Rows are deactivated automatically on 404/410 from the push service or after
-- repeated failures, so the table self-heals instead of piling up dead endpoints.
CREATE TABLE IF NOT EXISTS `push_subscriptions` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `kind` VARCHAR(16) NOT NULL DEFAULT 'webpush',
  `endpoint` TEXT NOT NULL,
  `endpoint_hash` CHAR(64) NOT NULL,
  `p256dh` VARCHAR(255) NULL,
  `auth` VARCHAR(255) NULL,
  `ua` VARCHAR(255) NULL,
  `is_active` TINYINT NOT NULL DEFAULT 1,
  `fail_count` INT NOT NULL DEFAULT 0,
  `last_ok_at` DATETIME NULL,
  `last_fail_at` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_endpoint_hash` (`endpoint_hash`),
  KEY `idx_user` (`user_id`),
  KEY `idx_active_kind` (`is_active`, `kind`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
