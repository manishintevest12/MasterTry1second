/**
 * Product photo resolver (owner 27 Oct: "image ni aa raha").
 *
 * A seller row can be perfectly valid and still carry no photo: Zepto's rails ship
 * images in shapes the parser missed, and older catalogue rows were written before
 * galleries were captured. The product page then painted "No photo available" even
 * though the SAME product is sitting in our own catalogue with a photo attached,
 * photographed by a different seller.
 *
 * So: when the row itself has no photo, borrow the photo of the same product family
 * from the catalogue. Same brand + same distinctive tokens, any seller, newest first.
 * This is still real data (a real photo of the real product), never a stock image.
 */
import { getStore } from '../common/db';

const STOP = new Set([
  'with', 'from', 'pack', 'combo', 'offer', 'free', 'best', 'india', 'indian',
  'the', 'and', 'for', 'ml', 'kg', 'gm', 'ltr', 'litre', 'liter', 'gram', 'pcs',
  'piece', 'pieces', 'count', 'now', 'fresh', 'new',
]);

/** Distinctive search tokens: brand-ish words and model numbers, unit words dropped. */
export function imageTokens(query: string): string[] {
  return String(query || '')
    .toLowerCase()
    .replace(/[^a-z0-9.\- ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t) && !/^\d+(\.\d+)?$/.test(t))
    .slice(0, 3);
}

function firstHttps(doc: any): string | null {
  if (!doc) return null;
  const list = [
    doc.image_url,
    ...String(doc.image_urls || '').split('|'),
    doc.image,
    doc.thumbnail,
  ];
  for (const u of list) {
    const s = String(u || '').trim();
    if (s.startsWith('https://')) return s;
  }
  return null;
}

/**
 * Best real photo for a product query, from any seller already in the catalogue.
 * Returns null when the catalogue genuinely has no picture of this product.
 */
/**
 * OWNER 23 Nov ("ab logo dikh raha hai muje bhai real photo chaiye"): the old lookup required EVERY one of the first
 * three tokens to appear in the catalogue title (`AND LOWER(title) LIKE %t1% AND ... %t2% ...`). One stray word -
 * "You Bella Women's Girl's Jewellery Gift Set" carries four - and a product we DO have a photo for came back with
 * nothing, so the card fell through to a seller logo. Matching is now scored: candidates come from the most
 * distinctive token, then a row is accepted when it shares enough tokens (>= 2, and at least half of them). A single
 * distinctive brand/model token is still enough on its own when that token is long and rare (e.g. "kalenji").
 */
export function tokenScore(title: string, tokens: string[]): number {
  const hay = String(title || '').toLowerCase();
  if (!hay || !tokens.length) return 0;
  let hits = 0;
  for (const t of tokens) if (t && hay.includes(t)) hits += 1;
  return hits;
}

/** Does this title match the query closely enough to be the same product family? */
export function isPhotoMatch(title: string, tokens: string[]): boolean {
  if (!tokens.length) return false;
  const hits = tokenScore(title, tokens);
  if (hits === 0) return false;
  if (tokens.length === 1) return tokens[0].length >= 6;
  return hits >= 2 && hits / tokens.length >= 0.5;
}

export async function resolveCatalogueImage(
  query: string,
  vertical: string,
  opts: { excludeSeller?: string } = {},
): Promise<string | null> {
  const tokens = imageTokens(query);
  if (!tokens.length) return null;
  const store = getStore();
  const skip = String(opts.excludeSeller || '').toLowerCase().trim();
  // Search on the single most distinctive token (longest, so "kalenji" beats "men"), then score in memory.
  const probe = [...tokens].sort((a, b) => b.length - a.length)[0];
  const params: unknown[] = [vertical, `%${probe.replace(/[%_]/g, '')}%`];
  try {
    const rows = await store.query<any>(
      `SELECT title, attributes FROM offers
       WHERE vertical = ? AND attributes IS NOT NULL AND attributes LIKE '%image%' AND LOWER(title) LIKE ?
       ORDER BY fetched_at DESC LIMIT 200`,
      params,
    );
    const scored = (rows || [])
      .map((r) => ({ r, score: tokenScore(r.title, tokens) }))
      .filter(({ r }) => !(skip && String(r.title || '').toLowerCase().includes(skip)))
      .filter(({ r }) => isPhotoMatch(String(r.title || ''), tokens))
      .sort((a, b) => b.score - a.score);
    for (const { r } of scored) {
      const url = firstHttps(typeof r.attributes === 'string' ? JSON.parse(r.attributes) : r.attributes);
      if (url) return url;
    }
  } catch {
    /* catalogue hiccup: the caller tries the product's own page next */
  }
  return null;
}

/**
 * Last honest source for a card's photo: the product's OWN page. Every merchant publishes the product photo in
 * `og:image` (it is what WhatsApp and Google show when the link is shared), so reading it is reading the merchant's
 * own picture of that exact product - never the parent product's photo, never a logo.
 *
 * Bounded on purpose: the product page must stay fast, so the caller gives this a small shared deadline and drops a
 * row rather than waiting. Results are memoised, including misses, because partner sites rate-limit hard.
 */

/**
 * The product photo out of a merchant page's own metadata.
 *
 * A site-wide `og:image` is often just its logo (Myntra's homepage answers with `mlogo.png`), and a logo is exactly
 * what the owner said he does not want ("muje real photo chaiye"). So a share image whose URL looks like a brand
 * mark, sprite, banner or placeholder is refused; only a product-looking picture is accepted.
 */
const NOT_A_PRODUCT_PHOTO = /(logo|favicon|sprite|placeholder|default[-_]?image|share[-_]?image|social|brand[-_]?(mark|logo)|site[-_]?icon|opengraph[-_]?default)/i;

export function extractOgImage(html: string): string | null {
  const source = String(html || '');
  if (!source) return null;
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/gi,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/gi,
  ];
  // A page can carry several: a site-wide share image first, the product's own picture after it. Take the first
  // candidate that actually looks like a product photo instead of giving up on the first one.
  for (const re of patterns) {
    for (const m of source.matchAll(re)) {
      const url = String(m[1] || '').trim();
      if (!/^https?:\/\//i.test(url)) continue;
      if (NOT_A_PRODUCT_PHOTO.test(url)) continue;
      return url;
    }
  }
  return null;
}

const ogMemo: Map<string, { url: string | null; at: number }> = ((globalThis as any).__t1sOgMemo ??= new Map());

export async function ogImageFromUrl(pageUrl: string, timeoutMs = 2500): Promise<string | null> {
  const url = String(pageUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) return null;
  const hit = ogMemo.get(url);
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.url;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) { ogMemo.set(url, { url: null, at: Date.now() }); return null; }
    // Only the head carries og:image; read a slice and stop.
    const found = extractOgImage((await res.text()).slice(0, 300_000));
    ogMemo.set(url, { url: found, at: Date.now() });
    if (ogMemo.size > 600) ogMemo.delete(ogMemo.keys().next().value as string);
    return found;
  } catch {
    ogMemo.set(url, { url: null, at: Date.now() });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
