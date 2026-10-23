-- 020: hero carousel slides (owner 23 Oct — BookMyShow-style mixed carousel:
-- movie / food / ecom). Adds hero-slide columns to home_banners so the admin
-- can author custom hero slides; live-composed movie+food+ecom slides come
-- from real data automatically (server/home/heroBanners.ts) and rotate after
-- any admin customs. Existing wide banners keep working unchanged.
ALTER TABLE home_banners
  ADD COLUMN badge VARCHAR(40) NULL,
  ADD COLUMN heading VARCHAR(160) NULL,
  ADD COLUMN subheading VARCHAR(200) NULL,
  ADD COLUMN meta VARCHAR(200) NULL,
  ADD COLUMN language VARCHAR(60) NULL,
  ADD COLUMN synopsis TEXT NULL,
  ADD COLUMN poster_url VARCHAR(600) NULL,
  ADD COLUMN cta VARCHAR(40) NULL;

-- Rows with poster_url set become HERO slides; rows without stay wide strips.
