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

function base64UrlDecode(seg: string): Buffer {
  return Buffer.from(seg.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/**
 * Verify a Firebase ID token cryptographically:
 * - RS256 signature against Google's rotating x509 certificates (matched by `kid`)
 * - `aud` must equal FIREBASE_PROJECT_ID, `iss` must be https://securetoken.google.com/<projectId>
 * - `exp`/`iat` must be sane; `sub` (uid) must be non-empty (<= 128 chars)
 * Returns null on any failure — callers report an honest error and never trust unverified claims.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseUserClaims | null> {
  const projectId = settings.firebaseProjectId;
  if (!projectId) return null;
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8'));
    const payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));

    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= now) return null;
    if (typeof payload.iat !== 'number' || payload.iat > now + 60) return null;
    if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) return null;
    if (typeof payload.email !== 'string' || !payload.email) return null;

    const certs = await getCertificates();
    const certPem = certs[header.kid];
    if (!certPem) return null;

    const publicKey = new crypto.X509Certificate(certPem).publicKey;
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    const signatureOk = verifier.verify(publicKey, base64UrlDecode(parts[2]));
    if (!signatureOk) return null;

    return {
      uid: payload.sub,
      email: String(payload.email).toLowerCase(),
      emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      displayName: typeof payload.name === 'string' ? payload.name : undefined,
      picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    };
  } catch (err) {
    log.warn('FirebaseAuth', `ID token verification failed: ${(err as Error).message}`);
    return null;
  }
}
