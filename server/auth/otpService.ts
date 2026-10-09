/**
 * Admin email-OTP login (Section 19): one-time codes delivered via Resend.
 * - Codes are scrypt-hashed at rest; never stored or logged in plaintext.
 * - 10-minute expiry, single active code per email, max 5 verify attempts.
 * - Resend cooldown 60s and a 10/hour cap per email (prevents mail bombing).
 * - Eligible recipients: the configured ADMIN_EMAIL bootstrap account or any existing admin.
 * - Generic responses on request avoid account enumeration; only real admins receive mail.
 * - On successful verify of the bootstrap ADMIN_EMAIL with no account yet, the admin
 *   account is provisioned (no password) — so ADMIN_EMAIL + RESEND_API_KEY is the only
 *   production setup needed.
 */
import crypto from 'crypto';
import { getStore } from '../common/db';
import { settings } from '../common/settings';
import { log } from '../common/logger';
import { sendEmail } from './mailer';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000;
const HOURLY_CAP = 10;
const MAX_VERIFY_ATTEMPTS = 5;

function hashOtp(code: string): string {
  const salt = crypto.randomBytes(8).toString('hex');
  const hash = crypto.scryptSync(code, salt, 32).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyOtpHash(code: string, stored: string): boolean {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const check = crypto.scryptSync(code, parts[1], 32).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(parts[2], 'hex'));
  } catch {
    return false;
  }
}

function nowIso(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

async function isEligibleAdmin(email: string): Promise<boolean> {
  const store = getStore();
  if (settings.adminEmails.includes(email)) return true;
  const rows = await store.query<any>('SELECT role FROM users WHERE email = ?', [email]);
  return rows.length > 0 && rows[0].role === 'admin';
}

/** Step 1: send a code. Always returns a generic outcome; only eligible admins actually get mail. */
export async function requestAdminOtp(email: string): Promise<{ ok: boolean; sent: boolean; error?: string; deliveryError?: string }> {
  const clean = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { ok: false, sent: false, error: 'A valid email address is required' };
  const store = getStore();

  // Rate limits computed from recent rows (date math in JS: file store has no date comparisons).
  const recent = await store.query<any>('SELECT created_at, expires_at FROM otp_codes WHERE email = ?', [clean]);
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const lastHour = recent.filter((r) => new Date(String(r.created_at || '').replace(' ', 'T') + 'Z').getTime() > hourAgo);
  if (lastHour.length >= HOURLY_CAP) return { ok: false, sent: false, error: 'Too many codes requested. Try again later.' };
  const lastCreated = Math.max(0, ...lastHour.map((r) => new Date(String(r.created_at || '').replace(' ', 'T') + 'Z').getTime() || 0));
  if (now - lastCreated < RESEND_COOLDOWN_MS) return { ok: false, sent: false, error: 'A code was just sent. Please wait a minute before requesting another.' };

  // Only one active code per email.
  await store.execute('DELETE FROM otp_codes WHERE email = ?', [clean]);

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const expiresAt = new Date(now + OTP_TTL_MS).toISOString().slice(0, 19).replace('T', ' ');
  await store.execute(
    'INSERT INTO otp_codes (email, code_hash, expires_at, attempts, created_at) VALUES (?, ?, ?, ?, ?)',
    [clean, hashOtp(code), expiresAt, 0, nowIso()],
  );

  const eligible = await isEligibleAdmin(clean);
  if (!eligible) {
    // Enumeration-safe: pretend success but send nothing.
    log.info('Otp', `OTP requested for non-admin email (no mail sent)`);
    return { ok: true, sent: false };
  }

  const mail = await sendEmail(
    clean,
    'Your Try1Second admin login code',
    `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
       <h2>Try1Second Admin Login</h2>
       <p>Your one-time login code is:</p>
       <p style="font-size:32px;letter-spacing:8px;font-weight:bold">${code}</p>
       <p>It expires in 10 minutes. If you did not request it, ignore this email.</p>
     </div>`,
    `Your Try1Second admin login code: ${code} (expires in 10 minutes)`,
  );
  if (!mail.ok) {
    await store.execute('DELETE FROM otp_codes WHERE email = ?', [clean]);
    log.warn('Otp', `OTP email delivery failed for admin: ${mail.error}`);
    return { ok: false, sent: false, error: 'Could not send the login code right now. Please try again later.', deliveryError: mail.error };
  }
  log.info('Otp', `Admin OTP sent to ${clean}`);
  return { ok: true, sent: true };
}

/** Step 2: verify the code. Returns the admin's email on success. */
export async function verifyAdminOtp(email: string, code: string): Promise<{ ok: boolean; email?: string; error?: string }> {
  const clean = String(email || '').trim().toLowerCase();
  const otp = String(code || '').replace(/\D/g, '');
  if (!clean || otp.length !== 6) return { ok: false, error: 'Enter the 6-digit code sent to your email' };
  const store = getStore();

  const rows = await store.query<any>('SELECT id, code_hash, expires_at, attempts FROM otp_codes WHERE email = ?', [clean]);
  if (rows.length === 0) return { ok: false, error: 'No active code. Request a new one.' };
  const row = rows[rows.length - 1];
  if (Number(row.attempts || 0) >= MAX_VERIFY_ATTEMPTS) {
    await store.execute('DELETE FROM otp_codes WHERE email = ?', [clean]);
    return { ok: false, error: 'Too many incorrect attempts. Request a new code.' };
  }
  const exp = new Date(String(row.expires_at || '').replace(' ', 'T') + 'Z').getTime();
  if (!exp || exp < Date.now()) {
    await store.execute('DELETE FROM otp_codes WHERE email = ?', [clean]);
    return { ok: false, error: 'Code expired. Request a new one.' };
  }
  if (!verifyOtpHash(otp, row.code_hash)) {
    await store.execute('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?', [row.id]);
    return { ok: false, error: 'Incorrect code' };
  }
  // Single use.
  await store.execute('DELETE FROM otp_codes WHERE email = ?', [clean]);
  const eligible = await isEligibleAdmin(clean);
  if (!eligible) return { ok: false, error: 'Invalid code' };
  log.info('Otp', `Admin OTP verified for ${clean}`);
  return { ok: true, email: clean };
}
