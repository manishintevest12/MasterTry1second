-- Firebase Authentication (Google sign-in) support for main-site users.
-- A Google-verified account has no password; the firebase_uid links the row to its Google identity.
ALTER TABLE users ADD COLUMN firebase_uid VARCHAR(128) NULL;
ALTER TABLE users ADD INDEX idx_users_firebase_uid (firebase_uid);
