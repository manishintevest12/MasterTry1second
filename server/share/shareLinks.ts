/**
 * SHAREABLE LINKS + SOCIAL PREVIEWS (owner 19 Nov growth brief: "Implement clean share URLs, dynamic Open
 * Graph metadata for social previews, and Android App Links / Flutter route handling so shared links open
 * directly to the relevant screen/result with minimal drop-off").
 *
 * Why this exists: a Try1Second link shared on WhatsApp used to be a bare URL. The site had og:title and
 * og:description but NO og:image, and /r/<code> answered with a 302, so a crawler never saw any metadata at
 * all — the single most-shared surface in India rendered as plain text.
 *
 * What this module guarantees:
 *  1. A shared RESULT link is a signed, self-contained token (`/s/<token>`). No DB row is needed to render a
 *     preview, and nobody can forge one to put words in our mouth: the payload is HMAC-signed.
 *  2. HONESTY OVER POLISH. A preview may print the price the sharer saw, and it is always labelled with the
 *     time it was seen ("₹45,999 · seen 19 Nov"). The page itself never claims that price is current — the
 *     CTA opens the live search, which is the only place a price is allowed to be final.
 *  3. Every string that reaches the HTML is escaped. A product title is user-influenced data and must never
 *     become markup.
 *  4. Humans get a real page with a working button (which the verified App Links open inside the app when it
 *     is installed); crawlers get the same page and read the OG tags from it.
 */
import crypto from 'node:crypto';

/** Signing key. A dedicated secret is best; otherwise any existing server secret; a constant is the floor. */
function secret(): string {
  return String(process.env.SHARE_SECRET || process.env.SESSION_SECRET || process.env.JWT_SECRET || 't1s-share-v1');
}

const MAX_TOKEN = 900;

export interface SharePayload {
  /** vertical id, e.g. 'movies' */
  v?: string;
  /** the search query the sharer ran */
  q?: string;
  /** city the prices were for */
  c?: string;
  /** card title, e.g. "iPhone 15 128GB" */
  t?: string;
  /** price the sharer saw, in rupees */
  p?: number;
  /** seller that price belonged to */
  s?: string;
  /** unix ms when the sharer saw it */
  ts: number;
}

const b64u = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/** Trim to what a preview can honestly show, so a token cannot be used as free storage. */
export function cleanPayload(raw: any, now = Date.now()): SharePayload {
  const clamp = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const price = Number(raw?.p);
  return {
    v: clamp(raw?.v, 24).toLowerCase() || undefined,
    q: clamp(raw?.q, 120) || undefined,
    c: clamp(raw?.c, 60) || undefined,
    t: clamp(raw?.t, 120) || undefined,
    p: Number.isFinite(price) && price > 0 && price < 100_000_000 ? Math.round(price * 100) / 100 : undefined,
    s: clamp(raw?.s, 60) || undefined,
    ts: Number(raw?.ts) > 0 ? Number(raw.ts) : now,
  };
}

/** Sign a payload into an opaque token: base64url(json) + '.' + base64url(hmac). */
export function mintShareToken(input: any, now = Date.now()): string {
  const payload = cleanPayload(input, now);
  const body = b64u(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = b64u(crypto.createHmac('sha256', secret()).update(body).digest());
  return `${body}.${sig}`;
}

/** Verify and decode. Returns null for anything tampered with, truncated or oversized. */
export function readShareToken(token: unknown): SharePayload | null {
  const raw = String(token ?? '').trim();
  if (!raw || raw.length > MAX_TOKEN) return null;
  const [body, sig] = raw.split('.');
  if (!body || !sig) return null;
  const expected = b64u(crypto.createHmac('sha256', secret()).update(body).digest());
  // constant-time compare, same length guard first
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(unb64u(body).toString('utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    return cleanPayload(parsed);
  } catch {
    return null;
  }
}

/** Escape everything that reaches markup. Product titles are data, never markup. */
export function esc(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const rupees = (n: number): string =>
  `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** "seen 19 Nov" — the honesty label that keeps a shared price from reading as a live quote. */
export function seenLabel(ts: number): string {
  const d = new Date(Number(ts) || Date.now());
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

/** Where a shared result should open: the vertical's own search, carrying the sharer's query and city. */
export function resultsPath(payload: SharePayload): string {
  const vertical = String(payload.v || '').trim();
  const params = new URLSearchParams();
  if (payload.q) params.set('q', payload.q);
  if (payload.c) params.set('city', payload.c);
  const qs = params.toString();
  const base = vertical ? `/${encodeURIComponent(vertical)}` : '/';
  return qs ? `${base}?${qs}` : base;
}

/** The preview copy: what the card says, and what it refuses to say. */
export function previewCopy(payload: SharePayload): { title: string; description: string } {
  const price = typeof payload.p === 'number' ? payload.p : null;
  const head = payload.t || payload.q || 'Live prices on Try1Second';
  const title = price
    ? `${head} at ${rupees(price)}${payload.s ? ` on ${payload.s}` : ''}`
    : `${head} · compare live prices`;
  const bits: string[] = [];
  if (price) bits.push(`Seen at ${rupees(price)}${payload.s ? ` on ${payload.s}` : ''} on ${seenLabel(payload.ts)}.`);
  if (payload.c) bits.push(`Prices for ${payload.c}.`);
  bits.push('Open to check the live price now — sellers change it every minute.');
  return { title: title.slice(0, 110), description: bits.join(' ').slice(0, 220) };
}

interface PageOpts {
  origin: string;
  payload: SharePayload;
  /** optional absolute image; defaults to the site card */
  image?: string;
}

/**
 * The shared-result page: OG tags for the crawler, a readable card for the human, one honest CTA.
 * Deliberately tiny and dependency-free — it is served on the edge path of every shared link.
 */
export function renderSharePage({ origin, payload, image }: PageOpts): string {
  const { title, description } = previewCopy(payload);
  const target = `${origin}${resultsPath(payload)}`;
  const img = image || `${origin}/og-default.png`;
  const priceLine = typeof payload.p === 'number'
    ? `<p class="price">${esc(rupees(payload.p))}<span class="seen">${esc(payload.s ? `on ${payload.s}` : '')}${payload.s ? ' · ' : ''}seen ${esc(seenLabel(payload.ts))}</span></p>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(target)}" />
<meta property="og:type" content="product" />
<meta property="og:site_name" content="Try1Second" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(target)}" />
<meta property="og:image" content="${esc(img)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(img)}" />
<meta name="robots" content="noindex,follow" />
<style>
  :root{color-scheme:light}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;max-width:520px;width:100%;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.06)}
  .bar{height:8px;background:#E7000B}
  .body{padding:22px}
  .kicker{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#E7000B}
  h1{font-size:20px;line-height:1.3;margin:8px 0 4px}
  .price{font-size:28px;font-weight:900;margin:10px 0 2px}
  .seen{display:block;font-size:11px;font-weight:600;color:#64748b;margin-top:4px}
  p.note{font-size:13px;color:#475569;line-height:1.5;margin:12px 0 0}
  a.cta{display:block;text-align:center;margin-top:18px;background:#E7000B;color:#fff;text-decoration:none;font-weight:800;padding:13px 18px;border-radius:12px;font-size:14px}
  .foot{font-size:11px;color:#94a3b8;text-align:center;margin-top:14px}
</style>
</head>
<body>
  <main class="card">
    <div class="bar"></div>
    <div class="body">
      <div class="kicker">Shared from Try1Second</div>
      <h1>${esc(payload.t || payload.q || 'Live price comparison')}</h1>
      ${priceLine}
      <p class="note">${esc(description)}</p>
      <a class="cta" href="${esc(target)}">Check the live price now</a>
      <div class="foot">Try1Second compares flights, hotels, movies, grocery, food, cabs and more.</div>
    </div>
  </main>
</body>
</html>`;
}

/**
 * The referral invite page. Same shape, different promise: it must never claim a reward the invited friend
 * has not earned yet (a referral only pays when the friend actually uses the product).
 */
export function renderInvitePage({ origin, code }: { origin: string; code: string }): string {
  const play = `https://play.google.com/store/apps/details?id=com.try1second.try1second${code ? `&referrer=${encodeURIComponent(`ref=${code}`)}` : ''}`;
  const web = `${origin}/${code ? `?ref=${encodeURIComponent(code)}` : ''}`;
  const title = 'You are invited to Try1Second';
  const description = 'One second. Every price. One screen. Compare flights, hotels, movies, grocery, food, cabs and more — live.';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Try1Second" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(web)}" />
<meta property="og:image" content="${esc(`${origin}/og-default.png`)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(`${origin}/og-default.png`)}" />
<meta name="robots" content="noindex,follow" />
<style>
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;max-width:520px;width:100%;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.06)}
  .bar{height:8px;background:#E7000B}
  .body{padding:22px}
  h1{font-size:22px;margin:6px 0 8px}
  p{font-size:14px;color:#475569;line-height:1.55;margin:0 0 10px}
  .code{font-family:ui-monospace,monospace;font-weight:800;color:#0f172a}
  a.cta{display:block;text-align:center;margin-top:16px;background:#E7000B;color:#fff;text-decoration:none;font-weight:800;padding:13px 18px;border-radius:12px;font-size:14px}
  a.alt{display:block;text-align:center;margin-top:10px;color:#0f172a;text-decoration:none;font-weight:700;font-size:13px;border:1px solid #e2e8f0;padding:11px 18px;border-radius:12px}
  .foot{font-size:11px;color:#94a3b8;margin-top:14px}
</style>
</head>
<body>
  <main class="card">
    <div class="bar"></div>
    <div class="body">
      <h1>You are invited to Try1Second</h1>
      <p>One second. Every price. One screen. Flights, hotels, bus, movies, grocery, food, cabs, e-commerce, loans, insurance, credit cards, accounts and nearby — compared live.</p>
      ${code ? `<p>Invite code: <span class="code">${esc(code)}</span></p>` : ''}
      <a class="cta" href="${esc(play)}">Get the Android app</a>
      <a class="alt" href="${esc(web)}">Continue on the website</a>
      <div class="foot">Your friend earns a reward only when you actually use Try1Second — no signup-only credits.</div>
    </div>
  </main>
</body>
</html>`;
}

/** Crawlers that build the preview card. They must get HTML, never a redirect. */
export function isLinkPreviewBot(userAgent: unknown): boolean {
  const ua = String(userAgent || '');
  return /whatsapp|facebookexternalhit|facebot|twitterbot|telegrambot|slackbot|discordbot|linkedinbot|pinterest|embedly|redditbot|skypeuripreview|vkshare|w3c_validator|googlebot|bingbot|applebot|iframely|quora link preview|outbrain|nuzzel|qwantify|bitlybot|tumblr/i.test(ua);
}
