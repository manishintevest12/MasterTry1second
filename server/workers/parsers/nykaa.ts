/**
 * Nykaa parser. Nykaa serves its search page as SSR with the full result
 * set embedded in <script id="__PRELOADED_STATE__" type="application/json">.
 * Products live at listingV2.products[]: { id, sku, price (MRP), discountedPrice,
 * discount, imageUrl, title (usually the brand), subTitle (the product name),
 * isOutOfStock, plp_pdp_bridge.images[] }. Product-page hrefs (/slug/p/<id>) are
 * rendered in the same HTML, so we map id -> PDP URL for honest deeplinks.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

interface NykaaProduct {
  id?: string | number;
  sku?: string;
  price?: number;
  discountedPrice?: number;
  discount?: number | string;
  imageUrl?: string;
  title?: string;
  subTitle?: string;
  isOutOfStock?: boolean;
  plp_pdp_bridge?: { images?: Array<{ url?: string }> };
}

export function parseNykaa(html: string, source: SourceConfig, pageUrl: string): RawSourceItem[] {
  const tag = '<script id="__PRELOADED_STATE__" type="application/json">';
  const i = html.indexOf(tag);
  if (i < 0) return [];
  const from = i + tag.length;
  const end = html.indexOf('</script>', from);
  if (end < 0) return [];
  let root: any;
  try {
    root = JSON.parse(html.slice(from, end));
  } catch {
    return [];
  }

  // Robust: locate the longest product array with Nykaa's shape (in case listingV2 moves)
  let products: NykaaProduct[] = [];
  const direct = root?.listingV2?.products;
  if (Array.isArray(direct) && direct.length && 'discountedPrice' in (direct[0] || {})) {
    products = direct as NykaaProduct[];
  } else {
    const walk = (o: any, depth: number): NykaaProduct[] => {
      if (depth > 10 || !o || typeof o !== 'object') return [];
      if (Array.isArray(o)) {
        if (o.length && typeof o[0] === 'object' && o[0] && ('discountedPrice' in o[0] || 'price' in o[0]) && ('title' in o[0] || 'subTitle' in o[0])) {
          return o as NykaaProduct[];
        }
        for (const v of o) { const r = walk(v, depth + 1); if (r.length) return r; }
        return [];
      }
      for (const v of Object.values(o)) { const r = walk(v, depth + 1); if (r.length) return r; }
      return [];
    };
    products = walk(root, 0);
  }
  if (!products.length) return [];

  // id -> PDP path from the rendered anchor hrefs (/some-slug/p/<id>)
  const hrefs = new Map<string, string>();
  const re = /href="(\/[a-z0-9][a-z0-9-]*\/p\/(\d+)[^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && hrefs.size < 200) hrefs.set(m[2], m[1].split('?')[0]);

  const items: RawSourceItem[] = [];
  for (const p of products.slice(0, 40)) {
    const brand = String(p.title || '').trim();
    const name = String(p.subTitle || '').trim();
    const full = [brand, name].filter(Boolean).join(' ');
    if (!full) continue;
    const sell = Number(p.discountedPrice);
    const mrp = Number(p.price);
    const price = Number.isFinite(sell) && sell > 0 ? sell : mrp;
    if (!Number.isFinite(price) || price <= 0) continue;
    const id = p.id != null ? String(p.id) : '';
    const pdp = id && hrefs.get(id) ? `https://www.nykaa.com${hrefs.get(id)}` : 'https://www.nykaa.com';
    const https = (u: string) => u.replace(/^http:/, 'https:');
    const img = p.imageUrl ? https(String(p.imageUrl)) : '';
    const imgs = [...new Set((p.plp_pdp_bridge?.images || []).map((x) => x?.url ? https(String(x.url)) : '').filter((u) => /^https:\/\//.test(u)))].slice(0, 6);
    items.push(newRawItem(source, {
      title: full.slice(0, 200),
      brand: brand || undefined,
      model: p.sku ? String(p.sku) : (id || undefined),
      price,
      listPrice: mrp > price ? mrp : undefined,
      currency: 'INR',
      seller: 'Nykaa',
      sellerUrl: pdp,
      availability: p.isOutOfStock ? 'out_of_stock' : 'in_stock',
      attributes: {
        brand,
        product: name,
        discount: p.discount != null ? String(p.discount).replace(/[()%]/g, '') : '',
        image: img,
        ...(imgs.length > 1 ? { image_urls: imgs.join('|') } : {}),
        data_note: `Product as listed on Nykaa search, observed ${new Date().toISOString().slice(0, 10)}`,
      },
      identifiers: p.sku ? { sku: String(p.sku), ...(id ? { vendorProductId: id } : {}) } : undefined,
      evidence: { sourceUrl: pageUrl, extractedFields: ['title', 'subTitle', 'price', 'discountedPrice', 'discount', 'imageUrl', 'pdp_url', 'sku'] },
    }));
  }
  return items;
}
