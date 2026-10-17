/**
 * Goibibo hotels SSR parser (17 Oct 2026).
 *
 * Target: https://www.goibibo.com/hotels/hotels-in-<city-slug>[-ct]/
 *
 * From sandbox + Browserbase (US) IPs Akamai serves a literal 8-byte
 * "200 - OK" stub for EVERY /hotels/* path (while /flights/* SEO pages on
 * the same IP serve full 1.5MB __NEXT_DATA__ SSR) — a path-scoped bot gate,
 * not a global IP burn. Goibibo's flights SEO pages ship the hotel-grade
 * __NEXT_DATA__ SSR pipeline, so the hotel SEO pages almost certainly carry
 * the full listing state in props.pageProps when served from an accepted
 * (e.g. production Hostinger) IP.
 *
 * This parser is deliberately SHAPE-TOLERANT: it walks the whole
 * __NEXT_DATA__ JSON for arrays of objects that look like hotel listings
 * (a name-ish key plus a price-ish key), so it self-activates on production
 * without us guessing the exact state path. Nothing is invented — if no
 * hotel-shaped objects exist, it returns [] and the worker reports honest
 * EMPTY_RESPONSE / ACCESS_CHALLENGE.
 */

const NAME_KEYS = ['name', 'displayName', 'hotelName', 'hotel_name', 'propertyName', 'title'];
const PRICE_KEYS = ['price', 'fare', 'total', 'totalPrice', 'sellingPrice', 'amount', 'perNight', 'baseFare', 'finalPrice'];
const RATING_KEYS = ['rating', 'hotelRating', 'userRating', 'starRating', 'goibiboRating'];
const IMG_KEYS = ['image', 'imgUrl', 'imageUrl', 'thumbnail', 'hotelImage', 'mainImage', 'imageURL'];

interface WalkHit {
  obj: Record<string, any>;
  score: number;
}

/** Recursively collect arrays of candidate hotel objects. */
function walk(node: any, out: WalkHit[], depth = 0): void {
  if (depth > 9 || !node) return;
  if (Array.isArray(node)) {
    if (node.length >= 3 && node.length <= 800) {
      const scored = node
        .filter((x) => x && typeof x === 'object' && !Array.isArray(x))
        .map((x) => scoreHotelLike(x as Record<string, any>))
        .filter((x) => x.score > 0);
      // a real listing list: MOST of its members look like hotels
      if (scored.length >= Math.max(3, Math.floor(node.length * 0.6))) {
        out.push(...scored);
      }
    }
    for (const x of node) walk(x, out, depth + 1);
    return;
  }
  if (typeof node === 'object') {
    for (const v of Object.values(node)) walk(v, out, depth + 1);
  }
}

function keyMatches(key: string, keys: string[]): boolean {
  const lk = key.toLowerCase();
  return keys.some((n) => {
    const ln = n.toLowerCase();
    return lk === ln || lk.endsWith('.' + ln);
  });
}

function scoreHotelLike(o: Record<string, any>): WalkHit {
  let score = 0;
  const flat = flatten(o, 0, 3);
  for (const k of Object.keys(flat)) {
    if (keyMatches(k, NAME_KEYS)) score += 2;
    if (keyMatches(k, PRICE_KEYS)) score += 3;
    if (keyMatches(k, RATING_KEYS)) score += 1;
    if (keyMatches(k, IMG_KEYS)) score += 1;
  }
  return { obj: flat, score };
}

/** Shallow-flatten nested objects so any nesting of price/name fields is seen. */
function flatten(o: Record<string, any>, depth: number, maxDepth: number, prefix = ''): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(o || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && depth < maxDepth) {
      Object.assign(out, flatten(v, depth + 1, maxDepth, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

function pickFirst(flat: Record<string, any>, keys: string[]): any {
  for (const [k, v] of Object.entries(flat)) {
    const lk = k.toLowerCase();
    if (keys.some((n) => lk === n.toLowerCase()) || keys.some((n) => lk.endsWith('.' + n.toLowerCase()))) return v;
  }
  return undefined;
}

export interface ParsedGoibiboHotel {
  name: string;
  price: number;
  rating?: number;
  image?: string;
  locality?: string;
  url?: string;
}

export function parseGoibiboHotelsSsr(body: string): ParsedGoibiboHotel[] {
  const m = /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(body);
  if (!m) return [];
  let data: any;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const hits: WalkHit[] = [];
  walk(data, hits);
  // strongest matches first
  hits.sort((a, b) => b.score - a.score);
  const out: ParsedGoibiboHotel[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    if (h.score < 5) continue; // needs at least a name + a price
    const name = String(pickFirst(h.obj, NAME_KEYS) || '').trim();
    let price = Number(pickFirst(h.obj, PRICE_KEYS)) || 0;
    if (Array.isArray(pickFirst(h.obj, PRICE_KEYS))) price = Number((pickFirst(h.obj, PRICE_KEYS) as any[])[0]) || 0;
    if (!name || !Number.isFinite(price) || price < 100 || price > 10_000_000) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const rating = Number(pickFirst(h.obj, RATING_KEYS)) || undefined;
    let image = String(pickFirst(h.obj, IMG_KEYS) || '');
    if (image && image.startsWith('//')) image = 'https:' + image;
    const locality = String(pickFirst(h.obj, ['locality', 'area', 'address', 'location']) || '');
    const slug = String(pickFirst(h.obj, ['slug', 'hotelUrl', 'url', 'link']) || '');
    out.push({ name, price, rating, image: image || undefined, locality: locality || undefined, url: slug || undefined });
    if (out.length >= 60) break;
  }
  return out;
}
