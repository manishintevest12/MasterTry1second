-- 021: colourful hero/section banners (owner 24 Oct — "abhi sb black banner
-- hai, colourful v rakho"). Every hero slide and section strip now carries a
-- vibrant brand gradient; live-composed slides get one per kind server-side
-- (movie rose-red, food orange, ecom red->orange) and admin-authored rows can
-- override the pairing with their own start/end hex.
ALTER TABLE home_banners
  ADD COLUMN gradient_start VARCHAR(9) NULL,
  ADD COLUMN gradient_end VARCHAR(9) NULL;
