-- 016: vertical columns to VARCHAR (21 Oct).
-- 001_init originally declared offers.vertical / canonical_entities.vertical as an
-- ENUM with a fixed vertical list. The platform registry is dynamic (creditcards,
-- account, and future verticals), and MySQL/MariaDB strict mode REJECTS any value
-- outside the ENUM with "Data truncated for column 'vertical'" — silently losing
-- every creditcards/account offer/entity row. VARCHAR(30) accepts any registry id.
-- 001_init now writes VARCHAR for FRESH databases; this migration converts any
-- database that already ran the original 001 (sandbox/staging/earlier deploys).
ALTER TABLE `canonical_entities` MODIFY `vertical` VARCHAR(30) NOT NULL;
ALTER TABLE `offers` MODIFY `vertical` VARCHAR(30) NOT NULL;
