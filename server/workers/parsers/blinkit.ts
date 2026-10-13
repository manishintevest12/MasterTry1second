/**
 * Blinkit (grofers) search parser.
 *
 * Endpoint (reverse-engineered, answers real JSON to browserless HTTP, no auth):
 *   POST https://blinkit.com/v1/layout/search?q=<query>&search_type=type_to_search
 *   headers: app_client: consumer_web, lat, lon (location-aware price + stock), Origin/Referer blinkit.com
 *   body: {}
 * Response: { is_success, response: { snippets: [ { widget_type: 'product_card_snippet_type_2',
 *   data: { name.text, variant.text (pack), normal_price.text ("₹85"), brand_name.text, inventory,
 *           is_sold_out, product_state, image.url, product_id, merchant_id,
 *           atc_action.add_to_cart.cart_item { price, mrp, unit, inventory, image_url } } } ] } }
 * Prices are in rupees. cart_item.price / mrp are numeric and preferred over the display text.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

interface BlinkitCartItem { price?: number; mrp?: number; unit?: string; inventory?: number; image_url?: string; product_name?: string }

function textOf(x: any): string {
  return x && typeof x === 'object' ? String(x.text ?? '') : typeof x === 'string' ? x : '';
}

function rupees(s: string): number | null {
  const m = String(s || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

export function parseBlinkit(rawBody: string, source: SourceConfig, pageUrl: string, cityLabel: string, cap = 16): RawSourceItem[] {
  let root: any;
  try { root = JSON.parse(rawBody); } catch { return []; }
  const snippets: any[] = root?.response?.snippets;
  if (!Array.isArray(snippets)) return [];
  const now = new Date().toISOString();
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  for (const sn of snippets) {
    const d = sn?.data;
    if (!d || !/product_card/.test(String(sn.widget_type || ''))) continue;
    const name = textOf(d.display_name) || textOf(d.name);
    if (!name) continue;
    const cart: BlinkitCartItem | undefined = d.atc_action?.add_to_cart?.cart_item;
    const price = Number(cart?.price) > 0 ? Number(cart!.price) : rupees(textOf(d.normal_price));
    if (!price || price <= 0) continue;
    const mrpNum = Number(cart?.mrp);
    const mrp = mrpNum > price ? mrpNum : undefined;
    const pack = textOf(d.variant) || String(cart?.unit || '');
    const pid = String(d.product_id || d.identity?.id || '');
    const key = pid || `${name}|${pack}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const imageRaw = String(d.image?.url || cart?.image_url || '');
    const imageUrl = imageRaw ? imageRaw.replace(/^http:/, 'https:') : '';
    const brand = textOf(d.brand_name) || undefined;
    const inventory = Number(d.inventory ?? cart?.inventory);
    const soldOut = d.is_sold_out === true || String(d.product_state || '') === 'unavailable' || inventory === 0;
    out.push(newRawItem(source, {
      title: `${name}${pack ? ` (${pack})` : ''}`.slice(0, 200),
      brand,
      price,
      listPrice: mrp,
      currency: 'INR',
      seller: 'Blinkit',
      sellerUrl: `https://blinkit.com/s/?q=${encodeURIComponent(name)}`,
      availability: soldOut ? 'out_of_stock' : 'in_stock',
      location: { city: cityLabel },
      attributes: {
        platform: 'Blinkit',
        ...(pack ? { quantity: pack.slice(0, 60) } : {}),
        ...(imageUrl ? { image_url: imageUrl } : {}),
        price_basis: `Blinkit price for ${cityLabel} (10-min delivery zone)`,
        data_note: 'Price extracted from Blinkit search API (blinkit.com); final price at checkout may vary',
      },
      identifiers: pid ? { sku: pid, vendorProductId: String(d.merchant_id || '') || undefined } : undefined,
      evidence: { sourceUrl: pageUrl, sourceReference: pid, extractedFields: ['name', 'variant', 'cart_item.price', 'cart_item.mrp', 'inventory', 'image'] },
    }));
    if (out.length >= cap) break;
  }
  void now;
  return out;
}
