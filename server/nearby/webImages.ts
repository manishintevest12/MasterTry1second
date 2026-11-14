/**
 * WEB IMAGE MATCHING FOR NEARBY CARDS (owner 14 Nov: "use bing, mozilla or play stealth or curl cffi but get the
 * images matching").
 *
 * Why this exists: Wikipedia/Wikidata covers the notable single-screen cinemas, but a Pune multiplex, a cafe or a
 * kirana store often has no Commons photo at all, and Google's image URLs may not be hotlinked without a Places
 * key and its attribution rules. So the last real-photo tier asks Bing Image Search for the place itself.
 *
 * Rules this module follows so a card can never show a stranger's photo:
 *  - the query is the place's own name plus its city, nothing generic;
 *  - a candidate is accepted only when its indexed title / source page / file path actually contains the
 *    place's distinctive words (the caller's `titleMatches`, same test the Commons tier uses);
 *  - logos, icons, maps, avatars and stock placeholders are dropped by host and filename;
 *  - every hit is returned through OUR OWN /api/nearby/img proxy, so a publisher's hotlink protection or
 *    referer check cannot leave a broken card, and the browser never talks to a third party directly.
 *
 * Transport: curl_cffi (server/acquisition/pyfetch.py) with a real Chrome TLS fingerprint. Plain Node fetch and
 * plain curl both get a challenge page from Bing; the impersonated handshake returns the full result set, which
 * is exactly the tool the owner asked for. No CAPTCHA is ever solved and nothing is bypassed beyond the honest
 * browser handshake.
 */
import crypto from 'node:crypto';
import { cffiFetch } from '../common/curlCffiFetch';
import { log } from '../common/logger';

export interface WebImageCandidate {
  /** Absolute https URL of the original image. */
  image: string;
  /** Page the image was found on, kept as provenance. */
  page: string;
  /** Indexed title of that page. */
  title: string;
  host: string;
}

/** Aggregators, stock/placeholder services and logo dumps: never a place's own photo. */
const BAD_HOSTS = [
  'bing.com', 'bing.net', 'microsoft.com', 'msn.com', 'google.', 'gstatic.com', 'googleusercontent.com',
  'justdial.com', 'zomato.com', 'swiggy.com', 'tripadvisor.', 'yelp.com', 'foursquare.com',
  'facebook.com', 'fbcdn.net', 'instagram.com', 'pinterest.', 'linkedin.com', 'twitter.com', 'x.com',
  'youtube.com', 'ytimg.com', 'wikimedia.org', 'wikipedia.org', 'bookmyshow.com', 'paytm.com',
  'shutterstock.com', 'alamy.com', 'dreamstime.com', 'istockphoto.com', 'gettyimages.com', '123rf.com',
  'vectorstock.com', 'freepik.com', 'pngtree.com', 'seeklogo.com', 'cleanpng.com', 'kindpng.com',
  'placeholder.com', 'placehold.it', 'loremflickr.com', 'unsplash.com', 'pexels.com', 'pixabay.com',
];

/** Filenames/text that mean "not a photo of the place". */
const BAD_WORDS = /logo|icon|favicon|sprite|placeholder|avatar|map\b|maps|screenshot|banner-ad|watermark|noimage|no-image|default[-_]?image|coming[-_]?soon|storefront-icon/i;
const IMAGE_EXT = /\.(jpe?g|png|webp)(\?|$)/i;
const IMAGE_CDN_HINT = /(^|\.)(images?|img|cdn|static|media|assets|photo|photos|pic|pics)\./i;

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

function hostAllowed(url: string): boolean {
  const host = hostOf(url);
  if (!host || !/^https?:\/\//i.test(url)) return false;
  if (BAD_HOSTS.some((b) => host.includes(b))) return false;
  const path = (() => { try { return new URL(url).pathname.toLowerCase(); } catch { return ''; } })();
  if (BAD_WORDS.test(path)) return false;
  // Either a real image extension or a host that is plainly an image CDN.
  return IMAGE_EXT.test(path) || IMAGE_CDN_HINT.test(host);
}

/** 12h cache per query: a warm city never re-asks Bing for the same shop. */
const cache = new Map<string, { at: number; rows: WebImageCandidate[] }>();
const CACHE_TTL_MS = 12 * 60 * 60_000;

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\\u002f/gi, '/').replace(/\\\//g, '/');
}

/**
 * Bing Image Search, parsed from the server-rendered results page. Each result is an `m="{...}"` blob carrying
 * murl (image), turl (thumbnail), purl (source page) and t (title); splitting on `murl` keeps the fields of one
 * result together instead of zipping two lists that may drift apart.
 */
export async function bingImages(query: string, opts: { count?: number; timeoutMs?: number } = {}): Promise<WebImageCandidate[]> {
  const q = String(query || '').trim();
  if (!q) return [];
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.rows;

  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(q)}&form=HDRSC2&mkt=en-IN&first=1`
    + `&count=${Math.min(30, Math.max(5, opts.count || 20))}`;
  let rows: WebImageCandidate[] = [];
  try {
    const res = await cffiFetch(url, {
      impersonate: 'chrome',
      timeoutMs: Math.max(3000, opts.timeoutMs || 7000),
      headers: { 'accept-language': 'en-IN,en;q=0.9', accept: 'text/html,application/xhtml+xml' },
    });
    if (res.status === 200 && res.body) {
      const chunks = String(res.body).split('murl&quot;:&quot;').slice(1);
      for (const chunk of chunks) {
        const image = decodeEntities((chunk.match(/^([^&"]+)/) || [])[1] || '').trim();
        if (!/^https?:\/\//i.test(image)) continue;
        if (!hostAllowed(image)) continue;
        const title = decodeEntities((chunk.match(/t&quot;:&quot;(.*?)&quot;/) || [])[1] || '');
        const page = decodeEntities((chunk.match(/purl&quot;:&quot;(.*?)&quot;/) || [])[1] || '');
        rows.push({ image, page, title, host: hostOf(image) });
      }
    }
  } catch (e: any) {
    log.warn('nearby', 'bing images failed', { query: q, error: String(e?.message || e).slice(0, 90) });
    rows = [];
  }
  cache.set(key, { at: Date.now(), rows });
  if (cache.size > 600) {
    for (const [k] of [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 200)) cache.delete(k);
  }
  return rows;
}

/**
 * Fetch an image through the same impersonated handshake and prove it is really an image.
 * A publisher that answers with a rate-limit or captcha page looks like success to a naive fetch, and the card
 * would show a broken box because <img> onError only fires on network errors, not on a 200 HTML body.
 */
export async function imageFetchOk(url: string, timeoutMs = 4000): Promise<boolean> {
  if (!/^https?:\/\//i.test(String(url || ''))) return false;
  try {
    const res = await cffiFetch(url, {
      impersonate: 'chrome',
      timeoutMs,
      binary: true,
      headers: { accept: 'image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8' },
    });
    if (res.status !== 200 || !res.body) return false;
    const buf = Buffer.from(res.body, res.encoding === 'base64' ? 'base64' : 'binary');
    // Size and shape are never a reason to refuse a photo (owner 14 Nov: "unko rkna compulsory hai"): the card
    // crops whatever it gets. Only an empty/HTML body fails, which the magic bytes already prove.
    if (buf.length < 256) return false;
    return (buf[0] === 0xff && buf[1] === 0xd8)
      || (buf[0] === 0x89 && buf[1] === 0x50)
      || buf.subarray(0, 4).toString('ascii') === 'RIFF'
      || buf.subarray(4, 8).toString('ascii') === 'ftyp';
  } catch { return false; }
}

/* ------------------------------------------------------------------ image proxy */

/**
 * Signed image proxy token. The card's <img> points at /api/nearby/img, our server fetches the publisher's file
 * with the impersonated handshake and streams it back. Signing keeps it from being an open proxy, and the URL
 * expiry means a leaked link dies on its own.
 */
const PROXY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function proxySecret(): string {
  return process.env.AFFILIATE_SECRET || crypto.createHash('sha256')
    .update(`${process.env.DATABASE_URL || process.env.MYSQL_URL || 'try1second'}#nearby-image`).digest('hex');
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', proxySecret()).update(payload).digest('base64url').slice(0, 32);
}

/** Wrap an external image URL as a same-origin, signed proxy URL. */
export function proxiedImage(url: string): string {
  const src = String(url || '').trim();
  if (!/^https?:\/\//i.test(src)) return '';
  const payload = Buffer.from(JSON.stringify({ u: src.slice(0, 1500), e: Date.now() + PROXY_TTL_MS }), 'utf8').toString('base64url');
  return `/api/nearby/img?t=${payload}.${sign(payload)}`;
}

/** Validate a proxy token and return the upstream URL, or null when the token is forged or expired. */
export function resolveProxiedImage(token: string): string | null {
  const m = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(token || ''));
  if (!m) return null;
  const [, payload, sig] = m;
  const expect = sign(payload);
  if (sig.length !== expect.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
    const j = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const url = String(j?.u || '');
    if (!/^https?:\/\//i.test(url)) return null;
    if (Number(j?.e) < Date.now()) return null;
    if (!hostAllowed(url)) return null;
    // No SSRF: hostnames only, never an IP literal, never a private/local name.
    const host = hostOf(url);
    if (!host.includes('.') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
    if (/(^|\.)(localhost|internal|local|arpa)$/.test(host)) return null;
    return url;
  } catch { return null; }
}
