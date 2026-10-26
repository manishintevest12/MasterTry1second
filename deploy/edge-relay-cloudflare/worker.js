/**
 * Try1Second Edge Relay — Cloudflare Worker (secondary leg).
 *
 * Same contract as the Lambda relay: POST {url, method, headers, body} ->
 * {status, body, headers}. Egresses from Cloudflare IPs. Cannot reproduce
 * curl_cffi's TLS fingerprint, so treat this as the fallback leg only.
 *
 * Deploy:
 *   npx wrangler deploy
 *   npx wrangler secret put RELAY_TOKEN
 */
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405);
    }
    const token = env.RELAY_TOKEN || '';
    if (token && request.headers.get('x-relay-token') !== token) {
      return json({ error: 'unauthorized' }, 401);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'invalid json body' }, 400);
    }

    const url = String(payload.url || '');
    if (!/^https?:\/\//i.test(url)) return json({ error: 'url required' }, 400);

    const timeoutSec = Math.max(3, Math.min(Number(payload.timeoutSec) || 25, 55));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutSec * 1000);

    try {
      const upstream = await fetch(url, {
        method: String(payload.method || 'GET').toUpperCase(),
        headers: payload.headers || {},
        body: payload.body ? payload.body : undefined,
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timer);
      const body = await upstream.text();
      return json({
        status: upstream.status,
        body: body.slice(0, 6 * 1024 * 1024),
        headers: Object.fromEntries(upstream.headers.entries()),
      });
    } catch (e) {
      clearTimeout(timer);
      return json({ error: `${e.name || 'Error'}: ${String(e.message || e).slice(0, 180)}` });
    }
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
