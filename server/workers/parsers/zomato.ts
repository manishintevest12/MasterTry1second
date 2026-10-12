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
        seller: it.name.slice(0, 200),
        sellerUrl: it.url ? `https://www.zomato.com${String(it.url).split('?')[0]}` : searchUrl,
        currency: 'INR',
        location: { city: '' },
        attributes: {
          ...(it.servesCuisine ? { cuisines: it.servesCuisine.slice(0, 160) } : {}),
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
