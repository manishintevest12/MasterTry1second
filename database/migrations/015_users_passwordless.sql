-- Google/Firebase sign-in creates accounts with no password. 001_init declared
-- password_hash NOT NULL, so the first Google signup failed on strict-mode MySQL
-- (INSERT ... password_hash NULL), which surfaced as a 503 from the host proxy.
ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NULL;
