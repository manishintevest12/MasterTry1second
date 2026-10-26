/**
 * Firebase Authentication (Google sign-in) — server-side ID token verification.
 * Verifies RS256-signed Firebase ID tokens against Google's public x509 certificates,
 * with zero third-party dependencies (Node crypto only), then the route provisions
 * a normal Try1Second session. Firebase stays an auth provider, never a data source.
 */
import crypto from 'crypto';
import { settings } from '../common/settings';
import { log } from '../common/logger';

const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certCache: { certs: Record<string, string>; fetchedAt: number } | null = null;
const CERT_TTL_MS = 60 * 60 * 1000; // 1 hour

function base64UrlDecode(seg: string): Buffer {
  return Buffer.from(seg.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

async function getCertificates(): Promise<Record<string, string>> {
  if (certCache && Date.now() - certCache.fetchedAt < CERT_TTL_MS) return certCache.certs;
  const res = await fetch(CERT_URL);
  if (!res.ok) throw new Error(`Could not fetch Google public certs (HTTP ${res.status})`);
  const certs = (await res.json()) as Record<string, string>;
  certCache = { certs, fetchedAt: Date.now() };
  return certs;
}

export interface FirebaseUserClaims {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  picture?: string;
}

/** Honest, non-sensitive reason a Firebase ID token was rejected. */
export type FirebaseVerifyFailure =
  | 'server_not_configured'
  | 'malformed'
  | 'audience_mismatch'
  | 'issuer_mismatch'
  | 'expired'
  | 'clock_skew'
  | 'bad_claims'
  | 'certs_unreachable'
  | 'unknown_signing_key'
  | 'bad_signature';

export type FirebaseVerifyResult =
  | { claims: FirebaseUserClaims; reason?: undefined; detail?: undefined }
  | { claims?: undefined; reason: FirebaseVerifyFailure; detail?: string };

/**
 * Verify a Firebase ID token cryptographically and report WHY it failed:
 * - RS256 signature against Google's rotating x509 certificates (matched by `kid`)
 * - `aud` must equal the Firebase project ID, `iss` must be https://securetoken.google.com/<projectId>
 * - `exp`/`iat` must be sane (300s skew tolerance for shared-hosting clocks); `sub` (uid) non-empty (<= 128 chars)
 * Never trust unverified claims; every rejection carries an honest reason for logs + the client.
 */
export async function verifyFirebaseIdTokenDetailed(
  idToken: string,
  opts: { certsOverride?: Record<string, string>; now?: number; projectId?: string } = {},
): Promise<FirebaseVerifyResult> {
  const projectId = opts.projectId ?? settings.firebaseProjectId;
  if (!projectId) return { reason: 'server_not_configured' };
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  try {
    const parts = String(idToken || '').split('.');
    if (parts.length !== 3) return { reason: 'malformed' };
    const header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8'));
    const payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));

    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return { reason: 'malformed' };
    if (payload.aud !== projectId) return { reason: 'audience_mismatch', detail: `aud=${payload.aud}` };
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return { reason: 'issuer_mismatch', detail: `iss=${payload.iss}` };
    if (typeof payload.exp !== 'number' || payload.exp <= now) return { reason: 'expired' };
    if (typeof payload.iat !== 'number' || payload.iat > now + 300) return { reason: 'clock_skew', detail: `iat ahead by ${payload.iat - now}s` };
    if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) return { reason: 'bad_claims' };
    if (typeof payload.email !== 'string' || !payload.email) return { reason: 'bad_claims' };

    let certs: Record<string, string>;
    try {
      certs = opts.certsOverride ?? (await getCertificates());
    } catch (err) {
      log.warn('FirebaseAuth', `Google certs unreachable: ${(err as Error).message}`);
      return { reason: 'certs_unreachable', detail: (err as Error).message };
    }
    const certPem = certs[header.kid];
    if (!certPem) return { reason: 'unknown_signing_key', detail: `kid=${header.kid}` };

    const publicKey = new crypto.X509Certificate(certPem).publicKey;
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    if (!verifier.verify(publicKey, base64UrlDecode(parts[2]))) return { reason: 'bad_signature' };

    return {
      claims: {
        uid: payload.sub,
        email: String(payload.email).toLowerCase(),
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
        displayName: typeof payload.name === 'string' ? payload.name : undefined,
        picture: typeof payload.picture === 'string' ? payload.picture : undefined,
      },
    };
  } catch (err) {
    log.warn('FirebaseAuth', `ID token verification failed: ${(err as Error).message}`);
    return { reason: 'malformed', detail: (err as Error).message };
  }
}

/** Back-compat wrapper: claims or null. */
export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseUserClaims | null> {
  const r = await verifyFirebaseIdTokenDetailed(idToken);
  return r.claims ?? null;
}

const GOOGLE_CERT_URL = 'https://www.googleapis.com/oauth2/v1/certs';
let googleCertCache: { certs: Record<string, string>; fetchedAt: number } | null = null;

async function getGoogleCertificates(): Promise<Record<string, string>> {
  if (googleCertCache && Date.now() - googleCertCache.fetchedAt < CERT_TTL_MS) return googleCertCache.certs;
  const res = await fetch(GOOGLE_CERT_URL);
  if (!res.ok) throw new Error(`Could not fetch Google public certs (HTTP ${res.status})`);
  const certs = (await res.json()) as Record<string, string>;
  googleCertCache = { certs, fetchedAt: Date.now() };
  return certs;
}

/**
 * Verify a plain Google Sign-In ID token (used by the Flutter mobile app).
 * RS256 signature against Google's rotating certs (by `kid`), `iss` must be Google,
 * `aud` must be one of GOOGLE_OAUTH_CLIENT_IDS, token must be unexpired and the
 * email verified. Returns null on any failure; unverified claims are never trusted.
 */
/**
 * Audience policy (owner 26 Oct): every Google client of OUR Firebase project
 * (49438102645-*.apps.googleusercontent.com) is acceptable — web client, each
 * Android client tied to a signing SHA, and any future client created when a
 * new fingerprint is registered (including Play App Signing). Tokens belonging
 * to any OTHER project are still rejected, so this cannot be abused for
 * cross-app token reuse.
 */
const PROJECT_AUDIENCE_PREFIX = '49438102645-';

export function audienceAllowed(aud: string, allowedAudiences: string[]): boolean {
  if (!aud) return false;
  if (allowedAudiences.includes(aud)) return true;
  if (String(process.env.GOOGLE_AUDIENCE_ANY_PROJECT_CLIENT || '1') === '0') return false;
  if (!aud.startsWith(PROJECT_AUDIENCE_PREFIX)) return false;
  return /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(aud);
}

export async function verifyGoogleIdToken(idToken: string, allowedAudiences: string[] = settings.googleOauthClientIds, certsOverride?: Record<string, string>): Promise<FirebaseUserClaims | null> {
  if (!allowedAudiences.length) return null;
  try {
    const parts = String(idToken || '').split('.');
    if (parts.length !== 3) return null;
    const header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8'));
    const payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));

    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;
    if (!audienceAllowed(String(payload.aud), allowedAudiences)) return null;
    if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') return null;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= now) return null;
    if (typeof payload.iat !== 'number' || payload.iat > now + 60) return null;
    if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) return null;
    if (typeof payload.email !== 'string' || !payload.email) return null;
    const verified = payload.email_verified === true || payload.email_verified === 'true';
    if (!verified) return null;

    const certs = certsOverride || (await getGoogleCertificates());
    const certPem = certs[header.kid];
    if (!certPem) return null;
    const publicKey = new crypto.X509Certificate(certPem).publicKey;
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    if (!verifier.verify(publicKey, base64UrlDecode(parts[2]))) return null;

    return {
      uid: payload.sub,
      email: String(payload.email).toLowerCase(),
      emailVerified: true,
      displayName: typeof payload.name === 'string' ? payload.name : undefined,
      picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    };
  } catch (err) {
    log.warn('GoogleAuth', `ID token verification failed: ${(err as Error).message}`);
    return null;
  }
}
