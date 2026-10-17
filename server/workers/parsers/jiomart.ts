/**
 * JioMart parser. JioMart runs on the Fynd/JCP platform; its catalog API
 * GET /api/service/application/catalog/v1.0/products/?q=<term>&page_no&page_size&pincode
 * is guest-accessible browserless once two headers discovered in the web theme
 * bundle (themeBundle.umd.js) are sent:
 *   Authorization: Bearer base64("<applicationID>:<applicationToken>")
 *   x-location-detail: {"pincode":"400070","city":"Mumbai","country_code":"91"}
 * (the pincode and city MUST be a valid matching pair, else 400 "invalid pincode").
 * Response: { filters, items[], page{item_total,...}, sort_on, meta } where each
 * item carries name, slug, uid, item_code, brand{name}, price{effective{min},marked{min},
 * currency_code:"INR"}, medias[{url,type}], sellable. Product pages live at
 * https://www.jiomart.com/p/<slug>. Verified live 17 Oct 2026 (nike shoes,
 * aashirvaad atta, Indore + Bengaluru pincodes).
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

interface JioItem {
  name?: string;
  slug?: string;
  uid?: number | string;
  item_code?: string;
  sku_code?: string;
  brand?: { name?: string };
  price?: {
    effective?: { min?: number; max?: number };
    marked?: { min?: number; max?: number };
    currency_code?: string;
  };
  medias?: Array<{ url?: string; type?: string; alt?: string }>;
  sellable?: boolean;
}

export function parseJiomart(body: string, source: SourceConfig, pageUrl: string): RawSourceItem[] {
  let root: any;
  try {
    root = JSON.parse(body);
  } catch {
    return [];
  }

  let items: JioItem[] = Array.isArray(root?.items) ? root.items : [];
  if (!items.length) {
    // Shape-based fallback in case the envelope changes: longest array of
    // objects carrying name + price.effective.
    const walk = (o: any, depth: number): JioItem[] => {
      if (depth > 8 || !o || typeof o !== 'object') return [];
      if (Array.isArray(o)) {
        if (o.length && typeof o[0] === 'object' && o[0] && ('name' in o[0]) && (o[0]?.price?.effective || o[0]?.price?.marked)) {
          return o as JioItem[];
        }
        for (const v of o) { const r = walk(v, depth + 1); if (r.length) return r; }
        return [];
      }
      for (const v of Object.values(o)) { const r = walk(v, depth + 1); if (r.length) return r; }
      return [];
    };
    items = walk(root, 0);
  }
  if (!items.length) return [];

  const out: RawSourceItem[] = [];
  for (const it of items.slice(0, 40)) {
    const name = String(it.name || '').trim();
    if (!name) continue;
    const eff = Number(it.price?.effective?.min ?? it.price?.effective?.max);
    const marked = Number(it.price?.marked?.min ?? it.price?.marked?.max);
    const price = Number.isFinite(eff) && eff > 0 ? eff : marked;
    if (!Number.isFinite(price) || price <= 0) continue;

    const brand = String(it.brand?.name || '').trim();
    const slug = String(it.slug || '').trim();
    const pdp = slug ? `https://www.jiomart.com/p/${slug}` : 'https://www.jiomart.com';

    const imgs = [...new Set(
      (it.medias || [])
        .filter((m) => m?.type === 'image' && typeof m.url === 'string')
        .map((m) => String(m.url!).replace(/^http:/, 'https:'))
        .filter((u) => /^https:\/\//.test(u)),
    )].slice(0, 6);
    const hero = imgs[0] || '';

    const discount = Number.isFinite(marked) && marked > price
      ? Math.round(((marked - price) / marked) * 100)
      : 0;

    const sku = String(it.sku_code || it.item_code || '').trim();

    out.push(newRawItem(source, {
      title: name.slice(0, 200),
      brand: brand || undefined,
      model: sku || (it.uid != null ? String(it.uid) : undefined),
      price,
      listPrice: Number.isFinite(marked) && marked > price ? marked : undefined,
      currency: it.price?.currency_code || 'INR',
      seller: 'JioMart',
      sellerUrl: pdp,
      availability: it.sellable === false ? 'out_of_stock' : 'in_stock',
      attributes: {
        brand,
        product: name,
        ...(discount ? { discount: String(discount) } : {}),
        image: hero,
        ...(imgs.length > 1 ? { image_urls: imgs.join('|') } : {}),
        data_note: `Product as listed on JioMart catalog search, observed ${new Date().toISOString().slice(0, 10)}`,
      },
      identifiers: sku ? { sku, ...(it.uid != null ? { vendorProductId: String(it.uid) } : {}) } : undefined,
      evidence: {
        sourceUrl: pageUrl,
        extractedFields: ['name', 'slug', 'uid', 'item_code', 'brand.name', 'price.effective.min', 'price.marked.min', 'medias[].url', 'sellable'],
      },
    }));
  }
  return out;
}
