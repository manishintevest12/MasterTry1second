/**
 * Food worker (India). A food search runs ONLY this worker.
 * Real restaurant listings from Zomato's public city pages. Dish prices are not
 * exposed to plain HTTP; they stay unknown (never invented).
 */
import { registerVerticalWorker, looksLikeChallenge, type VerticalWorker } from '../verticalWorker';
import { parseZomatoRestaurants } from '../parsers/zomato';
import { AcquisitionError } from '../../common/httpClient';

/** Zomato city slugs for major Indian cities (others are tried as lowercase city names). */
const ZOMATO_SLUGS: Record<string, string> = {
  'new delhi': 'ncr', delhi: 'ncr', ncr: 'ncr', gurgaon: 'ncr', noida: 'ncr', faridabad: 'ncr', ghaziabad: 'ncr',
  bengaluru: 'bangalore', bangalore: 'bangalore',
  mumbai: 'mumbai', pune: 'pune', hyderabad: 'hyderabad', chennai: 'chennai', kolkata: 'kolkata',
  ahmedabad: 'ahmedabad', jaipur: 'jaipur', lucknow: 'lucknow', chandigarh: 'chandigarh',
  indore: 'indore', nagpur: 'nagpur', surat: 'surat', vadodara: 'vadodara', bhopal: 'bhopal',
  patna: 'patna', kochi: 'kochi', coimbatore: 'coimbatore', goa: 'goa', 'panaji': 'goa',
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
      sourceId: 'w_food_zomato',
      name: 'Food worker: Zomato public restaurant listings',
      priority: 10,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || '');
        const slug = citySlug(ctx.query.location?.city, raw);
        if (!slug) return [];
        const term = String(ctx.query.entityName || raw).replace(/\b(in|near)\s+[a-z\s]+$/i, '').trim();
        const url = `https://www.zomato.com/${slug}/restaurants?q=${encodeURIComponent(term || 'restaurants')}`;
        const r = await ctx.fetch(url);
        if (r.status !== 200) throw new AcquisitionError('FORBIDDEN', `Zomato HTTP ${r.status}`, r.status);
        const items = parseZomatoRestaurants(r.body, ctx.source, url, 'Zomato');
        if (!items.length && looksLikeChallenge(r.body)) throw new AcquisitionError('ACCESS_CHALLENGE', 'Zomato presented a challenge page');
        return items;
      },
    },
  ],
};
registerVerticalWorker(foodWorker);
