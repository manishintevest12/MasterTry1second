/**
 * District by Zomato (merged Paytm Insider movies platform) parser — movies vertical.
 *
 * paytm.com/movies and www.district.in/movies serve the same "district-web"
 * Next.js app (canonical host: www.district.in, per hrefLang). The page ships a
 * schema.org JSON-LD ItemList ("Movie Ticket Booking") with the now-bookable
 * movies, their canonical WEB deeplinks and CDN poster images — no client-side
 * API needed. Owner policy (Oct 2026): District/Paytm is one platform; where a
 * web page accepts user redirection we redirect to the web (these offers do),
 * otherwise the offer must say "available only on app".
 *
 * Strict token matching: only titles containing every query token survive.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';
import { matchesQuery } from './bookmyshow';

export const DISTRICT_MOVIES_URL = 'https://www.district.in/movies/';
export const DISTRICT_SELLER = 'District by Zomato (Paytm)';

export interface DistrictMovie {
  name: string;
  url: string;
  image: string | null;
}


/**
 * District movie page SSR carries a real session-price filter histogram (the same prices the
 * seat-selection flow uses). The cheapest non-empty band gives an honest "tickets from ₹X"
 * and the highest non-empty band the ceiling. Nothing invented: bands with 0 sessions are skipped.
 */
export function districtPriceBands(body: string): { from: number; to: number } | null {
  const buckets: Array<{ lo: number; hi: number; sessions: number }> = [];
  // the histogram appears with varying JSON escaping (\"title\" or plain "title" or \u20b9);
  // anchor on the visible band text and confirm price_* + sessionCount nearby.
  const bandRe = /\u20b9\s?([\d,]+)\s?-\s?\u20b9\s?([\d,]+)/g;
  let m: RegExpExecArray | null;
  while ((m = bandRe.exec(body)) !== null) {
    const win = body.slice(m.index, Math.min(body.length, m.index + 400));
    if (!/price_[0-9_]+/.test(win)) continue;
    const sc = win.match(/sessionCount\\?"?:\s*(\d+)/);
    const sessions = sc ? Number(sc[1]) : 0;
    buckets.push({ lo: Number(m[1].replace(/,/g, '')), hi: Number(m[2].replace(/,/g, '')), sessions });
  }
  const live = buckets.filter((b) => b.sessions > 0);
  if (!live.length) return null;
  live.sort((a, b) => a.lo - b.lo);
  // a "₹0–₹100" bucket means seats under ₹100 exist; the honest 'from' price is the
  // lower bound of the first priced band above zero (or that bucket's ceiling).
  const firstPriced = live.find((b) => b.lo > 0);
  const from = firstPriced ? firstPriced.lo : live[0].hi;
  const to = live.reduce((mx, b) => Math.max(mx, b.hi), 0);
  return from > 0 && to >= from ? { from, to } : null;
}

/** Parse the schema.org ItemList of bookable movies from a District movies page body. */
export function parseDistrictMovies(body: string): DistrictMovie[] {
  const out: DistrictMovie[] = [];
  const re = /<script type="application\/ld\+json">(\{[\s\S]*?\})<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    let d: any;
    try {
      d = JSON.parse(m[1]);
    } catch {
      continue;
    }
    if (d?.['@type'] !== 'ItemList') continue;
    const items = Array.isArray(d.itemListElement) ? d.itemListElement : [];
    for (const it of items) {
      const name = typeof it?.name === 'string' ? it.name.trim() : '';
      const url = typeof it?.url === 'string' ? it.url.trim() : '';
      if (!name || !/^https:\/\/www\.district\.in\/movies\/.+/.test(url)) continue;
      out.push({ name, url, image: typeof it.image === 'string' && it.image.startsWith('http') ? it.image : null });
    }
  }
  return out;
}

/** District movies → raw offers with web deeplinks (price appears in the District seat-selection flow). */
export function parseDistrictOffers(
  movies: DistrictMovie[],
  source: SourceConfig,
  queryTerm: string,
): RawSourceItem[] {
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  for (const mv of movies.slice(0, 25)) {
    if (queryTerm && !matchesQuery(mv.name, queryTerm)) continue; // strict, no fuzzy substitutes
    const key = mv.url.split('/').pop() || mv.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const attrs: Record<string, any> = {
      image_url: mv.image,
      availability: 'now_showing',
      data_note: 'Now-showing discovery from District by Zomato (the merged Paytm Insider movies platform); ticket price appears in the District seat-selection flow',
    };
    out.push(newRawItem(source, {
      title: mv.name,
      seller: DISTRICT_SELLER,
      sellerUrl: mv.url, // the platform's own canonical web deeplink — web redirection works
      currency: 'INR',
      attributes: attrs,
      evidence: {
        sourceUrl: DISTRICT_MOVIES_URL,
        sourceReference: key,
        extractedFields: ['title', 'web_deeplink', 'poster'],
      },
    }));
  }
  return out;
}
