/**
 * Tata CLiQ parser. The web SPA calls a dedicated search BFF:
 *   GET https://searchbff.tatacliq.com/v2/products/mpl/search
 *       ?searchText=<q>:relevance:inStockFlag:true&originalSearchText=<q>
 *       &isTextSearch=true&...&pageSize=20&typeID=all&channel=mobile
 * guarded by x-auth / X-ACCESS-TOKEN headers (AES-192-CBC of the current
 * epoch seconds with a key embedded, obfuscated, in the SPA bundle —
 * extracted 13 Oct 2026; see worker). Response is a list of "response"
 * groups (display_text variants) each with product_search_page.search_result[].
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

interface CliqPrice {
  doubleValue?: number;
  formattedValue?: string;
}

interface CliqProduct {
  ussid?: string;
  productId?: string;
  productname?: string;
  productTitle?: string;
  brandname?: string;
  webURL?: string;
  imageURL?: string;
  inStockFlag?: boolean;
  discountPercent?: number;
  averageRating?: number;
  totalNoOfReviews?: number;
  price?: {
    isRange?: boolean;
    sellingPrice?: CliqPrice;
    mrpPrice?: CliqPrice;
  };
}

export function parseTataCliq(rawBody: string, source: SourceConfig, pageUrl: string): RawSourceItem[] {
  let root: any;
  try { root = JSON.parse(rawBody); } catch { return []; }
  const groups: any[] = Array.isArray(root?.response) ? root.response : [];
  const items: RawSourceItem[] = [];
  const seen = new Set<string>();
  for (const grp of groups) {
    const results: CliqProduct[] = grp?.product_search_page?.search_result || [];
    for (const p of results) {
      const name = String(p.productname || p.productTitle || '').trim();
      const price = Number(p.price?.sellingPrice?.doubleValue);
      if (!name || !Number.isFinite(price) || price <= 0) continue;
      const sku = String(p.ussid || p.productId || '');
      if (sku && seen.has(sku)) continue;
      if (sku) seen.add(sku);
      const mrpVal = Number(p.price?.mrpPrice?.doubleValue);
      const mrp = Number.isFinite(mrpVal) && mrpVal > price ? mrpVal : undefined;
      const brand = p.brandname ? String(p.brandname) : undefined;
      const rel = String(p.webURL || '');
      const url = rel ? `https://www.tatacliq.com${rel.startsWith('/') ? rel : `/${rel}`}` : 'https://www.tatacliq.com';
      let img: string | undefined;
      const rawImg = String(p.imageURL || '');
      if (rawImg) img = rawImg.startsWith('http') ? rawImg : `https:${rawImg}`;
      items.push(newRawItem(source, {
        title: (brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${name}` : name).slice(0, 200),
        brand,
        model: p.productId ? String(p.productId) : undefined,
        price,
        listPrice: mrp,
        currency: 'INR',
        seller: 'Tata CLiQ',
        sellerUrl: url,
        attributes: {
          brand: brand || '',
          discount: p.discountPercent ? `${p.discountPercent}%` : '',
          image: img || '',
          in_stock: p.inStockFlag === false ? 'false' : 'true',
          ...(p.averageRating ? { rating: String(p.averageRating) } : {}),
          ...(p.totalNoOfReviews ? { review_count: String(p.totalNoOfReviews) } : {}),
          data_note: `Product as listed on Tata CLiQ search API, observed ${new Date().toISOString().slice(0, 10)}`,
        },
        identifiers: sku ? { sku } : undefined,
        evidence: { sourceUrl: pageUrl, extractedFields: ['title', 'price', 'mrp', 'brand', 'discount', 'image', 'url'] },
      }));
      if (items.length >= 40) return items;
    }
  }
  return items;
}
