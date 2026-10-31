/**
 * OWNER 31 Oct ("ab app mai ye issue aa raha hai hr jagah HTTP 400"): the app shows a bare
 * "HTTP 400" box and nothing tells us WHY, because my code only ever recorded transport failures
 * (errno 104), never an HTTP status. A 400 can come from three different places and they mean
 * completely different things:
 *
 *   1. THIS process  - express.json() could not parse the body (malformed/truncated JSON).
 *                      If the phone's 400 lands here, `raw` below shows the exact bytes it sent.
 *   2. Hostinger's LiteSpeed edge - rejects the request before Node ever sees it. Nothing is
 *                      recorded here, which is itself the proof.
 *   3. The Cloudflare API relay - returns its own error before the origin. Same: nothing recorded.
 *
 * So a phone that still shows HTTP 400 while this ring stays EMPTY proves the request never
 * reached the app, and the fix has to be client-side (fallback to the direct origin) rather than
 * server-side. Keeping the last 200 entries costs a few KB and no CPU on the happy path.
 */

export interface BadRequestEntry {
  at: number;
  method: string;
  url: string;
  contentType: string;
  contentLength: string;
  via: string;
  userAgent: string;
  session: string;
  relayed: boolean;
  reason: string;
  /** First 300 characters of the body the client actually sent, when the parser gave it to us. */
  raw: string;
}

const RING: BadRequestEntry[] = [];
const MAX = 200;
const TTL_MS = 24 * 60 * 60 * 1000;

const clip = (v: unknown, n: number): string => {
  const s = typeof v === 'string' ? v : v == null ? '' : String(v);
  return s.length > n ? s.slice(0, n) : s;
};

export function recordBadRequest(req: any, reason: string, raw?: unknown): void {
  const h = (name: string) => clip((req && req.headers ? req.headers[name] : '') || '', 160);
  RING.push({
    at: Date.now(),
    method: clip(req && req.method, 10),
    url: clip(req && (req.originalUrl || req.url), 200),
    contentType: h('content-type'),
    contentLength: h('content-length'),
    via: h('x-t1s-via'),
    userAgent: h('user-agent'),
    session: h('x-t1s-session'),
    relayed: Boolean(h('x-t1s-via') || h('x-relay-key')),
    reason: clip(reason, 200),
    raw: clip(raw, 300),
  });
  const cutoff = Date.now() - TTL_MS;
  while (RING.length > MAX || (RING[0] && RING[0].at < cutoff)) RING.shift();
}

export function listBadRequests(): BadRequestEntry[] {
  const cutoff = Date.now() - TTL_MS;
  return RING.filter((e) => e.at >= cutoff);
}

export function resetBadRequestLog(): void {
  RING.length = 0;
}
