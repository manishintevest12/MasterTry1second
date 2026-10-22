/**
 * Xiaomi India (mi.com — covers Redmi/Poco/Xiaomi brands) search parser.
 *
 * The mi.com storefront is a client-rendered SPA, but the search service is a
 * plain GET replayable with Chrome TLS impersonation (cracked 22 Oct 2026 from
 * the SPPS bundle, chunk 33572 + Search.chunk):
 *
 *   GET https://in-go.buy.mi.com/in/v2/search/result
 *       ?word=<q>&type=2&page_index=0&page_size=24
 *       &v2_page_index=0&v2_page_size=24&from=pc
 *
 * (goSite host from __LOCAL_CONFIG__/wwwSite config: //in-go.buy.mi.com/in;
 *  word is the URL-encoded term, type=2 = product list, from=pc marks the web
 *  client; page_index/page_size are the v1 paging params the site still sends.)
 *
 * Response: data.data_provider.data.product_list[] — each entry carries
 *  product{ id, name, price_min_num (live sales INR), market_price_min_num,
 *           image (hero), item_link (PDP), spu_id, is_sale, has_store,
 *           categories[{title, category_tag}] }
 *  commodity[] — one row per purchasable variant (colour/storage), each with
 *           its own image + sales_price/market_price. Variant shots differ per
 *           colour, so the union of distinct commodity images is merged into
 *          attributes.image_urls for the owner multi-image rule (no PDP fetch
 *          needed — the search payload alone provides the gallery).
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

interface XiaomiCommodity {
  id?: string | number;
  name?: string;
  image?: string;
  item_link?: string;
  is_sale?: number;
  has_store?: number;
  sales_price?: string | number;
  market_price?: string | number;
}

interface XiaomiProduct {
  id?: string | number;
  name?: string;
  price_min_num?: number | string;
  price_max_num?: number | string;
  market_price_min_num?: number | string;
  market_price_max_num?: number | string;
  image?: string;
  item_link?: string;
  spu_id?: string;
  is_sale?: number;
  has_store?: number;
  is_new?: number;
  categories?: Array<{ title?: string; category_tag?: string }>;
}

interface XiaomiEntry {
  product?: XiaomiProduct;
  commodity?: XiaomiCommodity[];
}

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function parseXiaomiSearch(rawBody: string, source: SourceConfig, pageUrl: string): RawSourceItem[] {
  let root: any;
  try { root = JSON.parse(rawBody); } catch { return []; }
  const list: XiaomiEntry[] = Array.isArray(root?.data?.data_provider?.data?.product_list)
    ? root.data.data_provider.data.product_list
    : [];
  const items: RawSourceItem[] = [];
  const seen = new Set<string>();
  for (const entry of list) {
    const p = entry?.product;
    const name = String(p?.name || '').trim();
    if (!name || !p) continue;
    const id = String(p.id || p.spu_id || '');
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    const price = num(p.price_min_num) ?? num(p.price_max_num) ?? num((entry.commodity || [])[0]?.sales_price);
    if (!price) continue;
    items.push(makeItem(source, pageUrl, p, entry, price));
    if (items.length >= 30) break;
  }
  return items;
}

function makeItem(
  source: SourceConfig,
  pageUrl: string,
  p: XiaomiProduct,
  entry: XiaomiEntry,
  price: number,
): RawSourceItem {
  const name = String(p.name || '').trim();
  const id = String(p.id || p.spu_id || '');
  const mrp = num(p.market_price_min_num) ?? num(p.market_price_max_num);
  const url = /^https?:\/\//.test(String(p.item_link || '')) ? String(p.item_link) : 'https://www.mi.com/in';
  const hero = /^https?:\/\//.test(String(p.image || '')) ? String(p.image) : '';
  // Multi-image (owner rule): union of distinct variant shots (colour changes
  // give genuinely different photos) — search payload alone, no PDP round trip.
  const gallery: string[] = [];
  if (hero) gallery.push(hero);
  for (const c of entry?.commodity || []) {
    const u = String(c?.image || '');
    if (/^https?:\/\//.test(u) && !gallery.includes(u)) gallery.push(u);
    if (gallery.length >= 6) break;
  }
  const cats = p.categories || [];
  const category = cats.map((c) => String(c?.title || '')).filter(Boolean).join(' > ');
  const brand = /(^|\s)redmi\b/i.test(name) ? 'Redmi'
    : /(^|\s)poco\b/i.test(name) ? 'Poco'
    : /(^|\s)xiaomi\b/i.test(name) ? 'Xiaomi'
    : 'Xiaomi';
  const inStock = Number(p.has_store ?? p.is_sale ?? 1) === 1;
  const isNew = Number(p.is_new ?? 0) === 1;
  return newRawItem(source, {
    title: name.slice(0, 200),
    brand,
    model: p.spu_id ? String(p.spu_id) : undefined,
    price,
    listPrice: mrp && mrp > price ? mrp : undefined,
    currency: 'INR',
    seller: 'Xiaomi (mi.com)',
    sellerUrl: url,
    availability: inStock ? 'in_stock' : 'out_of_stock',
    attributes: {
      brand,
      image: hero,
      image_urls: gallery.length > 1 ? gallery.join('|') : '',
      category: category || '',
      in_stock: inStock ? 'true' : 'false',
      ...(isNew ? { badge: 'New' } : {}),
      data_note: `Live prices from Xiaomi India (mi.com) search API, observed ${new Date().toISOString().slice(0, 10)}`,
    },
    identifiers: id ? { sku: id } : undefined,
    evidence: { sourceUrl: pageUrl, extractedFields: ['title', 'price', 'mrp', 'brand', 'image', 'url', 'stock', 'variant_gallery'] },
  });
}
