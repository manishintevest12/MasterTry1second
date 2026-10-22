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
  return qt.size <= 1 ? hits >= 1 : hits / qt.size >= 0.6;
}
