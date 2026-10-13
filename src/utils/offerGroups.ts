import type { ComparisonItem } from '../types';

/**
 * Generic "one product = one card" grouping for every vertical except hotels (which has its own
 * richer grouper). The SAME product/flight/dish/movie/route offered by several websites becomes ONE
 * group; each site's real price is a row inside it, cheapest first (Skyscanner / Trivago style).
 * Nothing is invented: every row is a real offer from its own source. A product that only one site
 * publishes simply stays a one-row group.
 */

export interface OfferRow {
  item: ComparisonItem;
  /** Website/seller that publishes this price (the deeplink target). */
  site: string;
  price: number;
  priceAvailable: boolean;
}

export interface OfferGroup {
  key: string;
  vertical: string;
  /** Representative item (the cheapest priced row, falling back to the richest listing). */
  lead: ComparisonItem;
  rows: OfferRow[]; // cheapest first, price-less last
  best: OfferRow;
  /** Highest listed price among rows (for "save X" hints). */
  highest?: number;
}

const spec = (it: ComparisonItem, ...ks: string[]): string => {
  for (const k of ks) {
    const v = it.specs?.[k] ?? it.specs?.[k.toLowerCase()];
    if (v && String(v).trim() && String(v) !== 'undefined') return String(v);
  }
  return '';
};

const norm = (s: string): string =>
  String(s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Words that never distinguish one product from another. */
const NOISE = /\b(the|a|an|of|and|with|for|by|new|latest|original|combo|pack|buy|online|india|official|store|limited|ltd|pvt)\b/g;
const tokens = (s: string): string =>
  [...new Set(norm(s).replace(NOISE, ' ').split(' ').filter(Boolean))].sort().join(' ');

const hhmm = (v: string): string => {
  const m = v.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return norm(v);
  let h = parseInt(m[1], 10);
  const ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
};

/** Seller/site name for a row: the website that published THIS price. */
export function siteName(it: ComparisonItem): string {
  const q = it.sellerQuotes?.find((x) => x.isLowest) || it.sellerQuotes?.[0];
  return q?.sellerName || it.provider || 'Seller';
}

/** Identity of "the same product" per vertical. Empty key = never merge (stands alone). */
export function offerKey(it: ComparisonItem): string {
  const v = it.vertical;
  if (v === 'flights') {
    const no = norm(spec(it, 'flight number'));
    const date = norm(spec(it, 'departure date', 'travel date', 'date'));
    const dep = hhmm(spec(it, 'departure time'));
    if (no) return `f|${no}|${date}|${dep}`;
    const route = norm(spec(it, 'route'));
    return `f|${norm(it.provider)}|${route}|${date}|${dep}|${norm(it.title)}`;
  }
  if (v === 'bus') {
    const op = norm(spec(it, 'operator') || it.provider);
    const dep = hhmm((spec(it, 'departure') || '').split('→')[0] || spec(it, 'departure time'));
    const type = norm(spec(it, 'seat type', 'bus type') || it.features?.[0] || '');
    // Route-level summaries (zingbus lowest fare etc.) stand alone, keyed by their own title.
    if (!dep || dep === '') return `b|${norm(it.title)}|${norm(it.provider)}`;
    return `b|${op}|${dep}|${type}`;
  }
  if (v === 'cab') {
    return `c|${norm(spec(it, 'pickup'))}|${norm(spec(it, 'drop'))}|${norm(spec(it, 'vehicle type'))}|${norm(spec(it, 'trip type'))}`;
  }
  if (v === 'food') {
    // Same dish from the same restaurant on different delivery apps = one card.
    const rest = norm(spec(it, 'restaurant'));
    return `fd|${tokens(it.title)}|${rest}`;
  }
  if ((v as string) === 'movies' || (v as string) === 'movie') {
    return `m|${tokens(it.title)}`;
  }
  if (v === 'loans') {
    return `l|${tokens(it.title)}|${norm(spec(it, 'loan type'))}`;
  }
  if (v === 'insurance') {
    return `i|${tokens(it.title)}|${norm(spec(it, 'insurance type'))}`;
  }
  if (v === 'grocery') {
    // Same product AND same pack size across quick-commerce apps.
    return `g|${tokens(it.title.replace(/\(([^)]*)\)/g, ' $1 '))}|${norm(spec(it, 'quantity'))}`;
  }
  // ecommerce: same product title across marketplaces (brand + model words).
  return `e|${tokens(it.title)}|${norm(spec(it, 'brand'))}`;
}

const priced = (it: ComparisonItem) => !!it.primaryPrice && it.primaryPrice > 0 && it.priceAvailable !== false;

/** Movies carry several per-site prices inside ONE item's sellerQuotes: expand them into rows. */
function rowsFor(it: ComparisonItem): OfferRow[] {
  if (((it.vertical as string) === 'movies' || (it.vertical as string) === 'movie') && (it.sellerQuotes?.length || 0) > 1) {
    return it.sellerQuotes.map((q) => ({
      item: { ...it, sellerQuotes: [q], primaryPrice: q.price, priceAvailable: q.price > 0 } as ComparisonItem,
      site: q.sellerName,
      price: q.price,
      priceAvailable: q.price > 0,
    }));
  }
  return [{ item: it, site: siteName(it), price: it.primaryPrice || 0, priceAvailable: priced(it) }];
}

export function groupOffers(items: ComparisonItem[]): OfferGroup[] {
  const groups = new Map<string, OfferGroup>();
  for (const it of items) {
    const key = offerKey(it);
    for (const row of rowsFor(it)) {
      let g = groups.get(key);
      if (!g) {
        g = { key, vertical: it.vertical, lead: it, rows: [row], best: row };
        groups.set(key, g);
        continue;
      }
      // Same website listing the exact same product twice: keep the cheaper one only.
      const dupIdx = g.rows.findIndex((r) => r.site === row.site);
      if (dupIdx >= 0) {
        const cur = g.rows[dupIdx];
        const better = row.priceAvailable && (!cur.priceAvailable || row.price < cur.price);
        if (better) g.rows[dupIdx] = row;
        continue;
      }
      g.rows.push(row);
    }
  }
  const out = [...groups.values()];
  for (const g of out) {
    g.rows.sort((a, b) => {
      if (a.priceAvailable !== b.priceAvailable) return a.priceAvailable ? -1 : 1;
      return a.price - b.price;
    });
    g.best = g.rows[0];
    // Lead = the listing carrying the most metadata (image/description) among rows, but priced by the best row.
    const richest = [...g.rows].sort(
      (a, b) =>
        (b.item.imageUrl ? 2 : 0) + (b.item.description ? 1 : 0) - ((a.item.imageUrl ? 2 : 0) + (a.item.description ? 1 : 0)),
    )[0];
    g.lead = richest.item;
    const prices = g.rows.filter((r) => r.priceAvailable).map((r) => r.price);
    g.highest = prices.length > 1 ? Math.max(...prices) : undefined;
  }
  return out;
}
