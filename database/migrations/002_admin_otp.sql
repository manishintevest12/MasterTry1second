-- Admin email-OTP login codes (Section 19). Codes are scrypt-hashed; never stored in plaintext.
CREATE TABLE IF NOT EXISTS otp_codes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  INDEX idx_otp_email (email),
  INDEX idx_otp_expires (expires_at)
);
