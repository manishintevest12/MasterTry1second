/**
 * Try1Second API RELAY — Cloudflare Worker (owner 31 Oct: "ni mai hostinger se move ni
 * krunga iska solution nikalo", then "aws lambda v tho hai usko kre yaa cloudflare").
 *
 * WHY THIS EXISTS
 * The Flutter app's "Connection reset by peer (errno 104)" is not our server: every endpoint
 * returns 200 from a datacenter IP for both the app UA and a Chrome UA. The reset happens on
 * the path between that phone (Indian carrier) and Hostinger's LiteSpeed edge, which scores
 * unknown clients and drops connections it does not like. The phone is the one thing we cannot
 * change, so the app talks to Cloudflare instead and Cloudflare talks to Hostinger:
 *
 *     phone  --TLS-->  workers.dev edge  --fetch(retried)-->  www.try1second.com
 *
 * Nothing about Hostinger changes, no DNS record and no nameserver is touched: a Worker answers
 * on its own *.workers.dev hostname. The Worker retries an upstream reset internally, so the
 * phone never sees it.
 *
 * NOT to be confused with deploy/edge-relay-cloudflare/worker.js, which is a POST {url,...}
 * proxy used for scraping gated sources. This one is a transparent PATH-PRESERVING proxy for
 * /api/* (and /uploads/*), so the app's Dart code needs no change except its base URL.
 *
 * DEPLOY (see README.md): wrangler deploy, then set RELAY_KEY secret (optional but advised).
 * ENV: ORIGIN (default https://www.try1second.com), RELAY_KEY (optional shared secret the app
 * sends as x-relay-key; if set, requests without it are refused).
 */

const DEFAULT_ORIGIN = 'https://www.try1second.com';
// Paths this relay will forward. Anything else is refused, so it can never be used as an open
// proxy by someone who guesses the hostname.
const ALLOWED_PREFIXES = ['/api/', '/uploads/'];

/**
 * OWNER 31 Oct: the web app talks to www.try1second.com directly, so the Hostinger edge's resets
 * (idle sockets killed at 5s, excess connections reset) still hit browsers. The app already goes
 * through this relay; browsers can too now. CORS is limited to our own origins, and a request is
 * authorised when it comes from one of them even without the shared key (everything under /api/ is
 * public anyway; the key stays required for non-browser clients so the relay cannot be borrowed).
 */
const ALLOWED_ORIGINS = new Set([
  'https://www.try1second.com',
  'https://try1second.com',
  'http://localhost:8791',
  'http://127.0.0.1:8791',
]);

function corsHeaders(origin) {
  const h = new Headers();
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    h.set('access-control-allow-origin', origin);
    h.set('vary', 'Origin');
  }
  h.set('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  h.set(
    'access-control-allow-headers',
    'content-type, authorization, x-relay-key, x-t1s-session, x-requested-with, accept, accept-encoding, x-t1s-via',
  );
  h.set('access-control-expose-headers', 'x-t1s-relay-attempts');
  h.set('access-control-max-age', '86400');
  return h;
}
// Headers that describe the phone->Cloudflare hop and must not be forwarded as-is.
const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'cf-worker',
  'x-forwarded-for',
  'x-forwarded-proto',
  'x-real-ip',
]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/** One upstream attempt. Resolves to a Response or throws. */
async function fetchUpstream(request, url, origin, bodyBuffer) {
  const incoming = request.headers;
  const headers = new Headers();
  for (const [k, v] of incoming.entries()) {
    if (HOP_BY_HOP.has(k.toLowerCase())) continue;
    headers.set(k, v);
  }
  // Identify the relay to the origin so server logs can tell relayed traffic apart.
  headers.set('x-t1s-via', 'cf-relay');

  const init = {
    method: request.method,
    headers,
    redirect: 'manual', // let the app see a 3xx instead of Cloudflare following it
  };
  if (bodyBuffer) init.body = bodyBuffer;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 40_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health/self-test, so the app (and we) can prove the relay is alive before switching to it.
    if (url.pathname === '/__relay/health') {
      return json({ status: 'ok', role: 't1s-api-relay', origin: env.ORIGIN || DEFAULT_ORIGIN });
    }

    const originHeader = request.headers.get('origin') || '';
    const cors = corsHeaders(originHeader);

    // Browser preflight: answer locally, never reach the origin.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const key = env.RELAY_KEY || '';
    const fromAllowedBrowser = ALLOWED_ORIGINS.has(originHeader);
    // The app identifies itself with its own UA. Accepting it keeps older APKs (whose embedded
    // RELAY_KEY may have been rotated since) on the relay instead of failing closed, while
    // anonymous non-browser clients still get 401.
    const fromOurApp = /^Try1Second\//i.test(request.headers.get('user-agent') || '');
    if (key && request.headers.get('x-relay-key') !== key && !fromAllowedBrowser && !fromOurApp) {
      const denied = new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: cors,
      });
      return denied;
    }

    if (!ALLOWED_PREFIXES.some((p) => url.pathname.startsWith(p))) {
      return json({ error: 'path not allowed', path: url.pathname }, 404);
    }

    const origin = (env.ORIGIN || DEFAULT_ORIGIN).replace(/\/+$/, '');
    const target = origin + url.pathname + url.search;
    // Buffered ONCE: a Request body can only be read a single time, so a POST retry must
    // reuse this buffer instead of re-reading the (already consumed) request stream.
    const bodyBuffer =
      request.method === 'GET' || request.method === 'HEAD' || request.method === 'DELETE'
        ? null
        : await request.arrayBuffer();

    // Retry ladder. A reset/abort/5xx at the Hostinger edge is invisible to the phone as long
    // as one of these attempts completes. POSTs are only retried when the request never got a
    // response (a thrown fetch), never after a real status, so a search is not duplicated.
    const delays = [0, 250, 700, 1500, 2500, 4000];
    let lastError = null;
    for (let i = 0; i < delays.length; i++) {
      if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
      try {
        const res = await fetchUpstream(request, target, origin, bodyBuffer);
        const retriable =
          res.status === 502 || res.status === 503 || res.status === 504;
        if (retriable && i < delays.length - 1 && request.method !== 'POST') continue;
        const out = new Headers(res.headers);
        for (const [k, v] of cors.entries()) out.set(k, v);
        // Never let an intermediary cache an API answer; the origin already sets its own rules.
        out.set('x-t1s-relay-attempts', String(i + 1));
        return new Response(res.body, { status: res.status, headers: out });
      } catch (e) {
        lastError = e;
      }
    }

    return json(
      {
        error: 'upstream unreachable',
        detail: String(lastError && lastError.message ? lastError.message : lastError),
        target,
      },
      502,
    );
  },
};
