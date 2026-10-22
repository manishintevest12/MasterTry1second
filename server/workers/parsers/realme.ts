/**
 * Realme India (realme.com / buy.realme.com) search parser.
 *
 * The realme.com/in search page is a NUXT SPA that renders results client-side
 * from an unauthenticated JSON POST (cracked 22 Oct from the search bundle
 * DPzNpKbK.js: ajax POST <g>/product/info/search where g = https://api.realme.com/in/):
 *
 *   POST https://api.realme.com/in/product/info/search
 *   {"keyWords":<q>,"pageNum":1,"pageSize":20,"labelType":1,"sortType":1,"categoryParams":[]}
 *
 * Response: data.records[] with spuName, skuId (goods id -> PDP
 * https://buy.realme.com/in/goods/<skuId>), currentPrice (live INR),
 * mrpPrice/originalPrice (MRP), stockStatus (bool), saleStatus,
 * productCategoryCode (mobile/accessories/...), overviewUrl (hero image on
 * image01.realme.net), reviewsScoreAvg/reviewsTotalNum, tag.
 *
 * HONEST LIMIT (22 Oct): the goods-detail API (api.realme.com/in/goods/detail
 * etc.) returns 401 err.common.user.unauthorized without the buy-SPA session
 * token, so no multi-shot gallery is available browserless — the parser emits
 * the search hero image only (owner multi-image rule is best-effort; no
 * fabrication). The search payload alone still carries full live prices/MRP.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

interface RealmeRecord {
  spuName?: string;
  skuId?: number | string;
  spuId?: number | string;
  currentPrice?: number | string;
  mrpPrice?: number | string;
  originalPrice?: number | string;
  useCouponPrice?: number | string;
  stockStatus?: boolean;
  saleStatus?: boolean;
  isPricePendingDisplay?: boolean;
  productCategoryCode?: string;
  overviewUrl?: string;
  reviewsScoreAvg?: number;
  reviewsTotalNum?: number;
  tag?: string;
  tagType?: number;
  color?: string;
}

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function parseRealmeSearch(rawBody: string, source: SourceConfig, pageUrl: string): RawSourceItem[] {
  let root: any;
  try { root = JSON.parse(rawBody); } catch { return []; }
  if (root?.code !== 200) return [];
  const recs: RealmeRecord[] = Array.isArray(root?.data?.records) ? root.data.records : [];
  const items: RawSourceItem[] = [];
  const seen = new Set<string>();
  for (const r of recs) {
    const name = String(r?.spuName || '').trim();
    const sku = String(r?.skuId || r?.spuId || '');
    if (!name || !sku || seen.has(sku)) continue;
    if (r?.isPricePendingDisplay) continue; // "price coming" rows have no real price
    const price = num(r?.currentPrice) ?? num(r?.useCouponPrice);
    if (!price) continue;
    seen.add(sku);
    const mrp = num(r?.mrpPrice) ?? num(r?.originalPrice);
    const hero = /^https?:\/\//.test(String(r?.overviewUrl || '')) ? String(r.overviewUrl) : '';
    const inStock = r?.stockStatus === true && r?.saleStatus !== false;
    const rating = num(r?.reviewsScoreAvg);
    const reviews = num(r?.reviewsTotalNum);
    const url = `https://buy.realme.com/in/goods/${sku}`;
    const brand = /narzo/i.test(name) ? 'Realme (Narzo)'
      : /^realme/i.test(name) ? 'Realme'
      : 'Realme';
    const category = String(r?.productCategoryCode || '');
    items.push(newRawItem(source, {
      title: name.slice(0, 200),
      brand,
      model: String(r?.spuId || sku),
      price,
      listPrice: mrp && mrp > price ? mrp : undefined,
      currency: 'INR',
      seller: 'Realme (realme.com)',
      sellerUrl: url,
      availability: inStock ? 'in_stock' : 'out_of_stock',
      attributes: {
        brand,
        image: hero,
        image_urls: '',
        category,
        in_stock: inStock ? 'true' : 'false',
        ...(reviews ? { review_count: String(Math.round(reviews)) } : {}),
        ...(rating ? { rating: String(Math.round(rating * 10) / 10) } : {}),
        ...(r?.tag ? { badge: String(r.tag).slice(0, 40) } : {}),
        data_note: `Live prices from Realme India search API (api.realme.com), observed ${new Date().toISOString().slice(0, 10)}. Gallery unavailable browserless: goods-detail API needs session auth — hero image only.`,
      },
      identifiers: { sku },
      evidence: { sourceUrl: pageUrl, extractedFields: ['title', 'price', 'mrp', 'brand', 'image', 'url', 'stock', 'rating'] },
    }));
    if (items.length >= 30) break;
  }
  return items;
}
