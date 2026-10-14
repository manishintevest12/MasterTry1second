/**
 * Expedia Group hotels parser (hotels vertical, price+metadata).
 *
 * www.expedia.com and www.hotels.com are both the Expedia Group "shopping-pwa"
 * storefront (same LodgingCard GraphQL, same inventory). Browserless recipe
 * (reverse-engineered 14 Oct 2026, sandbox-verified 50 cards per query):
 *   1. GET https://www.<site>/Hotel-Search?destination=<city>,%20India&d1=..&d2=..
 *      with curl_cffi impersonation — Akamai Bot Manager blocks chrome TLS from
 *      datacenter IPs (429 "Bot or Not?") but accepts safari (expedia.com) and
 *      safari17_0 / chrome_android (hotels.com). The GET primes _abck/bm cookies
 *      and yields the DUAID (window."duaid" or DUAID cookie).
 *   2. POST https://www.<site>/graphql  operationName LodgingPropertySearch
 *      with client-info: shopping-pwa,<hash>,<region>, x-page-id: page.Hotel-Search,H,20.
 *      Response: data.propertySearch.propertySearchListings[] … on LodgingCard
 *      { id, headingSection.heading, priceSection.priceSummary.options[0]
 *        .displayPrice.formatted ("$310"), mediaSection.gallery.media[0]
 *        .media(Image).url, cardLink.resource.relativePath }.
 * Introspection is disabled; fields were mapped via live validation errors and
 * the SSR __PLUGIN_STATE__ card shape. Prices display in the site's currency
 * (USD for .com) and are reported exactly as listed.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const EXPEDIA_GRAPHQL_QUERY = `query LodgingPropertySearch($context: ContextInput!, $criteria: PropertySearchCriteriaInput) {
  propertySearch(context: $context, criteria: $criteria) {
    __typename
    propertySearchListings {
      __typename
      ... on LodgingCard {
        id
        headingSection { heading }
        priceSection { priceSummary { options { displayPrice { formatted } } } }
        mediaSection { gallery { media { media { ... on Image { url } } } } }
        cardLink { resource { ... on HttpURI { relativePath } } }
      }
    }
  }
}`;

export function parsePriceFormatted(f: string | undefined): { value: number; currency: string } {
  const m = String(f || '').replace(/\s/g, '').match(/(₹|\$|€|£)?([\d,]+(?:\.\d+)?)/);
  if (!m) return { value: 0, currency: 'USD' };
  const n = Number(m[2].replace(/,/g, ''));
  const cur = m[1] === '₹' ? 'INR' : m[1] === '€' ? 'EUR' : m[1] === '£' ? 'GBP' : 'USD';
  return { value: Number.isFinite(n) && n > 0 ? n : 0, currency: cur };
}

export interface ExpediaCard {
  id?: string; heading?: string; price?: string; image?: string; rel?: string;
}

/** Walk the GraphQL JSON into a flat card list (validated: name + real price only). */
export function parseExpediaGroup(body: string, source: SourceConfig, site: string, checkin: string, checkout: string): RawSourceItem[] {
  let d: any;
  try { d = JSON.parse(body); } catch { return []; }
  const listings = (((d?.data?.propertySearch)?.propertySearchListings) || []) as any[];
  const origin = `https://www.${site}`;
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  const today = new Date().toISOString().slice(0, 10);
  for (const L of listings.slice(0, 60)) {
    if (L?.__typename !== 'LodgingCard') continue;
    const name = String(L?.headingSection?.heading || '').trim();
    if (!name || seen.has(name)) continue;
    const { value: price, currency } = parsePriceFormatted(String(L?.priceSection?.priceSummary?.options?.[0]?.displayPrice?.formatted || ''));
    if (!price) continue; // never publish a price we did not see
    seen.add(name);
    const img = String(L?.mediaSection?.gallery?.media?.[0]?.media?.url || '').replace(/^http:/, 'https:');
    const rel = String(L?.cardLink?.resource?.relativePath || '');
    const url = rel ? `${origin}${rel.startsWith('/') ? rel : `/${rel}`}` : origin;
    const sellerUrl = `${url}${url.includes('?') ? '&' : '?'}chkin=${checkin}&chkout=${checkout}`;
    out.push(newRawItem(source, {
      title: name.slice(0, 200),
      price,
      currency,
      seller: site === 'hotels.com' ? 'Hotels.com' : 'Expedia',
      sellerUrl,
      attributes: {
        image: img,
        ...(img ? { image_url: img } : {}),
        data_note: `Nightly rate observed on ${site} live listing API, ${today}`,
      },
      identifiers: L?.id ? { vendorProductId: String(L.id) } : undefined,
      evidence: { sourceUrl: sellerUrl, extractedFields: ['title', 'price', 'image', 'url'] },
    }));
  }
  return out;
}
