/**
 * Lenovo India (lenovo.com/in/en) search parser.
 *
 * The lenovo.com SRP is fully client-rendered (no SSR product data), but the
 * search micro-app calls an unauthenticated JSON GET (captured 22 Oct 2026 via
 * Playwright request tracing — browser-assisted discovery only, per the
 * acquisition policy; production replays it with curl_cffi):
 *
 *   GET https://openapi.lenovo.com/in/en/ofp/search/global/cache/products/get/_tsc
 *       ?text=<q>&rows=24&sort=Recommended&contentNum=0&productNum=24
 *
 * CRITICAL HEADER: Referer must be a lenovo.com/in/en/search URL — without it
 * the edge returns 403 HTML (Akamai-style edge check). Origin/Accept optional.
 * The `page` param is ignored server-side (page 1 always) — one call per query.
 *
 * Response shape: data.data[] blocks -> products[] with
 *   summary           clean display name ("ThinkPad E14 Gen 7") — preferred title
 *   productName       raw internal name ("Legion Pro 5 16ADR10_83LT - ...")
 *   url               PDP path (/p/laptops/.../<code>) -> https://www.lenovo.com +
 *   finalPrice        live INR price (after instant savings)
 *   webPrice          the site's own inflated "List Price Website"
 *   noCouponPrice     pre-coupon price (fallback listPrice)
 *   inventoryStatus   1 = in stock
 *   ratingStar/commentCount
 *   currencyCode      "INR"
 *   media.gallery[]   imageAddress (//ap-img.static.pub/... -> https:)
 *                     imageAlt is a GENERIC photo caption ("Front left side
 *                     view of ...") — never used as the title, only rejected.
 *   classification[]  { a: "Processor", b: "Intel Core Ultra 7 ..." } specs
 *   productCode / id  stable config identity (id is unique per config row)
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const LENOVO_SEARCH_API = 'https://openapi.lenovo.com/in/en/ofp/search/global/cache/products/get/_tsc';

export function lenovoSearchUrl(term: string, rows = 24): string {
  return `${LENOVO_SEARCH_API}?text=${encodeURIComponent(term)}&rows=${rows}&sort=Recommended&contentNum=0&productNum=${rows}`;
}

export function lenovoHeaders(term: string): Record<string, string> {
  return {
    Accept: 'application/json, text/plain, */*',
    // CRITICAL: the edge 403s (HTML) without a lenovo.com search Referer.
    Referer: `https://www.lenovo.com/in/en/search?text=${encodeURIComponent(term)}`,
  };
}

interface LenovoGalleryImg {
  imageAddress?: string;
  imageName?: string;
  imageAlt?: string;
}

interface LenovoProduct {
  id?: string;
  productName?: string;
  summary?: string;
  productCode?: string;
  url?: string;
  webPrice?: string;
  finalPrice?: string;
  noCouponPrice?: string;
  taxPrice?: string;
  beforeTaxPrice?: string;
  instantSavingSaveAmount?: string;
  saveAmount?: string;
  savePercent?: string;
  currencyCode?: string;
  inventoryStatus?: number;
  ratingStar?: number | string;
  commentCount?: number;
  marketingStatus?: string;
  media?: { gallery?: LenovoGalleryImg[] };
  classification?: Array<{ a?: string; b?: string }>;
  categoryPath?: string[];
  machineType?: string;
}

const money = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Display title: summary > URL slug > guarded imageAlt > productName. */
function lenovoTitle(p: LenovoProduct): string {
  const summary = String(p.summary || '').trim();
  if (summary && summary.length >= 3) return summary.slice(0, 200);
  // URL slug before the trailing product code: "/p/.../legion-pro-5-gen-10-16-inch-amd/83lt..."
  const slug = String(p.url || '').split('?')[0].split('/').filter(Boolean).slice(-2, -1)[0] || '';
  if (slug.includes('-')) {
    return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 200);
  }
  const alt = String(p?.media?.gallery?.[0]?.imageAlt || '').trim();
  if (alt && !/^(front|side|back|top|bottom|left|right|angle)/i.test(alt)) {
    return alt.replace(/^Lenovo\s+/i, '').slice(0, 200);
  }
  const raw = String(p.productName || '').trim();
  if (raw) {
    // "Legion Pro 5 16ADR10_83LT - Legion Pro 5 16ADR10_01_IN" -> before first "_"
    return raw.split(' - ')[0].split('_')[0].trim().slice(0, 200);
  }
  return '';
}

export function parseLenovoSearch(rawBody: string, source: SourceConfig, pageUrl: string): RawSourceItem[] {
  let root: any;
  try { root = JSON.parse(rawBody); } catch { return []; }
  const blocks = Array.isArray(root?.data?.data) ? root.data.data : [];
  const products: LenovoProduct[] = [];
  for (const block of blocks) {
    if (Array.isArray(block?.products)) products.push(...block.products);
  }
  const items: RawSourceItem[] = [];
  const seen = new Set<string>();
  for (const p of products) {
    const price = money(p.finalPrice) ?? money(p.beforeTaxPrice);
    if (!price) continue;
    const id = String(p.id || p.productCode || '');
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    const title = lenovoTitle(p);
    if (!title) continue;
    const listPrice = money(p.webPrice) ?? money(p.noCouponPrice);
    const inStock = Number(p.inventoryStatus ?? 1) === 1;
    // gallery: https-upgrade, dedupe, cap 6 (owner multi-image rule)
    const gallery: string[] = [];
    for (const g of p?.media?.gallery || []) {
      let u = String(g?.imageAddress || '');
      if (!u) continue;
      if (u.startsWith('//')) u = 'https:' + u;
      if (!/^https?:\/\//.test(u) || gallery.includes(u)) continue;
      gallery.push(u);
      if (gallery.length >= 6) break;
    }
    const url = String(p.url || '').startsWith('http')
      ? String(p.url)
      : 'https://www.lenovo.com' + String(p.url || '');
    const specs: Record<string, string> = {};
    for (const c of p.classification || []) {
      const key = String(c?.a || '').trim();
      const val = String(c?.b || '').trim();
      if (key && val && Object.keys(specs).length < 8) specs[key] = val.slice(0, 120);
    }
    const rating = money(p.ratingStar);
    items.push(newRawItem(source, {
      title,
      brand: 'Lenovo',
      price,
      listPrice: listPrice && listPrice > price ? listPrice : undefined,
      currency: String(p.currencyCode || 'INR'),
      seller: 'Lenovo (lenovo.com)',
      sellerUrl: url,
      availability: inStock ? 'in_stock' : 'out_of_stock',
      attributes: {
        brand: 'Lenovo',
        ...(rating && rating > 0 && rating <= 5
          ? { rating: String(Math.round(rating * 10) / 10), ...(Number(p.commentCount) > 0 ? { reviews: String(p.commentCount) } : {}) }
          : {}),
        image: gallery[0] || '',
        image_urls: gallery.length > 1 ? gallery.join('|') : '',
        category: (p.categoryPath || []).slice(1, 4).join(' > '),
        in_stock: inStock ? 'true' : 'false',
        ...(Object.keys(specs).length ? { specs: JSON.stringify(specs) } : {}),
        data_note: `Live prices from Lenovo India openapi search (finalPrice incl. instant savings), observed ${new Date().toISOString().slice(0, 10)}`,
      },
      identifiers: p.productCode ? { sku: String(p.productCode) } : undefined,
      evidence: { sourceUrl: pageUrl, extractedFields: ['title', 'price', 'listPrice', 'rating', 'image', 'url', 'stock', 'specs'] },
    }));
    if (items.length >= 30) break;
  }
  return items;
}
