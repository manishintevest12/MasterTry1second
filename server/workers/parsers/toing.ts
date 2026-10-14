/**
 * Toing (Swiggy's budget food app, in.swiggy.android.toing) parsers.
 *
 * Reverse-engineered from the Toing APK (v4.119.0, Aptoide) — the app is a native
 * shell over Swiggy's discovery backend at disc.swiggy.com:
 *   - POST /api/v1/json/shell/toing-app?lat&lng  body {}                     -> home feed
 *       cursor pagination: body {pageOffset: success.pageOffset.nextOffset,
 *                                 widgetOffset: success.pageOffset.widgetOffset}
 *     cards[].card.card = RestaurantDishGroup (restaurant + featured dishes with
 *     real Toing prices in PAISE).
 *   - POST /api/v2/dynamicmenu/{restaurantId}?lat&lng  body {}               -> full menu
 *     cards[].card.card = ItemCategory with itemCards[].card.card = Dish
 *     (info.price in paise, isVeg, inStock, imageId).
 *
 * Toing has NO web ordering surface (toingit.com is a static marketing landing);
 * per owner policy offers are labelled "available only on app" at redirection.
 * Nothing here is invented: every field comes from those two JSON responses.
 */
import { createHash } from 'crypto';
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const TOING_IMG = 'https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto,w_400,h_400,c_fit/';

export interface ToingRestaurant {
  id: string;
  name: string;
  areaName?: string;
  city?: string;
  cuisines?: string[];
  avgRating?: number | string;
  costForTwo?: string;
  eta?: string;
  cloudinaryImageId?: string;
  slugs?: { restaurant?: string; city?: string };
}

interface ToingDishInfo {
  id?: string;
  name?: string;
  price?: number;
  description?: string;
  imageId?: string;
  inStock?: number | boolean;
  isVeg?: number;
  isBestseller?: boolean;
  ratings?: any;
}

/** Extract restaurant + its featured dish cards from one shell page's cards[]. */
export function toingShellGroups(json: string): { restaurants: ToingRestaurant[]; dishesByRestaurant: Map<string, ToingDishInfo[]>; ok: boolean } {
  let d: any;
  try { d = JSON.parse(json); } catch { return { restaurants: [], dishesByRestaurant: new Map(), ok: false }; }
  const restaurants: ToingRestaurant[] = [];
  const dishesByRestaurant = new Map<string, ToingDishInfo[]>();
  const cards: any[] = d?.success?.cards || [];
  const seen = new Set<string>();
  for (const c of cards) {
    const g = c?.card?.card?.dishGroup;
    const info = g?.restaurant?.info;
    if (!info?.name || !info?.id) continue;
    if (seen.has(String(info.id))) continue;
    seen.add(String(info.id));
    const rest: ToingRestaurant = {
      id: String(info.id),
      name: String(info.name),
      areaName: info.areaName ? String(info.areaName) : undefined,
      cuisines: Array.isArray(info.cuisines) ? info.cuisines.map(String) : undefined,
      avgRating: info.avgRating ?? undefined,
      costForTwo: info.costForTwo ? String(info.costForTwo) : undefined,
      eta: info.sla?.slaString ? String(info.sla.slaString) : undefined,
      cloudinaryImageId: info.cloudinaryImageId ? String(info.cloudinaryImageId) : undefined,
    };
    restaurants.push(rest);
    const dishes: ToingDishInfo[] = [];
    for (const dw of Array.isArray(g?.dishes) ? g.dishes : []) {
      const di = dw?.info;
      if (di?.name && typeof di.price === 'number' && di.price > 0) dishes.push(di);
    }
    dishesByRestaurant.set(rest.id, dishes);
  }
  return { restaurants, dishesByRestaurant, ok: !!d?.success };
}

/** Next page cursor for the shell endpoint (pass back as body.pageOffset/widgetOffset). */
export function toingShellCursor(json: string): { pageOffset?: string; widgetOffset?: Record<string, string> } {
  let d: any;
  try { d = JSON.parse(json); } catch { return {}; }
  const po = d?.success?.pageOffset;
  if (!po?.nextOffset) return {};
  return { pageOffset: String(po.nextOffset), widgetOffset: po.widgetOffset };
}

/** Full-menu dishes from /api/v2/dynamicmenu/{restaurantId}. */
export function toingMenuDishes(json: string): ToingDishInfo[] {
  let d: any;
  try { d = JSON.parse(json); } catch { return []; }
  const cards: any[] = d?.success?.cards || [];
  const out: ToingDishInfo[] = [];
  const seen = new Set<string>();
  for (const c of cards) {
    const cat = c?.card?.card;
    if (!cat || !String(cat['@type'] || '').endsWith('ItemCategory')) continue;
    for (const ic of Array.isArray(cat.itemCards) ? cat.itemCards : []) {
      const di = ic?.card?.card?.info ?? ic?.card?.info ?? ic?.info;
      if (di?.name && typeof di.price === 'number' && di.price > 0) {
        const key = String(di.id || di.name);
        if (!seen.has(key)) { seen.add(key); out.push(di); }
      }
    }
  }
  return out;
}

/** Map a dish (paise) + restaurant into a pipeline offer. App-only platform. */
export function toingItem(
  source: SourceConfig,
  sourceUrl: string,
  rest: ToingRestaurant,
  di: ToingDishInfo,
  city: string,
  fingerprint: string,
  priceBasis: string,
): RawSourceItem {
  const img = di.imageId
    ? `${TOING_IMG}${String(di.imageId)}`
    : rest.cloudinaryImageId ? `${TOING_IMG}${rest.cloudinaryImageId}` : '';
  const rating = di.ratings?.aggregatedRating?.rating;
  const ratingCount = di.ratings?.aggregatedRating?.ratingCountV2;
  const inStock = di.inStock === 1 || di.inStock === true;
  return newRawItem(source, {
    title: String(di.name).slice(0, 200),
    price: Math.round(di.price as number) / 100,
    currency: 'INR',
    seller: 'Toing',
    // Toing has no web ordering; toingit.com is the official landing. The offer is
    // explicitly app-only per owner deeplink policy.
    sellerUrl: 'https://www.toingit.com/',
    availability: inStock ? 'in_stock' : 'out_of_stock',
    location: { city },
    attributes: {
      restaurant: String(rest.name).slice(0, 120),
      ...(rest.areaName ? { area: String(rest.areaName).slice(0, 80) } : {}),
      ...(img ? { image_url: img } : {}),
      ...(di.description ? { dish_description: String(di.description).replace(/\s+/g, ' ').trim().slice(0, 220) } : {}),
      ...(rating ? { rating: String(rating) } : (rest.avgRating ? { rating: String(rest.avgRating) } : {})),
      ...(ratingCount ? { rating_count: String(ratingCount) } : {}),
      ...(Array.isArray(rest.cuisines) && rest.cuisines.length ? { cuisines: rest.cuisines.slice(0, 4).join(', ') } : {}),
      ...(rest.eta ? { eta: String(rest.eta).toLowerCase() } : {}),
      ...(rest.costForTwo ? { cost_for_two: String(rest.costForTwo) } : {}),
      ...(di.isVeg === 1 ? { veg: 'veg' } : {}),
      ...(di.isBestseller ? { bestseller: 'yes' } : {}),
      platform: 'Toing',
      availability_note: 'available only on app — Toing is an app-only platform; order via the Toing app',
      price_basis: priceBasis,
    },
    evidence: {
      sourceUrl,
      sourceReference: `${rest.id}:${di.id || di.name}`,
      rawFingerprint: fingerprint,
      extractedFields: ['title', 'price', ...(img ? ['image'] : []), ...(rating ? ['rating'] : []), 'availability'],
    },
  });
}

/** Fingerprint helper shared by the worker. */
export function toingFingerprint(json: string): string {
  return createHash('sha256').update(json.slice(0, 50000)).digest('hex');
}
