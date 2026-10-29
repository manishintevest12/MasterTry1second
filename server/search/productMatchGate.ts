/**
 * Feed-side product gate for e-commerce searches (owner 28 Oct).
 *
 * Complaint: "iphone 18 search krta hoon tho kabhi iphone 18 pro aata hai kabhi
 * kuch aur, ek consistent result nahi aata."
 *
 * Cause: the query-relevance/accessory gate (server/search/queryRelevance.ts) was
 * only ever applied to CATALOGUE replay rows, on the assumption that a live worker
 * "fetches by the user's own query, so it is inherently relevant". That assumption
 * is false for the marketplaces: Myntra/Amazon answer "iphone 18" with iPhone 18
 * BACK COVERS, and because the feed is price-sorted those ₹599-999 accessories sit
 * on top while the real ₹1,64,900 phones land at the bottom (or not at all when
 * only one fast source answered). Which junk appears first depends on which source
 * replied in time — hence "kabhi kuch aur".
 *
 * This gate runs on LIVE and CATALOGUE e-commerce rows alike:
 *   1. an accessory/supplement of the queried product is never the product;
 *   2. when the query states a MODEL NUMBER ("iphone 18", "s24", "wh-1000xm5") the
 *      row must carry that number; a 17 Pro Max is not an iPhone 18;
 *   3. a price far below the band every other seller agrees on is a mis-parsed tile
 *      or a knock-off ("CG MOBILE iPhone 18 Pro" at ₹6,999 next to ₹1,64,900).
 * Nothing here invents or re-prices data: rows are only withheld, never rewritten,
 * and a lone row is always kept (the page then keeps polling for the rest).
 */
import { isAccessoryOfQuery } from './queryRelevance';
import { sharesIdentity } from '../lens/sameProduct';
import { dropImplausiblePrices } from '../lens/pricePlausibility';

/** Model numbers / sizes that identify one variant: "18", "s24", "1000xm5", "256gb". */
function numericTokens(text: string): string[] {
  return String(text || '').toLowerCase().match(/\d+/g) || [];
}

function containsNumber(title: string, token: string): boolean {
  return new RegExp(`(^|[^0-9])${token}([^0-9]|$)`).test(String(title || '').toLowerCase());
}

export interface FeedGateResult<T> {
  kept: T[];
  dropped: Array<{ row: T; reason: 'accessory' | 'model' | 'implausible' }>;
}

/**
 * Filter one e-commerce result set for a typed query. Row identity is judged on the
 * TITLE only (the same rule the comparison page uses), so a seller's category tags
 * cannot smuggle a cover in as an iPhone.
 */
export function gateFeedProductRows<T extends { title?: string }>(
  rows: T[],
  rawQuery: string,
  priceOf: (row: T) => number,
): FeedGateResult<T> {
  const query = String(rawQuery || '').trim();
  if (!rows.length || query.length < 2) return { kept: rows, dropped: [] };

  const dropped: Array<{ row: T; reason: 'accessory' | 'model' | 'implausible' }> = [];
  const afterAccessory: T[] = [];
  for (const row of rows) {
    const title = String(row.title || '');
    if (!title) { afterAccessory.push(row); continue; }
    if (isAccessoryOfQuery(title, query)) { dropped.push({ row, reason: 'accessory' }); continue; }
    afterAccessory.push(row);
  }

  // Only a query that names a model/size can demand that number in the title: a
  // generic query ("mobile phone", "shoes") must stay a browse search.
  const wanted = numericTokens(query);
  let afterModel = afterAccessory;
  if (wanted.length) {
    afterModel = [];
    for (const row of afterAccessory) {
      const title = String(row.title || '');
      if (!title || (sharesIdentity(query, title) && wanted.every((n) => containsNumber(title, n)))) {
        afterModel.push(row);
      } else {
        dropped.push({ row, reason: 'model' });
      }
    }
  }

  // A knock-off tile undercuts the real product by 90%; withhold it rather than let it
  // pose as the cheapest price of a Rs.50,000+ phone. dropImplausiblePrices keeps a
  // single lonely row, so one honest result can never disappear here.
  let kept = afterModel;
  if (wanted.length && afterModel.length > 1) {
    const priced = afterModel.map((row) => ({ row, price: priceOf(row) }));
    const band = dropImplausiblePrices(priced);
    kept = band.kept.map((x) => x.row);
    for (const d of band.dropped) dropped.push({ row: d.row, reason: 'implausible' });
  }

  return { kept, dropped };
}

/**
 * Collapse one seller's colour variants (owner 28 Oct, follow-up to the identity
 * gate: "iPhone 18" answered with 130 cards, most of them the same Reliance/Croma/
 * Flipkart listing in Burgundy, Black, Silver, Glacier...). Same shop + same model +
 * same capacity = ONE card at that shop's cheapest price; the number of variants it
 * merged is carried in `variantCount` (the comparison page already renders it).
 * Capacity is NOT collapsed: a 512 GB is a different, more expensive product.
 */
const COLOUR_WORDS = new Set([
  'burgundy', 'black', 'silver', 'glacier', 'white', 'blue', 'green', 'pink', 'gold', 'grey',
  'gray', 'purple', 'red', 'orange', 'yellow', 'teal', 'titanium', 'natural', 'desert', 'space',
  'graphite', 'midnight', 'starlight', 'lavender', 'violet', 'beige', 'bronze', 'copper',
  'cosmic', 'nebula', 'charcoal', 'cream', 'marble', 'sage', 'coral', 'mint', 'navy',
]);

function variantSignature(title: string): string {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s./-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !COLOUR_WORDS.has(w))
    .join(' ')
    .trim();
}

export function collapseSellerVariants<T extends { title?: string; seller?: string; variant?: string }>(
  rows: T[],
  priceOf: (row: T) => number,
): T[] {
  const groups = new Map<string, { best: T; bestPrice: number; count: number; firstIndex: number }>();
  const order: string[] = [];
  rows.forEach((row, index) => {
    const seller = String(row.seller || '').toLowerCase().trim();
    const sig = variantSignature(String(row.title || ''));
    if (!seller || !sig) { order.push(`solo:${index}`); groups.set(`solo:${index}`, { best: row, bestPrice: priceOf(row), count: 1, firstIndex: index }); return; }
    const key = `${seller}|${sig}`;
    const existing = groups.get(key);
    const price = priceOf(row);
    if (!existing) {
      groups.set(key, { best: row, bestPrice: price, count: 1, firstIndex: index });
      order.push(key);
      return;
    }
    existing.count += 1;
    const better = price > 0 && (existing.bestPrice <= 0 || price < existing.bestPrice);
    if (better) { existing.best = row; existing.bestPrice = price; }
  });
  return order.map((key) => {
    const g = groups.get(key)!;
    if (g.count <= 1) return g.best;
    const attrs = { ...((g.best as any).attributes || {}), variantCount: g.count };
    return { ...(g.best as any), attributes: attrs } as T;
  });
}

/**
 * Image backfill (owner 29 Oct: "sirf reliance ka bina image wala aa jata hai").
 *
 * A merchant that publishes a listing without a photo (Reliance Digital does this on a
 * whole class of search pages) used to take the lead slot of its group and the card
 * rendered the grey "PRODUCT" placeholder even though the SAME product, listed by a
 * sibling shop, carried a real photo minutes earlier. A photo of the same product is a
 * fact about that product, not an invention: share it across the group when the group
 * itself is identified by a catalogue entity id or by an identical model title.
 * Rows are never re-priced, re-titled or given another product's picture.
 */
const LOGO_OR_FAVICON = /(favicon|s2\/favicons|brand-logos\/|logo[-_]?\d|\/logos?\/|placeholder|no[-_]?image|default\.(png|jpe?g|webp))/i;

function imageOf(row: any): string {
  const direct = String(row?.imageUrl || '');
  if (direct && !LOGO_OR_FAVICON.test(direct)) return direct;
  const list = Array.isArray(row?.images) ? row.images : [];
  for (const u of list) {
    const s = String(u || '');
    if (s && !LOGO_OR_FAVICON.test(s)) return s;
  }
  return '';
}

function mediaKey(row: any): string {
  const entity = row?.canonicalEntityId ?? row?.canonical_entity_id;
  if (entity !== null && entity !== undefined && String(entity).trim() !== '') {
    return `e:${String(entity)}`;
  }
  const sig = variantSignature(String(row?.title || ''));
  return sig ? `t:${sig}` : '';
}

export function backfillRowImages<T extends Record<string, any>>(rows: T[]): T[] {
  if (!Array.isArray(rows) || rows.length < 2) return rows;
  const donor = new Map<string, string>();
  for (const row of rows) {
    const key = mediaKey(row);
    const img = imageOf(row);
    if (!key || !img) continue;
    const seen = donor.get(key);
    // Prefer the biggest gallery? No: first real photo wins, it is the same product.
    if (!seen) donor.set(key, img);
  }
  if (!donor.size) return rows;
  return rows.map((row) => {
    if (imageOf(row)) return row;
    const key = mediaKey(row);
    const img = key ? donor.get(key) : '';
    if (!img) return row;
    const images = Array.isArray(row.images) && row.images.length ? row.images : [img];
    return { ...row, imageUrl: img, images } as T;
  });
}
