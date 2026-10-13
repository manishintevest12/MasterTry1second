/**
 * BigBasket search parser.
 *
 * Flow (reverse-engineered, works browserless with curl_cffi chrome impersonation):
 *   1. GET  https://www.bigbasket.com/                      -> session cookies (_bb_*, Akamai bm_*)
 *   2. GET  /ui-svc/v1/serviceable/?lat&lng&send_all_serviceability=true -> places_info {lat,lng,area,pincode}
 *      (must reuse the step-1 cookie jar)
 *   3. set  cookies _bb_addressinfo = "<lat>_<lng>_<area>_<pin>_1_false_true_true_Express",
 *           _bb_pin_code = <pin>, _bb_lat_long = base64("<lat>|<lng>")
 *   4. GET  /listing-svc/v2/products?type=ps&slug=<query>&page=1 (same jar + x-latitude/x-longitude headers)
 *      -> real products with price, mrp, pack, brand, images, EAN.
 *
 * Response: tabs[].product_info[].products[]:
 *   id, desc, w ("1 L"), unit, brand.name, category.tlc_name,
 *   pricing.discount { mrp, prim_price { sp, rsp } },
 *   availability { avail_status ("001" = in stock), not_for_sale },
 *   images[] { s, m, l, xl, xxl }, ean_code, absolute_url
 * All prices are rupees as strings.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export interface BbProduct {
  id?: string | number; desc?: string; w?: string; absolute_url?: string;
  brand?: { name?: string }; category?: { tlc_name?: string };
  pricing?: { discount?: { mrp?: string; prim_price?: { sp?: string; rsp?: string } } };
  availability?: { avail_status?: string; not_for_sale?: boolean };
  images?: Array<{ s?: string; m?: string; l?: string }>;
  ean_code?: string;
}

const num = (v: unknown): number | null => {
  const n = Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function parseBigbasket(rawBody: string, source: SourceConfig, pageUrl: string, cityLabel: string, cap = 16): RawSourceItem[] {
  let root: any;
  try { root = JSON.parse(rawBody); } catch { return []; }
  const tabs: any[] = root?.tabs;
  if (!Array.isArray(tabs)) return [];
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  for (const tab of tabs) {
    const products: BbProduct[] = tab?.product_info?.products;
    if (!Array.isArray(products)) continue;
    for (const p of products) {
      const name = String(p.desc || '').trim();
      if (!name) continue;
      const sp = num(p.pricing?.discount?.prim_price?.sp);
      if (!sp) continue;
      const mrp = num(p.pricing?.discount?.mrp);
      const pack = String(p.w || '').trim();
      const id = String(p.id || '');
      const key = id || `${name}|${pack}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const avail = p.availability?.avail_status === '001' && p.availability?.not_for_sale !== true;
      const img = String(p.images?.[0]?.l || p.images?.[0]?.m || p.images?.[0]?.s || '');
      const brand = String(p.brand?.name || '').trim() || undefined;
      const url = p.absolute_url ? `https://www.bigbasket.com${p.absolute_url}` : `https://www.bigbasket.com/ps/?q=${encodeURIComponent(name)}`;
      out.push(newRawItem(source, {
        title: `${name}${pack ? ` (${pack})` : ''}`.slice(0, 200),
        brand,
        price: sp,
        listPrice: mrp && mrp > sp ? mrp : undefined,
        currency: 'INR',
        seller: 'BigBasket',
        sellerUrl: url,
        availability: avail ? 'in_stock' : 'out_of_stock',
        location: { city: cityLabel },
        attributes: {
          platform: 'BigBasket',
          ...(pack ? { quantity: pack.slice(0, 60) } : {}),
          ...(img ? { image_url: img } : {}),
          ...(p.category?.tlc_name ? { category: String(p.category.tlc_name).slice(0, 80) } : {}),
          price_basis: `BigBasket price for ${cityLabel} (slotted delivery zone)`,
          data_note: 'Price extracted from BigBasket listing API (bigbasket.com); final price at checkout may vary',
        },
        identifiers: id ? { sku: id, ...(p.ean_code ? { gtin: String(p.ean_code) } : {}) } : undefined,
        evidence: { sourceUrl: pageUrl, sourceReference: id, extractedFields: ['desc', 'w', 'pricing.discount.prim_price.sp', 'pricing.discount.mrp', 'availability.avail_status', 'images[0].l'] },
      }));
      if (out.length >= cap) return out;
    }
  }
  return out;
}
