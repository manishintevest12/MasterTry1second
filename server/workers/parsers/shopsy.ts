/**
 * Shopsy (shopsy.in) parser — Flipkart-owned value e-commerce.
 *
 * Shopsy publishes no JSON search API. The SSR page embeds the whole answer in
 * `__NEXT_DATA__`: props.pageProps.initialState.pageData.RESPONSE.slots[], where every
 * PRODUCT_SUMMARY widget carries products[]; each product's productInfo.value holds
 * titles, pricing (finalPrice / mrp), rating, media.images[] and the product path.
 *
 * Measured 5 Nov 2026 against https://www.shopsy.in/search?q=headphones through Chrome
 * TLS impersonation — plain server-side fetches get 403/529 from the Flipkart WAF, which
 * is why the worker calls cffiFetch with impersonate: 'chrome'.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

/** Flipkart CDN templates come as {@width}/{@height}/{@quality} placeholders. */
function cdn(url: string): string {
  return String(url)
    .replace('{@width}', '500')
    .replace('{@height}', '500')
    .replace('{@quality}', '70')
    .replace(/^http:\/\//, 'https://');
}

function nextData(html: string): any | null {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function productNodes(root: any): any[] {
  const slots = root?.props?.pageProps?.initialState?.pageData?.RESPONSE?.slots;
  if (!Array.isArray(slots)) return [];
  const out: any[] = [];
  for (const slot of slots) {
    if (slot?.widget?.type !== 'PRODUCT_SUMMARY') continue;
    const list = slot?.widget?.data?.products;
    if (Array.isArray(list)) out.push(...list);
  }
  return out;
}

function price(v: any): number | undefined {
  const n = Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

export function parseShopsy(html: string, source: SourceConfig, pageUrl: string): RawSourceItem[] {
  const root = nextData(html);
  if (!root) return [];

  const items: RawSourceItem[] = [];
  const seen = new Set<string>();

  for (const node of productNodes(root).slice(0, 40)) {
    const v = node?.productInfo?.value;
    if (!v) continue;

    const title = String(v?.titles?.title || v?.titles?.subtitle || '').replace(/\s+/g, ' ').trim();
    const sellPrice = price(v?.pricing?.finalPrice?.value ?? v?.pricing?.finalPrice?.decimalValue);
    if (!title || !sellPrice) continue;

    const mrpRaw = price(v?.pricing?.mrp?.value ?? v?.pricing?.mrp?.decimalValue);
    const listPrice = mrpRaw && mrpRaw > sellPrice ? mrpRaw : undefined;

    const rel = String(v?.baseUrl || '').trim();
    const url = rel
      ? rel.startsWith('http')
        ? rel.replace(/^http:/, 'https:')
        : `https://www.shopsy.in${rel.startsWith('/') ? '' : '/'}${rel}`
      : pageUrl;

    const id = String(v?.id || v?.itemId || '');
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);

    const images = (v?.media?.images || [])
      .map((i: any) => cdn(String(i?.url || '')))
      .filter(Boolean);
    const uniqueImages = Array.from(new Set(images)).slice(0, 8);

    const rating = Number(v?.rating?.average);
    const ratingCount = Number(v?.rating?.count);
    const stock = String(v?.availability?.displayState || '').toUpperCase();

    items.push(
      newRawItem(source, {
        title: title.slice(0, 200),
        price: sellPrice,
        listPrice,
        currency: 'INR',
        seller: 'Shopsy',
        sellerUrl: url,
        identifiers: id ? { vendorProductId: id } : undefined,
        availability: stock.includes('IN_STOCK') ? 'in_stock' : stock.includes('OUT_OF_STOCK') ? 'out_of_stock' : 'unknown',
        attributes: {
          image: uniqueImages[0] || '',
          ...(uniqueImages.length > 1 ? { image_urls: uniqueImages.join('|') } : {}),
          ...(Number.isFinite(rating) && rating > 0 ? { rating: rating.toFixed(1) } : {}),
          ...(Number.isFinite(ratingCount) && ratingCount > 0 ? { rating_count: String(ratingCount) } : {}),
          ...(listPrice ? { discount: `${Math.round((1 - sellPrice / listPrice) * 100)}%` } : {}),
          data_note: `Product as listed on Shopsy search, observed ${new Date().toISOString().slice(0, 10)}`,
        },
        evidence: {
          sourceUrl: pageUrl,
          extractedFields: ['title', 'price', 'mrp', 'rating', 'image', 'url'],
        },
      })
    );
  }

  return items;
}
