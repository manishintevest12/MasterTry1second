-- 014: spend_lens — personal spend tracker ("Spend Lens").
-- Only USER-CONFIRMED purchases count: entries are added manually or prefilled
-- from a Buy-click redirect the user confirms. No spend is ever inferred,
-- estimated or fabricated from clicks alone (honest-data policy).
CREATE TABLE IF NOT EXISTS spend_entries (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT          NOT NULL,
  merchant       VARCHAR(190) NOT NULL,          -- site name or domain (e.g. 'Amazon.in')
  amount         INT          NOT NULL,          -- confirmed spend in whole rupees
  item_title     VARCHAR(300) DEFAULT NULL,
  vertical       VARCHAR(40)  DEFAULT NULL,
  entry_date     DATE         NOT NULL,          -- when the purchase happened
  source         VARCHAR(20)  NOT NULL DEFAULT 'manual',  -- 'manual' | 'redirect'
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  KEY ix_spend_user (user_id),
  KEY ix_spend_date (entry_date),
  KEY ix_spend_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
