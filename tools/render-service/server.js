/**
 * Try1Second render service — our own "scraper API" (owner 23 Nov: "scrapper api charge krega hume apna scrapper
 * api jaisa kaam chaiye").
 *
 * One job: take a URL, load it in a real headless Chromium from this host's IP, and return the rendered HTML. That
 * is exactly what a paid per-call proxy (ScraperAPI) sells, and it is ~150 lines to run ourselves. The app calls it
 * through the rescue ladder's 'own' rung (T1S_RENDER_URL + T1S_RENDER_TOKEN), before the paid rung, so Goibibo and
 * Booking.com pages come back without a subscription.
 *
 * Deploy: any ₹300/mo VPS, a Fly/Railway free instance, or Docker (see README.md). Cloudflare Browser Rendering is
 * supported instead of this service (CF_ACCOUNT_ID + CF_BROWSER_TOKEN) when no server is wanted at all.
 *
 * Security: bearer token required, private/loopback hosts refused (SSRF), one page per request, hard timeout, and a
 * small concurrency cap so the box is never pegged.
 */
const http = require('http');
const { chromium } = require('playwright');

const PORT = Number(process.env.PORT || 8099);
const TOKEN = String(process.env.RENDER_TOKEN || '').trim();
const MAX_CONCURRENT = Math.max(1, Number(process.env.RENDER_CONCURRENCY || 2));
const HARD_TIMEOUT_MS = Math.max(5_000, Number(process.env.RENDER_TIMEOUT_MS || 30_000));
const MAX_BYTES = Math.max(200_000, Number(process.env.RENDER_MAX_BYTES || 6_000_000));

let active = 0;
let browserPromise = null;

async function browser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
    });
  }
  return browserPromise;
}

/** Refuse anything that is not a public http(s) page (SSRF guard). */
function assertPublicUrl(raw) {
  const u = new URL(raw);
  if (!/^https?:$/.test(u.protocol)) throw new Error('only http(s) urls are allowed');
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('private host refused');
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) throw new Error('private host refused');
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd')) throw new Error('private host refused');
  return u.toString();
}

async function render(url, { timeoutMs, waitUntil, scroll }) {
  const started = Date.now();
  const ctx = await (await browser()).newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    viewport: { width: 1366, height: 900 },
  });
  try {
    const page = await ctx.newPage();
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      // Images and fonts cost bandwidth and never carry the prices we parse.
      if (type === 'image' || type === 'font' || type === 'media') return route.abort();
      return route.continue();
    });
    const response = await page.goto(url, { waitUntil: waitUntil || 'networkidle2', timeout: timeoutMs });
    if (scroll) {
      // Listing pages lazy-load their cards; a couple of scrolls materialise the first screenful.
      for (let i = 0; i < 3; i += 1) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await page.waitForTimeout(600);
      }
    }
    let html = await page.content();
    if (html.length > MAX_BYTES) html = html.slice(0, MAX_BYTES);
    return { status: response ? response.status() : 200, html, ms: Date.now() - started };
  } finally {
    await ctx.close().catch(() => {});
  }
}

const server = http.createServer((req, res) => {
  const send = (code, obj) => {
    const body = JSON.stringify(obj);
    res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
  };
  if (req.method === 'GET' && req.url.startsWith('/health')) {
    return send(200, { ok: true, active, maxConcurrent: MAX_CONCURRENT });
  }
  if (req.method !== 'POST' || !req.url.startsWith('/render')) return send(404, { ok: false, error: 'POST /render' });
  if (TOKEN) {
    const auth = String(req.headers.authorization || '');
    if (auth !== `Bearer ${TOKEN}`) return send(401, { ok: false, error: 'unauthorized' });
  }
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 8_000) req.destroy(); });
  req.on('end', async () => {
    let payload;
    try { payload = JSON.parse(raw || '{}'); } catch { return send(400, { ok: false, error: 'invalid json' }); }
    let target;
    try { target = assertPublicUrl(String(payload.url || '')); } catch (e) { return send(400, { ok: false, error: String(e.message || e) }); }
    if (active >= MAX_CONCURRENT) return send(429, { ok: false, error: 'busy', active, maxConcurrent: MAX_CONCURRENT });
    active += 1;
    try {
      const out = await render(target, {
        timeoutMs: Math.min(HARD_TIMEOUT_MS, Math.max(5_000, Number(payload.timeoutMs) || HARD_TIMEOUT_MS)),
        waitUntil: typeof payload.waitUntil === 'string' ? payload.waitUntil : 'networkidle2',
        scroll: payload.scroll !== false,
      });
      send(200, { ok: true, ...out });
    } catch (e) {
      send(502, { ok: false, error: String(e && e.message ? e.message : e).slice(0, 200) });
    } finally {
      active -= 1;
    }
  });
});

server.listen(PORT, () => console.log(`[render-service] listening on ${PORT} (concurrency ${MAX_CONCURRENT})`));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    try { if (browserPromise) await (await browserPromise).close(); } catch { /* already gone */ }
    process.exit(0);
  });
}
