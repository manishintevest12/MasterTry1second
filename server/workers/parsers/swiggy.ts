/**
 * Swiggy dish-search parser (food vertical, India).
 * Swiggy's public search endpoint (/dapi/restaurants/search/v3) answers plain HTTP and
 * returns real DISH results: dish name, price (paise), dish photo, description, rating,
 * and the restaurant that serves it (name, area, cuisines, ETA). Every field below is
 * taken straight from that response; nothing is invented.
 */
import { createHash } from 'crypto';
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

const IMG = 'https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto,w_400,h_400,c_fit/';

export function parseSwiggyDishes(json: string, source: SourceConfig, searchUrl: string, city: string): RawSourceItem[] {
  let d: any;
  try { d = JSON.parse(json); } catch { return []; }
  const fingerprint = createHash('sha256').update(json.slice(0, 50000)).digest('hex');
  const cards: any[] = [];
  const stack: any[] = [d?.data];
  // Locate the DISH card group wherever Swiggy nests it.
  while (stack.length) {
    const n = stack.pop();
    if (!n || typeof n !== 'object') continue;
    if (n.cardGroupMap?.DISH?.cards) cards.push(...n.cardGroupMap.DISH.cards);
    for (const v of Object.values(n)) if (v && typeof v === 'object') stack.push(v);
    if (cards.length) break;
  }
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  for (const c of cards) {
    const card = c?.card?.card;
    const rest = card?.restaurant?.info;
    const dishes: any[] = Array.isArray(card?.dishes) ? card.dishes : [];
    if (!rest?.name || !dishes.length) continue;
    const restUrl = rest.slugs?.restaurant && rest.slugs?.city
      ? `https://www.swiggy.com/city/${rest.slugs.city}/${rest.slugs.restaurant}-rest${rest.id}`
      : searchUrl;
    for (const dw of dishes) {
      const di = dw?.info;
      if (!di?.name || typeof di.price !== 'number' || di.price <= 0) continue;
      const key = `${rest.id}:${di.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const rating = di.ratings?.aggregatedRating?.rating;
      const ratingCount = di.ratings?.aggregatedRating?.ratingCountV2;
      const img = di.imageId ? `${IMG}${di.imageId}` : (rest.cloudinaryImageId ? `${IMG}${rest.cloudinaryImageId}` : '');
      out.push(newRawItem(source, {
        title: String(di.name).slice(0, 200),
        price: Math.round(di.price) / 100,
        currency: 'INR',
        seller: 'Swiggy',
        sellerUrl: restUrl,
        availability: di.inStock === 1 && rest.availability?.opened !== false ? 'in_stock' : 'out_of_stock',
        location: { city },
        attributes: {
          restaurant: String(rest.name).slice(0, 120),
          ...(rest.areaName ? { area: String(rest.areaName).slice(0, 80) } : {}),
          ...(img ? { image_url: img } : {}),
          ...(di.description ? { dish_description: String(di.description).replace(/\s+/g, ' ').trim().slice(0, 220) } : {}),
          ...(rating ? { rating: String(rating) } : (rest.avgRating ? { rating: String(rest.avgRating) } : {})),
          ...(ratingCount ? { rating_count: String(ratingCount) } : {}),
          ...(Array.isArray(rest.cuisines) && rest.cuisines.length ? { cuisines: rest.cuisines.slice(0, 4).join(', ') } : {}),
          ...(rest.sla?.slaString ? { eta: String(rest.sla.slaString).toLowerCase() } : {}),
          ...(rest.costForTwoMessage ? { cost_for_two: String(rest.costForTwoMessage) } : {}),
          platform: 'Swiggy',
        },
        evidence: {
          sourceUrl: searchUrl,
          sourceReference: `${rest.id}:${di.id}`,
          rawFingerprint: fingerprint,
          extractedFields: ['title', 'price', ...(img ? ['image'] : []), ...(rating ? ['rating'] : []), 'availability'],
        },
      }));
    }
  }
  return out.slice(0, 60);
}
