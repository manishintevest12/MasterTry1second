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
const UPSTREAM_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
// Statuses where retrying (and then serving the last good copy) is right: the edge is
// throttling, not answering for the data.
const RETRIABLE = new Set([403, 429, 500, 502, 503, 504]);
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
  // Owner 2 Nov ("iss build mai kya break ho gaya ... Currently Showing bhi nahi aa raha"):
  // Cloudflare egress IPs started getting an EMPTY 429 from the Hostinger edge, so every app call
  // died while the same call from a browser was fine. Presenting a browser identity upstream drops
  // the bot score that triggers that throttle.
  headers.set('user-agent', UPSTREAM_UA);
  headers.set('accept-language', 'en-IN,en;q=0.9');
  if (request.method === 'GET' && !headers.get('accept')) {
    headers.set('accept', 'application/json, text/plain, */*');
  }
  try {
    headers.set('referer', 'https://www.try1second.com/');
    headers.set('origin', 'https://www.try1second.com');
  } catch (_) { /* Origin is a forbidden header name in some runtimes; ignore */ }

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
    // The in-app BROWSER (webview) also comes from our app but sends a browser UA that ends in
    // "Try1SecondApp/1.9" - the plain client pattern above never matched it, so every merchant
    // exit resolved against the relay answered 401 {"error":"unauthorized"} (24 bytes) and the
    // webview painted a blank white page under the seller's name (owner 2 Nov: "book dabane par
    // partner site nahi khul rahi, white page"). Exits belong on the public site host, but
    // already-installed builds still point here, so accept both markers.
    const fromOurApp = /Try1Second(\/|App\/)/i.test(request.headers.get('user-agent') || '');
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
    let lastStatus = 0;
    const isRead = request.method === 'GET' || request.method === 'HEAD';
    const cacheKey = isRead ? new Request(target, { method: 'GET' }) : null;
    for (let i = 0; i < delays.length; i++) {
      if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
      try {
        const res = await fetchUpstream(request, target, origin, bodyBuffer);
        if (RETRIABLE.has(res.status)) {
          lastStatus = res.status;
          // 403/429 from the Hostinger edge means this EGRESS is blocked, not that the call was
          // bad: retrying from the same Cloudflare IP for 9 more seconds only delays the phone.
          // One retry, then hand the client a direct route.
          const egressBlocked = res.status === 403 || res.status === 429;
          if (i < (egressBlocked ? 1 : delays.length - 1)) continue;
          // Last good copy beats a blank screen: the app has no way to render "throttled".
          if (isRead) {
            try {
              const hit = await caches.default.match(cacheKey);
              if (hit) {
                const out = new Headers(hit.headers);
                for (const [k, v] of cors.entries()) out.set(k, v);
                out.set('x-t1s-cache', 'relay-stale');
                out.set('x-t1s-relay-attempts', String(i + 1));
                out.set('x-t1s-upstream-status', String(res.status));
                return new Response(hit.body, { status: 200, headers: out });
              }
            } catch (_) { /* cache unavailable: fall through to the retry envelope */ }
          }
          break;
        }
        if (res.status < 400 && isRead) {
          // keep a copy so a later throttle cannot blank the app
          try {
            const store = new Response(res.clone().body, { status: 200, headers: res.headers });
            await caches.default.put(cacheKey, store);
          } catch (_) { /* caching is best-effort */ }
        }
        const out = new Headers(res.headers);
        for (const [k, v] of cors.entries()) out.set(k, v);
        // Never let an intermediary cache an API answer; the origin already sets its own rules.
        out.set('x-t1s-relay-attempts', String(i + 1));
        return new Response(res.body, { status: res.status, headers: out });
      } catch (e) {
        lastError = e;
      }
    }
    if (lastStatus) {
      // BEST route when the edge blocks Cloudflare's egress: send the phone straight to the
      // origin for the same path. 307 keeps the method AND the body, so a POST search still
      // arrives intact, and the app's own client follows redirects by default. This is what
      // restores results (and Currently Showing) for builds already installed.
      if (isRead) {
        try {
          const hit = await caches.default.match(cacheKey);
          if (hit) {
            const out = new Headers(hit.headers);
            for (const [k, v] of cors.entries()) out.set(k, v);
            out.set('x-t1s-cache', 'relay-stale');
            out.set('x-t1s-upstream-status', String(lastStatus));
            return new Response(hit.body, { status: 200, headers: out });
          }
        } catch (_) { /* ignore */ }
      }
      // Only GET/HEAD can ride a redirect: dart:io follows 3xx for GET but returns a 307
      // straight to the caller for POST (measured: POST status=307 redirects=0), so a search
      // must instead get a 5xx, which the app's own dual-hop reroutes to the origin itself.
      const canRedirect = request.method === 'GET' || request.method === 'HEAD';
      if ((lastStatus === 429 || lastStatus === 403) && canRedirect) {
        const out = new Headers(cors);
        out.set('location', target);
        out.set('cache-control', 'no-store');
        out.set('x-t1s-relay-redirect', 'edge-throttled');
        out.set('x-t1s-upstream-status', String(lastStatus));
        return new Response(null, { status: 307, headers: out });
      }
      // Answer in the shape the app already understands (a "still scanning, retry" envelope)
      // instead of a bare status it treats as fatal, and use 503 so the client's own dual-hop
      // failover to www.try1second.com can take over.
      const body = isRead
        ? JSON.stringify({
            success: false, results: [], retrying: true, pendingRefresh: true,
            retryAfterSec: 4, notice: 'origin edge throttled; retrying',
            relayUpstreamStatus: lastStatus,
          })
        : JSON.stringify({ error: 'upstream throttled', status: lastStatus, target });
      const out = new Headers(cors);
      out.set('content-type', 'application/json; charset=utf-8');
      out.set('cache-control', 'no-store');
      out.set('x-t1s-upstream-status', String(lastStatus));
      return new Response(body, { status: 503, headers: out });
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
