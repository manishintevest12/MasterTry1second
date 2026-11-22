/**
 * STATELESS SESSION TOKENS (owner 22 Nov: installed app's Refer & Earn tab said "Could not reach the
 * referral engine — tap Refresh").
 *
 * WHY THIS EXISTS. Measured against production: a correct password login answered 200 with a token, and
 * then EVERY authenticated call with that token answered 401 "Authentication required" — 10 out of 10,
 * including /api/auth/me, /api/rewards/me and /api/rewards/referral/me. The users table itself was fine
 * (the same login rejected a wrong password), so the token was minted and then never found again.
 *
 * The cause is the session ROW. `userForToken()` only knew how to look a token up in the `sessions` table,
 * and on this host that table is not shared reliably between Passenger instances: with the file fallback
 * store every instance keeps its own snapshot, reloads it at most once per 5s and rewrites the WHOLE file
 * on every persist, so a session written by the instance that served the login is invisible to (or wiped
 * by) the instance that serves the next request. The app then reads a 401 as "the referral engine is
 * down", the wallet falls back to zeros, and nothing can be fixed by shipping a new APK.
 *
 * A signed token removes the lookup: the token itself carries the user id and an expiry, signed with
 * HMAC-SHA256, so ANY instance can authenticate the request without reading a shared row. The `sessions`
 * row is still written (best effort) so existing admin views and logout keep working.
 *
 * The secret is per-deployment and never in git: SESSION_SECRET if set, otherwise a file created once
 * under the data dir (shared by every instance on the host). Rotating it logs everybody out, which is the
 * intended emergency revocation — a stateless token cannot be revoked individually.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { dataDir } from '../common/settings';

const PREFIX = 't1s1';
const SECRET_FILE = path.join(dataDir, 'session-secret');

let cachedSecret: string | null = null;

/** The HMAC key for this deployment. Stable across instances and restarts, never committed. */
export function sessionSecret(): string {
  if (cachedSecret) return cachedSecret;
  const fromEnv = String(process.env.SESSION_SECRET || '').trim();
  if (fromEnv.length >= 16) {
    cachedSecret = fromEnv;
    return cachedSecret;
  }
  const readFile = (): string => {
    try {
      return String(fs.readFileSync(SECRET_FILE, 'utf8')).trim();
    } catch {
      return '';
    }
  };
  const existing = readFile();
  if (existing.length >= 32) {
    cachedSecret = existing;
    return cachedSecret;
  }
  const fresh = crypto.randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    // 'wx' = create only. If another instance won the race, keep ITS secret: two instances with two
    // secrets would each reject the other's tokens, which is the exact failure this module removes.
    fs.writeFileSync(SECRET_FILE, fresh, { mode: 0o600, flag: 'wx' });
    cachedSecret = fresh;
    return cachedSecret;
  } catch {
    const raced = readFile();
    if (raced.length >= 32) {
      cachedSecret = raced;
      return cachedSecret;
    }
    // Last resort (read-only data dir): a deterministic key, so instances still agree with each other.
    cachedSecret = crypto.createHash('sha256').update(`t1s-session|${dataDir}|${process.cwd()}`).digest('hex');
    return cachedSecret;
  }
}

const b64url = (buf: Buffer): string => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string): Buffer => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function sign(body: string): string {
  return b64url(crypto.createHmac('sha256', sessionSecret()).update(body).digest());
}

/** `t1s1.<payload>.<sig>` — payload is {u: userId, e: expiry in epoch seconds}. */
export function mintSessionToken(userId: number, ttlSec: number, now: number = Date.now()): string {
  const payload = b64url(Buffer.from(JSON.stringify({ u: Number(userId), e: Math.floor(now / 1000) + Math.floor(ttlSec) })));
  const body = `${PREFIX}.${payload}`;
  return `${body}.${sign(body)}`;
}

export function isSignedSessionToken(token: string): boolean {
  return String(token || '').startsWith(`${PREFIX}.`);
}

/** The user id behind a valid, unexpired, untampered token. Null for anything else. */
export function verifySessionToken(token: string, now: number = Date.now()): { userId: number } | null {
  const raw = String(token || '');
  const parts = raw.split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const body = `${parts[0]}.${parts[1]}`;
  const expected = sign(body);
  const given = parts[2];
  if (given.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  let claims: any;
  try {
    claims = JSON.parse(fromB64url(parts[1]).toString('utf8'));
  } catch {
    return null;
  }
  const userId = Number(claims?.u);
  const exp = Number(claims?.e);
  if (!Number.isFinite(userId) || userId <= 0) return null;
  if (!Number.isFinite(exp) || exp <= Math.floor(now / 1000)) return null;
  return { userId };
}
