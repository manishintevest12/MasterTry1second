-- 018: seed the redirect_interstitial ad slot (owner 23 Oct): the AdSense
-- display unit created in the dashboard after site verification passed
-- (ads.txt method, pub-3144522772064172, ad slot 5073410342).
-- INSERT IGNORE is deliberate: if the owner later edits the slot through the
-- admin panel, this migration never overwrites their choice; it only seeds
-- the row when it does not exist yet. Ads render once the AdSense site
-- review approves the account.
INSERT IGNORE INTO ad_slots (slot_key, provider, adsense_client, adsense_slot, is_active)
VALUES ('redirect_interstitial', 'adsense', 'ca-pub-3144522772064172', '5073410342', 1);
