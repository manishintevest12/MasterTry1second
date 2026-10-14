/**
 * Food worker (India). A food search runs ONLY this worker.
 * Real restaurant listings from Zomato's public city pages. Dish prices are not
 * exposed to plain HTTP; they stay unknown (never invented).
 */
import { registerVerticalWorker, looksLikeChallenge, type VerticalWorker } from '../verticalWorker';
import { parseZomatoRestaurants, parseZomatoMenuPage } from '../parsers/zomato';
import { newRawItem } from '../../sources/contract';
import type { RawSourceItem } from '../../types';
import { parseSwiggyDishes } from '../parsers/swiggy';
import { AcquisitionError } from '../../common/httpClient';
import { parseDominosMenu, dominosItems } from '../parsers/dominos';
import { pizzaHutItems } from '../parsers/pizzaHut';
import { toingShellGroups, toingShellCursor, toingMenuDishes, toingItem, toingFingerprint } from '../parsers/toing';
import { cffiFetch } from '../../common/curlCffiFetch';

/** Zomato city slugs for major Indian cities (others are tried as lowercase city names). */
const ZOMATO_SLUGS: Record<string, string> = {
  'new delhi': 'ncr', delhi: 'ncr', ncr: 'ncr', gurgaon: 'ncr', noida: 'ncr', faridabad: 'ncr', ghaziabad: 'ncr',
  bengaluru: 'bangalore', bangalore: 'bangalore',
  mumbai: 'mumbai', pune: 'pune', hyderabad: 'hyderabad', chennai: 'chennai', kolkata: 'kolkata',
  ahmedabad: 'ahmedabad', jaipur: 'jaipur', lucknow: 'lucknow', chandigarh: 'chandigarh',
  indore: 'indore', nagpur: 'nagpur', surat: 'surat', vadodara: 'vadodara', bhopal: 'bhopal',
  patna: 'patna', kochi: 'kochi', coimbatore: 'coimbatore', goa: 'goa', 'panaji': 'goa',
};


/** City-centre coordinates used for Swiggy's location-scoped dish search. */
const CITY_COORDS: Record<string, [number, number]> = {
  'new delhi': [28.6315, 77.2167], delhi: [28.6315, 77.2167], ncr: [28.6315, 77.2167],
  gurgaon: [28.4595, 77.0266], noida: [28.5355, 77.391],
  bengaluru: [12.9716, 77.5946], bangalore: [12.9716, 77.5946],
  mumbai: [19.076, 72.8777], pune: [18.5204, 73.8567], hyderabad: [17.385, 78.4867],
  chennai: [13.0827, 80.2707], kolkata: [22.5726, 88.3639], ahmedabad: [23.0225, 72.5714],
  jaipur: [26.9124, 75.7873], lucknow: [26.8467, 80.9462], chandigarh: [30.7333, 76.7794],
  indore: [22.7196, 75.8577], goa: [15.4909, 73.8278], kochi: [9.9312, 76.2673],
};

function citySlug(city: string | undefined, raw: string): string | null {
  if (city) {
    const c = city.toLowerCase().trim();
    if (ZOMATO_SLUGS[c]) return ZOMATO_SLUGS[c];
  }
  const m = raw.match(/(?:in|near)\s+([a-z\s]{3,20})$/i);
  if (m) {
    const c = m[1].trim().toLowerCase();
    if (ZOMATO_SLUGS[c]) return ZOMATO_SLUGS[c];
    return c.replace(/\s+/g, '-');
  }
  return null;
}

export const foodWorker: VerticalWorker = {
  vertical: 'food',
  tasks: [
    {
      // Domino's India: full national menu SSR'd (entity-encoded JSON) with real prices.
      // Seller = Domino's; web menu deeplink (web ordering works on dominos.co.in).
      sourceId: 'w_food_dominos',
      priority: 13,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || '');
        const dishish = /pizza|margherita|farmhouse|garlic.?bread|taco|burger.?pizza|lava|chicken|wings|parcel|meltz|cheese|dominos|domino.?s/i.test(raw);
        if (!dishish) return []; // only run for dish-relevant queries
        const r = await cffiFetch('https://www.dominos.co.in/menu', { impersonate: 'chrome', timeoutMs: 45_000 });
        if (r.status !== 200) throw new AcquisitionError('ACCESS_CHALLENGE', `Domino's HTTP ${r.status}`);
        const products = parseDominosMenu(r.body);
        if (!products.length) throw new AcquisitionError('EMPTY_RESPONSE', 'Domino\'s menu page carried no parseable products');
        const items = dominosItems(products, ctx.source, raw);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', 'Domino\'s menu had no item matching this query');
        return items;
      },
    },
    {
      // Pizza Hut India: Next.js SSR menu with real rupee prices for most items
      // (customisable variants carry price:null and are skipped).
      sourceId: 'w_food_pizzahut',
      name: 'Food worker: Pizza Hut India menu',
      priority: 13,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || '');
        const dishish = /pizza|margherita|farmhouse|paneer|veggie|cheese|bbq|schezwan|chilli|habanero|nashville|korean|taco|hut|mexican/i.test(raw);
        if (!dishish) return [];
        const url = 'https://www.pizzahut.co.in/menu/pizzas';
        const r = await cffiFetch(url, { impersonate: 'chrome', timeoutMs: 25_000 });
        if (r.status !== 200) throw new AcquisitionError('ACCESS_CHALLENGE', `Pizza Hut HTTP ${r.status}`);
        const items = pizzaHutItems(r.body, ctx.source, raw, url);
        if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', 'Pizza Hut menu carried no priced item matching this query');
        return items;
      },
    },
    {
      sourceId: 'w_food_eatsure',
      name: 'Food worker: EatSure (Rebel Foods) menu',
      priority: 15,
      run: async () => {
        const r = await cffiFetch('https://www.eatsure.com/', { impersonate: 'chrome', timeoutMs: 12_000 });
        throw new AcquisitionError('EMPTY_RESPONSE', `EatSure serves a JS shell to browserless HTTP (menu/prices load via sessioned XHR after city/location selection, no SSR product data). Searched the site, sitemaps and main bundle: no unauthenticated menu API found.`);
      },
    },
    {
      sourceId: 'w_food_ovenstory',
      name: 'Food worker: Oven Story pizza menu',
      priority: 15,
      run: async () => {
        const r = await cffiFetch('https://www.ovenstory.in/', { impersonate: 'chrome', timeoutMs: 12_000 });
        throw new AcquisitionError('EMPTY_RESPONSE', `Oven Story (Rebel Foods) serves a JS shell to browserless HTTP: sitemap lists 334 product URLs but every product page renders the same empty shell; prices load via sessioned XHR only.`);
      },
    },
    {
      sourceId: 'w_food_swiggy',
      name: 'Food worker: Swiggy dish search (dish, price, photo, restaurant)',
      priority: 5,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || '');
        const term = String(ctx.query.entityName || raw).replace(/\b(in|near)\s+[a-z\s]+$/i, '').trim();
        if (!term) return [];
        const cityKey = String(ctx.query.location?.city || '').toLowerCase().trim();
        const c = CITY_COORDS[cityKey] || CITY_COORDS['new delhi'];
        const url = `https://www.swiggy.com/dapi/restaurants/search/v3?lat=${c[0]}&lng=${c[1]}&str=${encodeURIComponent(term)}&trackingId=undefined&submitAction=ENTER&queryUniqueId=t1s${Date.now() % 100000}`;
        const r = await ctx.fetch(url, { expectJson: true, maxBytes: 8_000_000, timeoutMs: 20_000, headers: { Accept: 'application/json' } });
        if (r.status !== 200) throw new AcquisitionError('FORBIDDEN', `Swiggy HTTP ${r.status}`, r.status);
        return parseSwiggyDishes(r.body, ctx.source, url, ctx.query.location?.city || 'New Delhi');
      },
    },
    {
      sourceId: 'w_food_zomato',
      name: 'Food worker: Zomato public restaurant listings',
      priority: 10,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || '');
        const slug = citySlug(ctx.query.location?.city, raw);
        if (!slug) return [];
        const term = String(ctx.query.entityName || raw).replace(/\b(in|near)\s+[a-z\s]+$/i, '').trim();
        const url = `https://www.zomato.com/${slug}/restaurants?q=${encodeURIComponent(term || 'restaurants')}`;
        let r = await ctx.fetch(url);
        // Zomato's edge samples plain-HTTP crawls with 403/202: one bounded retry.
        if (r.status === 403 || r.status === 202 || r.status === 429) {
          await new Promise((res) => setTimeout(res, 1500));
          r = await ctx.fetch(url);
        }
        if (r.status !== 200) throw new AcquisitionError('FORBIDDEN', `Zomato HTTP ${r.status}`, r.status);
        const items = parseZomatoRestaurants(r.body, ctx.source, url, 'Zomato');
        if (!items.length && looksLikeChallenge(r.body)) throw new AcquisitionError('ACCESS_CHALLENGE', 'Zomato presented a challenge page');
        // Deep dive: the search listing carries no prices (which is why Zomato contributed
        // 0 offers to results). Follow the first 2 restaurants and pull DISH prices from
        // their pages' embedded JSON (JSON-LD hasMenu / __PRELOADED_STATE__). Priced dishes
        // pass validation; unpriced listings stay as reference rows only.
        // Menu prices live on the restaurant's /order page (the bare/info pages carry none).
        const toOrder = (u: string) => u.replace(/\/(?:info|order)?\/?$/, '') + '/order';
        const restUrls = items.slice(0, 6).map((it) => String((it as any).sellerUrl || '')).filter((u) => /zomato\.com\//.test(u)).map(toOrder);
        const qTokens = term.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
        const dishItems: RawSourceItem[] = [];
        const hintAgg: Record<string, number> = {};
        for (const ru of restUrls) {
          const rr = await ctx.fetch(ru);
          if (rr.status !== 200) continue;
          const { dishes, hints } = parseZomatoMenuPage(rr.body);
          for (const [k, v] of Object.entries(hints)) hintAgg[k] = (hintAgg[k] || 0) + v;
          const baseUrl = ru.replace(/\/order$/, '');
          const found = items.find((it) => { const su = String((it as any).sellerUrl || ''); return su.replace(/\/(?:info|order)?\/?$/, '') === baseUrl; }) as any;
          const restName = String(found?.title || baseUrl.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'restaurant');
          // Only dishes that match what the user typed (biryani -> biryani dishes), never the whole menu.
          const wanted = qTokens.length ? dishes.filter((d) => qTokens.every((w) => (d.name + ' ' + (d.description || '')).toLowerCase().includes(w))) : dishes;
          for (const d of wanted.slice(0, 8)) {
            dishItems.push(newRawItem(ctx.source, {
              title: d.name,
              brand: 'Zomato',
              price: d.price,
              currency: 'INR',
              seller: 'Zomato',
              sellerUrl: baseUrl + '/order',
              location: { city: ctx.query.location?.city || '' },
              attributes: {
                dish: d.name.slice(0, 160),
                restaurant: restName.slice(0, 160),
                ...(d.image ? { image_url: d.image } : {}),
                platform: 'Zomato',
                ...(d.description ? { description: d.description } : {}),
                price_basis: 'Menu price served in Zomato restaurant page embedded JSON',
                data_note: 'Dish price extracted from the restaurant page on zomato.com; final price at checkout may vary',
              },
              evidence: { sourceUrl: ru, sourceReference: d.name, extractedFields: ['dish', 'price'] },
            }));
          }
          if (dishItems.length >= 24) break;
        }
        if (dishItems.length) return dishItems;
        if (restUrls.length && !hintAgg.priceHits) {
          throw new AcquisitionError('EMPTY_RESPONSE', `Zomato restaurant pages carried no embedded menu prices (hints: ${JSON.stringify(hintAgg)}) — dish prices stay unavailable to browserless HTTP`);
        }
        return items;
      },
    },
    {
      // Toing (Swiggy's budget food app) — reverse-engineered app-only platform.
      // disc.swiggy.com shell feed + dynamicmenu serve REAL Toing dish prices (paise)
      // without auth. No web ordering exists -> offers are labelled app-only per policy.
      sourceId: 'w_food_toing',
      name: 'Food worker: Toing dish prices (Swiggy disc shell feed)',
      priority: 8,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || '');
        const term = String(ctx.query.entityName || raw).replace(/\b(in|near)\s+[a-z\s]+$/i, '').trim();
        if (!term) return [];
        const cityKey = String(ctx.query.location?.city || '').toLowerCase().trim();
        const c = CITY_COORDS[cityKey] || CITY_COORDS['new delhi'];
        const city = ctx.query.location?.city || 'New Delhi';
        const shellUrl = `https://disc.swiggy.com/api/v1/json/shell/toing-app?lat=${c[0]}&lng=${c[1]}`;
        const H = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
        const qTokens = term.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
        // Page 1 + up to 2 cursor pages of the Toing shell feed.
        const groups = new Map<string, { rest: any; dishes: any[]; fp: string }>();
        let body = '{}';
        let pages = 0;
        let firstJson = '';
        for (let i = 0; i < 3; i++) {
          const r = await cffiFetch(shellUrl, { impersonate: 'chrome', method: 'POST', body, timeoutMs: 22_000, headers: H });
          if (r.status !== 200) throw new AcquisitionError('FORBIDDEN', `Toing shell HTTP ${r.status}`, r.status);
          if (!firstJson) firstJson = r.body;
          const g = toingShellGroups(r.body);
          if (!g.ok) throw new AcquisitionError('EMPTY_RESPONSE', 'Toing shell response carried no success block');
          for (const rest of g.restaurants) {
            if (!groups.has(rest.id)) groups.set(rest.id, { rest, dishes: g.dishesByRestaurant.get(rest.id) || [], fp: toingFingerprint(r.body) });
          }
          pages++;
          const cur = toingShellCursor(r.body);
          if (!cur.pageOffset || !cur.widgetOffset) break;
          body = JSON.stringify({ pageOffset: cur.pageOffset, widgetOffset: cur.widgetOffset });
          if (g.restaurants.length >= 25) break; // plenty of coverage already
        }
        if (!groups.size) throw new AcquisitionError('EMPTY_RESPONSE', `Toing shell feed carried no restaurant dish groups (pages=${pages})`);
        // Featured dishes matching the query first (real Toing prices straight from the feed).
        const items: RawSourceItem[] = [];
        const seenDish = new Set<string>();
        const matchDish = (d: any) => {
          if (!qTokens.length) return true;
          const hay = `${d.name || ''} ${(d.description || '')}`.toLowerCase();
          return qTokens.every((w) => hay.includes(w));
        };
        for (const { rest, dishes, fp } of groups.values()) {
          for (const d of dishes) {
            const key = `${rest.id}:${d.id || d.name}`;
            if (seenDish.has(key) || !matchDish(d)) continue;
            seenDish.add(key);
            items.push(toingItem(ctx.source, shellUrl, rest, d, city, fp, 'Featured Toing dish price from the app home feed (disc.swiggy.com shell)'));
          }
        }
        // Deep dive: pull the full Toing menu for up to 6 restaurants to widen dish coverage.
        if (items.length < 12) {
          const restSlice = Array.from(groups.values()).slice(0, 6);
          for (const { rest, fp } of restSlice) {
            if (items.length >= 24) break;
            try {
              const m = await cffiFetch(`https://disc.swiggy.com/api/v2/dynamicmenu/${rest.id}?lat=${c[0]}&lng=${c[1]}`, { impersonate: 'chrome', method: 'POST', body: '{}', timeoutMs: 22_000, headers: H });
              if (m.status !== 200) continue;
              const dishes = toingMenuDishes(m.body);
              for (const d of dishes) {
                const key = `${rest.id}:${d.id || d.name}`;
                if (seenDish.has(key) || !matchDish(d)) continue;
                seenDish.add(key);
                items.push(toingItem(ctx.source, shellUrl, rest, d, city, toingFingerprint(m.body), 'Toing dish price from the restaurant menu (disc.swiggy.com dynamicmenu)'));
                if (items.length >= 24) break;
              }
            } catch { /* per-restaurant failures never kill the whole source */ }
          }
        }
        if (!items.length) {
          throw new AcquisitionError('EMPTY_RESPONSE', `Toing feed listed ${groups.size} restaurants (pages=${pages}) but none matched "${term}"`);
        }
        return items.slice(0, 40);
      },
    },
  ],
};
registerVerticalWorker(foodWorker);
