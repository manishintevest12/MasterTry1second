/**
 * Product-page catalogue coverage (owner 29 Oct, "iphone 16 daala, sirf Flipkart ka results").
 *
 * The product page joined our own MySQL catalogue with a VERTICAL-WIDE lookup: the newest 80
 * rows of ecommerce/grocery, with no query dimension. On a busy catalogue those 80 newest rows
 * belong to other searches, so a product that Amazon / Croma / Reliance / Myntra verified an
 * hour ago sat outside the window and vanished from the comparison - only whichever seller had
 * been saved most recently survived. That is exactly why the same product showed one shop now
 * and five shops a minute later (each new acquisition pushed its own seller into the window).
 *
 * Fix: a query-aware candidate set. Rows whose title carries the product's own words come back
 * first, from every seller, at any row age inside the caller's freshness window. Identity is
 * still decided afterwards by isSameProduct, so nothing looser can enter the compare list.
 */

import { findCatalogueOffers, type CatalogueRow } from './catalogueService';

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'new', 'buy', 'online', 'best', 'price', 'prices',
  'cheap', 'cheapest', 'deal', 'deals', 'offer', 'offers', 'india', 'indian', 'mobile',
  'smartphone', 'smartphones', 'phone', 'phones', 'com', 'www', 'http', 'https',
]);

/** Distinctive words of a product query: "Apple iPhone 16 128 GB" -> ['apple','iphone','128']. */
export function productCatalogueTerms(query: string, max = 3): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of String(query || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
    const w = raw.trim();
    if (w.length < 3) continue;
    if (STOPWORDS.has(w)) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

type Lookup = typeof findCatalogueOffers;

const distinctSellers = (rows: CatalogueRow[]): number =>
  new Set(rows.map((r: any) => String(r.seller || r.vendor || '').toLowerCase().trim()).filter(Boolean)).size;

/**
 * Catalogue rows for THIS product, across sellers.
 *
 * Term-aware lookup first (every seller, any row age); when that candidate set is empty or names
 * fewer than two sellers, the plain vertical lookup runs too and both lists merge - so the answer
 * can never be thinner than the old behaviour, only richer.
 */
export async function findProductCatalogueRows(
  vertical: string,
  opts: { query: string; pincode?: string; city?: string; limit?: number },
  lookup: Lookup = findCatalogueOffers,
): Promise<CatalogueRow[]> {
  const limit = opts.limit ?? 80;
  const base = { pincode: opts.pincode, city: opts.city, limit };
  const terms = productCatalogueTerms(opts.query);
  let targeted: CatalogueRow[] = [];
  if (terms.length) {
    targeted = await Promise.resolve(lookup(vertical, { ...base, queryTerms: terms })).catch(() => []);
  }
  if (targeted.length >= 2 && distinctSellers(targeted) >= 2) return targeted;
  const plain = await Promise.resolve(lookup(vertical, base)).catch(() => []);
  if (!targeted.length) return plain;
  const seen = new Set(targeted.map((r) => String(r.id)));
  return [...targeted, ...plain.filter((r) => !seen.has(String(r.id)))];
}
