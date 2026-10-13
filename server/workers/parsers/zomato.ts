/**
 * Zomato restaurant-listing parser (food vertical, India). Zomato's public city
 * search pages embed a JSON-LD ItemList of Restaurant entries (name, cuisine,
 * rating, review count, address, profile URL). Menu prices are NOT exposed to
 * plain HTTP and stay unknown — never invented.
 */
import { createHash } from 'crypto';
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

interface RestaurantItem {
  name?: string; url?: string; image?: string;
  servesCuisine?: string;
  address?: { streetAddress?: string };
  aggregateRating?: { ratingValue?: number | string; reviewCount?: number | string };
}

export function parseZomatoRestaurants(html: string, source: SourceConfig, searchUrl: string, platform: string): RawSourceItem[] {
  const fingerprint = createHash('sha256').update(html.slice(0, 50000)).digest('hex');
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    let d: any;
    try { d = JSON.parse(m[1]); } catch { continue; }
    const list = d?.['@type'] === 'ItemList' ? d.itemListElement : null;
    if (!Array.isArray(list)) continue;
    for (const el of list) {
      const it: RestaurantItem | undefined = el?.item || el;
      if (!it?.name) continue;
      if (seen.has(it.name)) continue;
      seen.add(it.name);
      const rating = it.aggregateRating?.ratingValue;
      const reviews = it.aggregateRating?.reviewCount;
      out.push(newRawItem(source, {
        title: it.name.slice(0, 200),
        seller: platform || 'Zomato',
        sellerUrl: it.url ? `https://www.zomato.com${String(it.url).split('?')[0]}` : searchUrl,
        currency: 'INR',
        location: { city: '' },
        attributes: {
          restaurant: it.name.slice(0, 200),
          ...(it.servesCuisine ? { cuisines: it.servesCuisine.slice(0, 160) } : {}),
          ...(typeof it.image === 'string' && /^https:\/\//.test(it.image) ? { image_url: it.image.slice(0, 400) } : {}),
          ...(rating !== undefined ? { rating: String(rating) } : {}),
          ...(reviews !== undefined ? { review_count: String(reviews) } : {}),
          ...(it.address?.streetAddress ? { address: it.address.streetAddress.slice(0, 160) } : {}),
          platform,
          data_note: 'Restaurant listing from public Zomato pages; dish prices are not exposed and remain unknown',
        },
        evidence: {
          sourceUrl: searchUrl,
          sourceReference: it.name,
          rawFingerprint: fingerprint,
          extractedFields: ['title', ...(rating !== undefined ? ['rating'] : []), ...(it.servesCuisine ? ['cuisines'] : [])],
        },
      }));
    }
  }
  return out.slice(0, 40);
}


/** Dish found while walking a Zomato restaurant page's embedded JSON (JSON-LD hasMenu
 *  or window.__PRELOADED_STATE__): a {name, price} pair that looks like a real menu item. */
export interface ZomatoDish { name: string; price: number; description?: string; }

function walkMenuJson(node: any, out: ZomatoDish[], depth = 0) {
  if (!node || depth > 12) return;
  if (Array.isArray(node)) { for (const n of node) walkMenuJson(n, out, depth + 1); return; }
  if (typeof node !== 'object') return;
  const t = String(node['@type'] || '');
  // Schema.org MenuItem: { name, description, offers: { price } }
  if ((t === 'MenuItem' || t === 'MenuSection') && node.name && node.offers) {
    const p = Number(node.offers.price ?? node.offers.lowPrice ?? NaN);
    if (Number.isFinite(p) && p > 0) out.push({ name: String(node.name).slice(0, 160), price: Math.round(p), description: node.description ? String(node.description).slice(0, 200) : undefined });
  }
  // Structure-agnostic: any {name, price} object that smells like a real dish (protects
  // against Zomato restructuring its preloaded state — extraction stays evidence-driven).
  if (!t && node.name && (node.price !== undefined || node.item_price !== undefined || node.price_incl !== undefined)) {
    const p = Number(node.price ?? node.item_price ?? node.price_incl ?? NaN);
    const nm = String(node.name).trim();
    if (Number.isFinite(p) && p >= 10 && p <= 12000 && nm.length >= 3 && nm.length <= 160) {
      out.push({ name: nm.slice(0, 160), price: Math.round(p) });
    }
  }
  for (const v of Object.values(node)) walkMenuJson(v, out, depth + 1);
}

/** Parse ONE Zomato restaurant page for embedded menu prices (JSON-LD hasMenu first,
 *  then window.__PRELOADED_STATE__ / __NEXT_DATA__ style blobs). Prices only appear if
 *  Zomato actually served them to plain HTTP — nothing invented. `hints` reports what the
 *  page contained so production logs tell us the truth when nothing parses. */
export function parseZomatoMenuPage(html: string): { dishes: ZomatoDish[]; hints: Record<string, number> } {
  const hints: Record<string, number> = { jsonLdBlocks: 0, hasMenu: 0, preloadedState: 0, priceHits: 0 };
  const dishes: ZomatoDish[] = [];
  const seen = new Set<string>();
  const add = (d: ZomatoDish) => { const k = `${d.name}|${d.price}`; if (!seen.has(k)) { seen.add(k); dishes.push(d); } };
  hints.priceHits = (html.match(/"(?:price|item_price|price_incl)"\s*:/g) || []).length;

  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    hints.jsonLdBlocks += 1;
    if (m[1].includes('hasMenu') || m[1].includes('MenuItem')) hints.hasMenu += 1;
    try { const tmp: ZomatoDish[] = []; walkMenuJson(JSON.parse(m[1]), tmp); tmp.forEach(add); } catch { /* skip broken block */ }
  }
  if (dishes.length) return { dishes: dishes.slice(0, 30), hints };

  const pre = /window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i.exec(html)
    || /__NEXT_DATA__[^>]*>(\{[\s\S]*?\})<\/script>/i.exec(html);
  if (pre) {
    hints.preloadedState += 1;
    try { const tmp: ZomatoDish[] = []; walkMenuJson(JSON.parse(pre[1]), tmp); tmp.forEach(add); } catch { /* unparsable state */ }
  }
  return { dishes: dishes.slice(0, 30), hints };
}
