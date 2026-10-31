/**
 * Lenient JSON body parsing.
 *
 * OWNER 31 Oct, second time and angry: "fix chaiye muje ab issue kaise v ... baar baar new build bnane
 * ke bdle jo purana build hai usme hi result show kro". The device in his hand runs an OLD build that
 * cannot be changed, and that build paints a red "HTTP 400" box for ANY non-2xx answer. So the 400 has
 * to stop existing at the source: this parser accepts the body a phone actually sends and never
 * produces a 400 for a JSON-ish payload. Every repair is recorded in the bad-request log so we can
 * still see what the client really sent.
 */
import express from 'express';
import { recordBadRequest } from './badRequestLog';

const JSONISH = /^(application\/json|application\/[a-z0-9.+-]*\+json|text\/plain|text\/json)/i;
const PASSTHROUGH = /^(multipart\/form-data|application\/octet-stream|application\/x-www-form-urlencoded)/i;

/** Repairs the payloads that make `JSON.parse` throw but that a client can legitimately send. */
export function parseLenientJson(text: string): { value: unknown; repaired: boolean } {
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (!clean) return { value: {}, repaired: true };

  try {
    return { value: JSON.parse(clean), repaired: false };
  } catch (_) {/* repair below */}

  const dropTrailingCommas = (s: string) => s.replace(/,\s*([}\]])/g, '$1');
  const quotJsTokens = (s: string) => s.replace(/\bNaN\b|\bundefined\b|\bInfinity\b|-Infinity/g, 'null');
  const quoteBareKeys = (s: string) => s.replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3');
  const singleToDouble = (s: string) => s.replace(/'/g, '"');

  const attempts = [
    dropTrailingCommas(clean),
    quotJsTokens(clean),
    quoteBareKeys(clean),
    singleToDouble(clean),
    singleToDouble(quoteBareKeys(quotJsTokens(dropTrailingCommas(clean)))),
    // "…=value&…" pasted into a JSON slot
    clean,
  ];

  for (const attempt of attempts) {
    try {
      const value = JSON.parse(attempt);
      return { value, repaired: true };
    } catch (_) {/* next repair */}
  }

  if (clean.includes('=')) {
    try {
      const params = new URLSearchParams(clean);
      const obj: Record<string, string> = {};
      params.forEach((v, k) => { obj[k] = v; });
      if (Object.keys(obj).length) return { value: obj, repaired: true };
    } catch (_) {/* give up below */}
  }

  // Unrecoverable: hand the handler an empty object instead of failing the request. A read endpoint
  // then answers "no query provided / scanning" (200), which an old build renders happily.
  return { value: {}, repaired: true };
}

/**
 * Drop-in replacement for `express.json()` that never rejects a request.
 * Multipart/urlencoded traffic is left untouched for its own parsers.
 */
export function lenientJsonBody(limit = '256kb') {
  const readRaw = express.text({
    limit,
    type: (req: any) => {
      const ct = String(req.headers?.['content-type'] || '');
      if (PASSTHROUGH.test(ct)) return false;
      if (JSONISH.test(ct)) return true;
      // No content-type but bytes on the wire: still read it, a phone can omit the header.
      return !ct && (Number(req.headers?.['content-length'] || 0) > 0 || !!req.headers?.['transfer-encoding']);
    },
  });

  return (req: any, res: any, next: any) => {
    const ct = String(req.headers?.['content-type'] || '');
    if (PASSTHROUGH.test(ct)) return next();
    const declaresBody = Number(req.headers?.['content-length'] || 0) > 0 || !!req.headers?.['transfer-encoding'];
    if (!declaresBody) {
      req.body = req.body === undefined ? {} : req.body;
      return next();
    }

    readRaw(req, res, (err: any) => {
      const raw = typeof req.body === 'string' ? req.body : '';
      if (err) {
        // Too large / undecodable: keep going with an empty body rather than answering 400.
        try { recordBadRequest(req, `body_unreadable:${err.type || err.message || 'error'}`, raw); } catch (_) {/* never throws */}
        req.body = {};
        return next();
      }
      const { value, repaired } = parseLenientJson(raw);
      if (repaired) {
        try { recordBadRequest(req, 'body_repaired', raw.slice(0, 300)); } catch (_) {/* never throws */}
      }
      req.body = value && typeof value === 'object' ? (value as any) : {};
      next();
    });
  };
}
