/**
 * Ixigo hotels parser — hotels vertical. (owner metasearch policy, 13 Oct 2026)
 *
 * Ixigo is a metasearch: used as ACQUISITION PROVIDER only, never as seller.
 * The SEO listing route https://www.ixigo.com/hotels/hotels-in-<city> is a
 * Next.js Pages Router SSR page whose __NEXT_DATA__ embeds
 * props.pageProps.hotelsData.result.searchResults[] with hotel names, ratings
 * and per-night displayedBaseFare. The SELLER surfaced to the user is the HOTEL
 * PROPERTY itself; the deeplink goes to the hotel brand's own website when the
 * chain is known (Radisson -> radissonhotels.com, ...) and otherwise to an
 * honest web-search redirect for the property's official site — never to Ixigo.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

interface IxigoHotel {
  name?: string;
  locality?: string;
  city?: string;
  userRating?: string;
  userRatingCount?: number;
  userRatingCategory?: string;
  starRating?: number;
  fareDetail?: { displayedBaseFare?: number };
  seoSummary?: string;
  hotelId?: number;
  imageInfoList?: Array<{ [k: string]: any }>;
  geoLocationInfo?: any;
  topOfferings?: string[];
}

/** Known hotel chains: brand token -> the brand's OWN booking website (never the metasearch). */
const CHAIN_SITES: Array<[RegExp, string]> = [
  [/radisson|park inn|country inn/i, 'https://www.radissonhotels.com/en-in/'],
  [/marriott|courtyard|renaissance|le meridien|westin|sheraton|four points|aloft|moxy|st\.? regis|ritz/i, 'https://www.marriott.com/'],
  [/hilton|doubletree|embassy suites|hampton/i, 'https://www.hilton.com/en/'],
  [/holiday inn|intercontinental|crowne plaza|indigo|voco|avid|ihg/i, 'https://www.ihg.com/'],
  [/novotel|ibis|mercure|sofitel|pullman|fairmont|swissotel|movenpick|mövenpick|247|accent|grand mercure|all seasons/i, 'https://all.accor.com/'],
  [/taj|vivanta|ginger| SeleQtions/i, 'https://www.tajhotels.com/en-in/'],
  [/oberoi|trident/i, 'https://www.oberoigroup.com/'],
  [/itc ?hotel|welcome ?hotel|welcomhotel|fortune ?park/i, 'https://www.itchotels.com/'],
  [/lemon ?tree/i, 'https://www.lemontreehotels.com/'],
  [/the park|zone by the park/i, 'https://theparkhotels.com/'],
  [/hyatt|grand hyatt|hyatt ?regency|hyatt ?centric|andaz/i, 'https://www.hyatt.com/'],
  [/shangri-?la/i, 'https://www.shangri-la.com/'],
  [/kempinski/i, 'https://www.kempinski.com/'],
  [/four seasons/i, 'https://www.fourseasons.com/'],
  [/the grand|leela/i, 'https://www.theleela.com/'],
  [/oyo/i, 'https://www.oyorooms.com/'],
  [/fabhotel/i, 'https://www.fabhotels.com/'],
  [/treebo/i, 'https://treebohotels.com/'],
  [/zebnest|zostel/i, 'https://www.zostel.com/'],
  [/the orchid/i, 'https://www.orchidhotel.com/'],
  [/royal orchid/i, 'https://www.royalorchidhotels.com/'],
  [/sun-n-sand|sun n sand/i, 'https://www.sunnsandhotels.com/'],
];

function pickImage(h: IxigoHotel): string | undefined {
  const list = h.imageInfoList;
  if (Array.isArray(list)) {
    for (const e of list) {
      const u = e?.imageUrl || e?.url || e?.thumbUrl || e?.mainImage || e?.image;
      if (typeof u === 'string' && u) return u.replace(/^http:/, 'https:');
      const dyn = e?.dynamicImageUrl || e?.cdnUrl;
      if (typeof dyn === 'string' && dyn) return dyn.replace(/^http:/, 'https:');
    }
  }
  return undefined;
}

/** Brand site if the property belongs to a known chain, else an honest web-search redirect for the official site. */
function siteFor(name: string, city: string): { url: string; chain: boolean } {
  for (const [re, url] of CHAIN_SITES) {
    if (re.test(name)) return { url, chain: true };
  }
  const q = encodeURIComponent(`${name} ${city} hotel official website booking`);
  return { url: `https://www.google.com/search?q=${q}`, chain: false };
}

export function parseIxigoHotels(html: string, source: SourceConfig, pageUrl: string, city: string): RawSourceItem[] {
  const m = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) return [];
  let root: any;
  try { root = JSON.parse(m[1]); } catch { return []; }
  const results: IxigoHotel[] = root?.props?.pageProps?.hotelsData?.result?.searchResults;
  if (!Array.isArray(results)) return [];
  const items: RawSourceItem[] = [];
  const today = new Date().toISOString().slice(0, 10);
  for (const h of results.slice(0, 20)) {
    const name = String(h.name || '').trim();
    const fare = Number(h.fareDetail?.displayedBaseFare);
    if (!name || !Number.isFinite(fare) || fare <= 0) continue;
    const site = siteFor(name, h.city || city);
    const img = pickImage(h);
    items.push(newRawItem(source, {
      title: name.slice(0, 200),
      brand: name.slice(0, 200),
      price: Math.round(fare),
      currency: 'INR',
      seller: name.slice(0, 120),
      sellerUrl: site.url,
      location: { city: String(h.city || city) },
      attributes: {
        hotel_id: h.hotelId ? String(h.hotelId) : '',
        locality: String(h.locality || ''),
        city: String(h.city || city),
        star_rating: h.starRating ? String(h.starRating) : '',
        user_rating: h.userRating ? String(h.userRating) : '',
        user_rating_count: h.userRatingCount ? String(h.userRatingCount) : '',
        user_rating_category: String(h.userRatingCategory || ''),
        top_offerings: Array.isArray(h.topOfferings) ? h.topOfferings.slice(0, 5).join(', ') : '',
        image: img || '',
        price_basis: 'per night, base fare as published by Ixigo',
        chain_site: site.chain ? 'brand official website' : 'web search for official site',
        data_note: `Price observed on Ixigo (metasearch) on ${today}; booking is via the hotel's own channels, never via Ixigo`,
      },
      identifiers: h.hotelId ? { sku: String(h.hotelId) } : undefined,
      evidence: { sourceUrl: pageUrl, extractedFields: ['name', 'displayedBaseFare', 'locality', 'city', 'ratings', 'image'] },
    }));
  }
  return items;
}

/** Normalize an arbitrary destination into Ixigo's hotels-in-<city> slug. */
export function ixigoHotelsSlug(city: string): string {
  return `hotels-in-${city.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-')}`;
}
