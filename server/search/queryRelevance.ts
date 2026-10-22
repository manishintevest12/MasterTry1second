/**
 * Query-relevance gate for CATALOGUE replay rows (owner 22 Oct).
 *
 * The catalogue lookup is vertical-wide (findCatalogueOffers has no query
 * dimension), so without a gate a fresh-but-unrelated batch — e.g. iPhones
 * recorded minutes ago — supplements EVERY ecommerce search. The owner saw
 * exactly that: the "Picked Just For You" category pills (men's Wrist Watches,
 * Smart Televisions, ...) launched searches that returned the iPhone rows.
 *
 * LIVE acquisition rows are untouched: workers fetch by the user's own query,
 * so they are inherently relevant, and route verticals (flights/bus/cab/hotels)
 * keep their own strict filters. This gate applies only to catalogue replays.
 *
 * Honest math, no AI: a stemmed token-overlap score between the row's
 * title/brand and the typed query. A row passes when it shares at least one
 * distinctive token (4+ chars, stemmed) or two shorter ones. When the query is
 * empty everything passes (browse mode).
 */

const STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'best', 'top', 'new', 'buy', 'get', 'off', 'sale',
  'under', 'over', 'near', 'me', 'in', 'on', 'of', 'to', 'a', 'an', 'at', 'by',
]);

/** Canonical synonyms so a row titled "Smart TV" matches a "Smart Televisions"
 *  query (real listings use the short form; queries use the long form). */
const CANON: Record<string, string> = {
  television: 'tv', telly: 'tv', smartphones: 'phone', smartphone: 'phone', mobiles: 'mobile',
  earphones: 'headphone', earphone: 'headphone', earbuds: 'earbud', laptops: 'laptop',
  // tablet devices: 'Tab' is the short form sellers use ("Idea Tab", "Lenovo Tab")
  tab: 'tablet', tabs: 'tablet', ipad: 'tablet',
};

/** lowercase, strip punctuation, drop stopwords, canonicalize, crude-stem plurals. */
function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of String(text || '').toLowerCase().split(/[^a-z0-9]+/)) {
    if (!raw || raw.length < 2 || STOP.has(raw)) continue; // "men's" -> bare 's' is never distinctive
    let t = raw.replace(/(ies)$/, 'y').replace(/(es|s)$/, '');
    if (!t) t = raw;
    out.add(CANON[raw] ?? CANON[t] ?? t);
  }
  return out;
}

export function queryTokens(q: ParsedQueryLike): Set<string> {
  const parts: string[] = [];
  const raw = (q as any)?.rawQuery || (q as any)?.raw || (q as any)?.query || '';
  const entity = (q as any)?.entityName ? String((q as any).entityName) : '';
  if (raw) parts.push(String(raw));
  if (entity) parts.push(entity);
  const t = (q as any)?.terms;
  if (Array.isArray(t)) parts.push(t.join(' '));
  if (!parts.join('')) return new Set();
  return tokens(parts.join(' '));
}

export interface ParsedQueryLike {
  raw?: string;
  query?: string;
  terms?: unknown;
  [k: string]: unknown;
}

/** Row side: title + brand + category-ish attribute words. */
function rowTokens(offer: {
  title?: string;
  brand?: string | null;
  attributes?: Record<string, string> | null;
}): Set<string> {
  const attrs = offer.attributes || {};
  const parts = [offer.title || '', offer.brand || '', attrs['brand'] || '', attrs['category'] || '', attrs['product_type'] || ''];
  return tokens(parts.join(' '));
}

/**
 * Accessory/supplement intent guard (owner 22 Oct: 'smart tv / tablet pe results
 * nahi aate, fix kro'). Token overlap alone lets an ACCESSORY or SUPPLEMENT of the
 * product pose AS the product — 'tablets' queries surfaced 'Tablet Stand' and
 * 'Multivitamin Tablets', 'mobile power banks' surfaced 'USB Charger & Mobile
 * Holder', a 'laptop' query surfaced laptop bags. If the title is an accessory/
 * supplement of the searched product and the query itself does NOT ask for that
 * accessory/supplement word, the row is NOT the product the user asked for.
 * The 'charging case' phrase is exempt: it is part of TWS earbud products.
 */
const ACCESSORY_RE = /\b(stand|holder|case|cover|sleeve|skin|strap|band|tempered|protector|mount|armband|charger|charging|adapter|cable|pouch|sticker|guard|bag|backpack|dock|keyboard)\b/;
// NOTE: prefix match (no closing \b) so plural/mixed forms match too — 'Probiotics'
// must be caught by 'probiotic' (owner 22 Oct live bug).
const SUPPLEMENT_RE = /\b(multivitamin|supplement|capsule|effervescent|ashwagandha|probiotic|ayurvedic|vitamin|collagen|creatine|omega|glucosamine|melatonin|arnica|homeopath|magnesium|glutathione|biotin|calcium|whey|protein)/;
const CHARGING_CASE_RE = /\bcharging case\b/;

/** True when the title is an accessory/supplement of what the query asks for. */
export function isAccessoryOfQuery(title: string, rawQuery: string): boolean {
  let t = String(title || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  if (!t.trim()) return false;
  // 'Charging Case' is part of the earbud product itself, not a detachable accessory.
  t = t.replace(CHARGING_CASE_RE, ' ');
  const q = String(rawQuery || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  return (ACCESSORY_RE.test(t) && !ACCESSORY_RE.test(q)) || (SUPPLEMENT_RE.test(t) && !SUPPLEMENT_RE.test(q));
}

/** True when the catalogue row is relevant to the typed query. */
export function passesQueryRelevance(
  offer: { title?: string; brand?: string | null; attributes?: Record<string, string> | null },
  parsed: ParsedQueryLike | Record<string, any>,
): boolean {
  const q: ParsedQueryLike = parsed;
  const qt = queryTokens(q);
  if (qt.size === 0) return true; // browse mode — no query typed
  const rt = rowTokens(offer);
  let hits = 0;
  for (const tok of qt) if (rt.has(tok)) hits++;
  // One-token queries need that token; multi-token queries need 60%+ overlap —
  // "smart watches" must no longer admit plain analog wrist watches (owner 22 Oct).
  if (!(qt.size <= 1 ? hits >= 1 : hits / qt.size >= 0.6)) return false;
  // Accessories/supplements of the product are not the product (owner 22 Oct):
  // a 'Tablet Stand' is not an iPad, a 'Multivitamin Tablet' is not a tablet device.
  const rawQuery = String((q as any)?.rawQuery || (q as any)?.raw || (q as any)?.query || '');
  return !isAccessoryOfQuery(String(offer.title || ''), rawQuery);
}
