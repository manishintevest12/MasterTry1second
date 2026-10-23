/**
 * Monetizable exit interstitial (owner 23 Oct): every BROWSER exit that used to
 * 302 straight from /api/out to the merchant now passes through a standalone
 * /redirect?k=<signed token> page — "Connecting to the cheapest store...",
 * a 4-second countdown, and an AdSense responsive unit above the fold
 * (admin-configured under ad slot key `redirect_interstitial`).
 *
 * Security model (unchanged masking guarantees):
 *   - The comparison page NEVER holds a raw destination — it holds /api/out
 *     masking pointers (HMAC-signed, expiring).
 *   - /api/out resolves the pointer, injects affiliate parameters server-side,
 *     records the click, then mints a SECOND one-use signed token for the
 *     final tracked URL. Only that opaque token appears in the address bar
 *     (clean + masked); affiliate tokens never leak to the client.
 *   - The interstitial token is HMAC-SHA256 signed, expires in 10 minutes and
 *     is re-validated against the same anti-open-redirect allowlist before the
 *     page renders. Malformed / missing / expired tokens get honest error pages.
 *
 * AdSense policy compliance (owner asked for 100%):
 *   - The ad is a standard responsive unit served by Google; nothing prompts,
 *     incentivizes or forces a click, the countdown is not paused/aborted by
 *     ad interaction, and a plain "Go now" link is always available.
 *   - In-app WebViews (our own Flutter app) never see this page: AdSense for
 *     Content may not be displayed inside application webviews, so /api/out
 *     skips the interstitial for webview user agents and 302s directly.
 */
import crypto from 'crypto';
import type { Request, Response } from 'express';
import { getAdSlot } from '../marketing/placements';
import { validateDestination } from '../affiliate/affiliateNetwork';
import { log } from '../common/logger';

const INTERSTITIAL_TTL_MS = 10 * 60 * 1000; // generous for a 4-second page
const COUNTDOWN_SECONDS = 4;

function secret(): string {
  // Same derivation as affiliate pointers: one secret rotates every pointer kind.
  return process.env.AFFILIATE_SECRET || crypto.createHash('sha256')
    .update(`${process.env.DATABASE_URL || process.env.MYSQL_URL || 'try1second'}#affiliate-pointer`).digest('hex');
}

function b64url(s: string): string { return Buffer.from(s, 'utf8').toString('base64url'); }
function unb64url(s: string): string { return Buffer.from(s, 'base64url').toString('utf8'); }

/** Mint the one-use opaque token for a FINAL (already affiliate-injected) URL. */
export function createInterstitialPointer(url: string): string {
  const payload = b64url(JSON.stringify({ d: url.slice(0, 3000), e: Date.now() + INTERSTITIAL_TTL_MS }));
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url').slice(0, 32);
  return `${payload}.${sig}`;
}

/** Verify + decode. Null on malformed signature, tampering or expiry. */
export function resolveInterstitialPointer(token: string): string | null {
  const m = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(token || ''));
  if (!m) return null;
  const expect = crypto.createHmac('sha256', secret()).update(m[1]).digest('base64url').slice(0, 32);
  if (m[2].length !== expect.length || !crypto.timingSafeEqual(Buffer.from(m[2]), Buffer.from(expect))) return null;
  try {
    const j = JSON.parse(unb64url(m[1]));
    if (!j?.d || typeof j.d !== 'string' || Number(j.e) < Date.now()) return null;
    return j.d;
  } catch { return null; }
}

/**
 * Our own mobile app embeds this UA suffix (in_app_browser_screen.dart);
 * stock Android WebView carries "; wv)" and iOS WKWebView apps typically use
 * their package id in UA. Any of these marks an in-app webview: no AdSense
 * (policy) and no artificial wait — the exit stays the instant 302 it was.
 */
export function isInAppWebView(userAgent: unknown): boolean {
  const ua = String(userAgent || '');
  return /Try1SecondApp|\bwv\)|WebView|com\.try1second/i.test(ua);
}

/** Minimal HTML-escape for attribute / text embedding (XSS-proof rendering). */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Safe JS string embed: JSON-quote then break any "</script" escape. */
function jsStr(s: string): string {
  return JSON.stringify(s).replace(/</g, '\\u003c');
}

function errorPage(title: string, message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${esc(title)}</title><meta name="robots" content="noindex,nofollow"></head>` +
    `<body style="margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center">` +
    `<div style="text-align:center;max-width:420px;padding:32px">` +
    `<div style="font-size:34px;line-height:1">⚠️</div>` +
    `<h1 style="font-size:19px;font-weight:800;margin:14px 0 8px">${esc(title)}</h1>` +
    `<p style="font-size:13.5px;color:#475569;line-height:1.55;margin:0 0 22px">${esc(message)}</p>` +
    `<a href="/" style="display:inline-block;background:#e11d48;color:#fff;font-weight:700;font-size:13px;padding:11px 22px;border-radius:10px;text-decoration:none">Search again on Try1Second</a>` +
    `</div></body></html>`;
}

/**
 * The interstitial page. Zero JS-framework payload: a single standalone HTML
 * document (Lighthouse-clean), inline CSS, ~20 lines of vanilla JS.
 * AdSense responsive unit sits directly under the header — above the fold on
 * every viewport — rendered only when the admin configured the slot.
 */
export function renderInterstitialPage(opts: {
  targetUrl: string;
  seconds?: number;
  adSlot?: { provider?: string; adsense_client?: string | null; adsense_slot?: string | null; custom_html?: string | null } | null;
}): string {
  const seconds = Math.max(1, Math.round(opts.seconds ?? COUNTDOWN_SECONDS));
  const target = opts.targetUrl;
  let host = '';
  try { host = new URL(target).hostname.replace(/^www\./, ''); } catch { /* validated earlier */ }

  const ad = opts.adSlot;
  let adBlock = '';
  if (ad?.provider === 'adsense' && ad.adsense_client && ad.adsense_slot) {
    // Standard Google responsive unit. Nothing artificial: standard tag,
    // standard call, page flow never depends on ad behaviour.
    adBlock =
      `<div class="ad-wrap">` +
      `<ins class="adsbygoogle" style="display:block" data-ad-client="${esc(ad.adsense_client)}" data-ad-slot="${esc(ad.adsense_slot)}" data-ad-format="auto" data-full-width-responsive="true"></ins>` +
      `</div>` +
      `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ad.adsense_client)}" crossorigin="anonymous"></script>` +
      `<script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>`;
  } else if (ad?.provider === 'custom' && ad.custom_html) {
    adBlock = `<div class="ad-wrap">${ad.custom_html}</div>`; // admin-authored fallback (sponsored banner)
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Connecting to the cheapest store… · Try1Second</title>
<style>
  :root{--red:#e11d48;--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--bg:#f8fafc}
  *{box-sizing:border-box}html,body{margin:0}
  body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--ink);
       min-height:100vh;display:flex;flex-direction:column;align-items:center}
  header{width:100%;padding:16px 20px 0;text-align:center}
  .brand{font-weight:900;font-size:15px;color:var(--red);letter-spacing:-.2px}
  main{width:100%;max-width:560px;padding:10px 16px 40px;text-align:center}
  h1{font-size:17px;font-weight:800;margin:16px 0 4px}
  h2{font-size:12.5px;font-weight:600;color:var(--muted);margin:0 0 18px}
  .ring{position:relative;width:64px;height:64px;margin:0 auto}
  .ring .track{position:absolute;inset:0;border-radius:50%;border:5px solid var(--line)}
  .ring .arc{position:absolute;inset:0;border-radius:50%;border:5px solid transparent;
             border-top-color:var(--red);border-right-color:var(--red);animation:spin 1s linear infinite}
  .ring .n{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
           font-weight:900;font-size:20px;color:var(--red)}
  @keyframes spin{to{transform:rotate(360deg)}}
  .store{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--line);
         border-radius:999px;padding:8px 16px;font-size:13px;font-weight:700;box-shadow:0 1px 2px rgb(15 23 42 / .05)}
  .store img{width:16px;height:16px;border-radius:3px}
  .dot{width:7px;height:7px;border-radius:50%;background:#16a34a}
  .go{display:inline-block;margin-top:16px;background:var(--red);color:#fff;font-weight:800;font-size:13.5px;
      padding:12px 26px;border-radius:11px;text-decoration:none;box-shadow:0 4px 12px rgb(225 29 72 / .25)}
  .go:active{transform:translateY(1px)}
  .fine{font-size:11px;color:var(--muted);margin-top:14px}
  .ad-wrap{margin:18px auto 0;max-width:560px;min-height:0}
  @media(min-width:760px){h1{font-size:20px}main{padding-top:16px}}
</style>
</head>
<body>
<header><span class="brand">Try1Second</span></header>
<main>
  <div class="ring" aria-hidden="true"><div class="track"></div><div class="arc"></div><div class="n" id="n">${seconds}</div></div>
  <h1>Connecting to the cheapest store...</h1>
  <h2>Sit tight — ${host ? esc(host) : 'your store'} is opening with your best price.</h2>
  ${adBlock}
  <div class="store" style="margin-top:18px">
    <span class="dot"></span><span id="lbl">Opening ${esc(host)} in <span id="s">${seconds}</span>s</span>
  </div><br>
  <a class="go" id="go" href="${esc(target)}" rel="nofollow noopener">Go now →</a>
  <p class="fine">We compared live prices so you pay the lowest. The store page opens automatically.</p>
</main>
<noscript><meta http-equiv="refresh" content="${seconds};url=${esc(target)}"></noscript>
<script>
(function () {
  var target = ${jsStr(target)};
  var s = ${seconds};
  var el = document.getElementById('s');
  var ring = document.getElementById('n');
  var t = setInterval(function () {
    s -= 1;
    if (el) el.textContent = s;
    if (ring) ring.textContent = s;
    if (s <= 0) { clearInterval(t); window.location.replace(target); }
  }, 1000);
  var go = document.getElementById('go');
  if (go) go.addEventListener('click', function () { clearInterval(t); });
})();
</script>
</body>
</html>`;
}

/**
 * GET /redirect?k=<token> — the browser-facing exit page.
 * Error handling per spec: missing / broken / malformed / expired token all
 * get an honest page (never a stack trace, never a silent blank tab).
 */
export async function redirectRouteHandler(req: Request, res: Response): Promise<void> {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store, must-revalidate');

  const k = String((req.query as any).k || (req.query as any).t || '');
  if (!k) {
    res.status(400).send(errorPage('No destination in this link',
      'This redirect page was opened without a destination. Go back to Try1Second and tap a deal again.'));
    return;
  }
  const target = resolveInterstitialPointer(k);
  if (!target) {
    res.status(410).send(errorPage('This link has expired',
      'Redirect links live for a few minutes for your safety. Run the search again and tap your deal for a fresh one.'));
    return;
  }
  const check = validateDestination(target);
  if (!check.valid) {
    log.warn('Redirect', 'Interstitial destination refused', { reason: check.reason });
    res.status(400).send(errorPage('This link couldn\u2019t be verified',
      `For your safety we didn't open it (${check.reason}).`));
    return;
  }
  let adSlot: any = null;
  try { adSlot = await getAdSlot('redirect_interstitial'); } catch { /* no fabrication: page renders without an ad */ }
  res.status(200).type('html').send(renderInterstitialPage({ targetUrl: target, adSlot }));
}
