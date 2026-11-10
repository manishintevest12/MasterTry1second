/**
 * Try1Second — SECURITY SURFACE (owner 10 Nov: "security v increase kro site ki").
 *
 * What was there before: only `app.disable('x-powered-by')` and a header-strip. That leaves a public
 * Express app answering with no HSTS, no sniffing protection, no framing rule, no permissions policy
 * and no limit at all on how often one client can hit /api — every request that reaches the express
 * layer gets a fresh live sweep, which is exactly the shape of an accidental (or hostile) load test.
 *
 * Rules this module keeps:
 *  - Nothing here may break the product. The Content-Security-Policy is REPORT-ONLY (and only
 *    advertised, never enforced) because the site loads AdSense, affiliate pixels and a Vite bundle;
 *    enforcing a guessed policy would blank the page for real users. Everything enforced below is
 *    a header that cannot change rendering.
 *  - Cross-origin isolation is deliberately NOT set (no COEP): the app embeds third-party ad frames.
 *  - Rate limiting must never punish a real user: the app legitimately polls a running search and the
 *    Flutter clients retry, so budgets are generous per IP and the limiter fails OPEN if it errs.
 *  - No secret, token or internal path is ever echoed back in an error body.
 */

import type { Request, Response, NextFunction } from 'express';

/** Headers that are safe on every response and cannot alter layout/paint. */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  const secure = req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  // HSTS: only over HTTPS (a browser ignores it on http) and WITHOUT includeSubDomains until every
  // subdomain is known to serve https - a bad includeSubDomains would lock out a host we do not own.
  if (secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // The app opens merchant exits in a new tab; same-origin-allow-popups keeps window.opener semantics
  // for our own popups while stopping another origin from framing the site.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Nothing on the site needs a camera, mic, geolocation feed or payment handler beyond the browser's
  // own checkout redirects; the search box asks for a city by text.
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), usb=(), payment=(), geolocation=(self)');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  // REPORT-ONLY: states the intent and collects violations without ever blocking a script. 'unsafe-inline'
  // is present because AdSense injects inline config; remove it only after reading real violation reports.
  res.setHeader(
    'Content-Security-Policy-Report-Only',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "style-src 'self' 'unsafe-inline' https:",
      "img-src 'self' data: https:",
      "font-src 'self' data: https:",
      "connect-src 'self' https:",
      "frame-src 'self' https:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https:",
    ].join('; '),
  );
  next();
}

type Bucket = { tokens: number; updated: number };
const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function clientKey(req: Request): string {
  // Trust the proxy chain only for the address express already resolved; never parse XFF ourselves
  // (a client can set it). req.ip is the socket/proxy-resolved value.
  return String(req.ip || req.socket?.remoteAddress || 'unknown');
}

export interface RateLimitOptions {
  /** Requests allowed per window, per client, for the matched routes. */
  limit: number;
  /** Window length in ms. */
  windowMs: number;
  /** Only these path prefixes are counted. Defaults to the expensive search endpoints. */
  match?: (path: string, method: string) => boolean;
}

const defaultMatch = (path: string, method: string): boolean =>
  method !== 'GET' && (path.startsWith('/api/search') || path.startsWith('/api/scrape') || path.startsWith('/api/out') || path.startsWith('/api/lead'));

/**
 * Token bucket per client. Returns 429 with a Retry-After header when a client has spent its budget.
 * Fails open: any internal error calls next() so a bug here can never take the API down.
 */
export function apiRateLimit(opts: RateLimitOptions) {
  const match = opts.match || defaultMatch;
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const path = String(req.path || '');
      if (!match(path, String(req.method || 'GET').toUpperCase())) return next();
      const now = Date.now();
      const key = `${clientKey(req)}|${path.split('/').slice(0, 3).join('/')}`;
      const refillPerMs = opts.limit / opts.windowMs;
      let b = buckets.get(key);
      if (!b) { b = { tokens: opts.limit, updated: now }; buckets.set(key, b); }
      b.tokens = Math.min(opts.limit, b.tokens + (now - b.updated) * refillPerMs);
      b.updated = now;
      if (b.tokens < 1) {
        const retryAfter = Math.max(1, Math.ceil((1 - b.tokens) / refillPerMs / 1000));
        res.setHeader('Retry-After', String(retryAfter));
        res.status(429).json({ error: 'Too many requests', retryAfterSeconds: retryAfter });
        return;
      }
      b.tokens -= 1;
      if (now - lastSweep > 300_000) { // drop idle clients so the map cannot grow forever
        lastSweep = now;
        for (const [k, v] of buckets) if (now - v.updated > 600_000) buckets.delete(k);
      }
      next();
    } catch {
      next(); // fail open
    }
  };
}

/** Reset state (tests only). */
export function resetRateLimitState(): void {
  buckets.clear();
  lastSweep = Date.now();
}

/** RFC 9116 security.txt body. Public contact only, no internals. */
export function securityTxt(): string {
  const expires = new Date(Date.now() + 365 * 86400_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  return [
    '# Security policy for try1second.com',
    '# Report a vulnerability privately. Please do not open a public issue first.',
    'Contact: mailto:info@try1second.com',
    'Expires: ' + expires,
    'Preferred-Languages: en, hi',
    'Canonical: https://www.try1second.com/.well-known/security.txt',
    '',
  ].join('\n');
}
