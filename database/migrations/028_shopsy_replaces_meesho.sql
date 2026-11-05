-- Owner 5 Nov 2026: Meesho is dropped from the e-commerce registry and Shopsy
-- (shopsy.in, Flipkart-owned) takes its place. Shopsy is monetised through the
-- Cuelinks account we already hold (publisher 278473, channel cid 326794), so the
-- row lands on network='cuelinks' with a NULL template: buildSecureDeeplink() then
-- uses the verified linkkit path (linksredirect.com/?cid=…&subid=278473&url=…)
-- instead of an invented URL. cuelinksMerchantUrl() also whitelists shopsy.in.
SET NAMES utf8mb4;

-- 1. Meesho exits stop being monetised / offered.
UPDATE affiliate_configs
   SET active = 0
 WHERE slug IN ('meesho')
    OR company_domain IN ('meesho.com', 'www.meesho.com');

-- 2. Shopsy joins the registry as a Cuelinks campaign (idempotent: INSERT IGNORE on
--    the uq_affcfg_slug unique key never overwrites an ID the owner already saved).
INSERT IGNORE INTO affiliate_configs
  (slug, company_domain, vertical, display_name, network, affiliate_id, monetization, template, subid_param, active)
VALUES
  ('shopsy', 'shopsy.in', 'ecommerce', 'Shopsy', 'cuelinks', NULL, 'affiliate', NULL, 'subid', 1);
