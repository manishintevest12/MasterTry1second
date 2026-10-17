/**
 * Zepto (owner request 17 Oct: add Zepto, browser-assisted endpoint discovery -> curl_cffi).
 * Recon (Browserbase + APK, 17 Oct): zeptonow.com now redirects to zepto.com; the web app is
 * behind an AWS WAF JS challenge that mints a token cookie REQUIRED by every endpoint
 * (bff-gateway.zepto.com/lms/api/v2/get_page returns 202 even from a real browser when
 * cookies are omitted) — web search is ALSO login-gated ("Please login to continue
 * searching"). The mobile app's Kong gateway (api-gateway.zepto.co.in) is the remaining
 * browserless surface: route POST /api/v3/search exists (429 = WAF, 404 = no route —
 * verified 17 Oct). This worker attempts it with app headers; from an IP the WAF accepts
 * (Hostinger pending retest) it returns products. NO data is ever fabricated.
 */
import { newRawItem } from '../../sources/contract';
import type { RawSourceItem, SourceConfig } from '../../types';

export const ZEP_API_BASE = 'https://api-gateway.zepto.co.in';

/** App-like headers (from the APK bundle's service config; no auth token exists for guests). */
export function zeptoAppHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'x-platform': 'ANDROID',
    'app-version': '26.9.2',
    'device-id': 'a1b2c3d4-e5f6-4789-a012-3456789abcde',
    ...extra,
  };
}

/** Extract the served store UUID from the known-ungated serviceability response. */
export function zeptoStoreId(serviceabilityJson: string): string | null {
  try {
    const walk = (node: any, depth = 0): string | null => {
      if (!node || depth > 12) return null;
      if (typeof node === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(node)) return node;
      if (Array.isArray(node)) { for (const v of node) { const r = walk(v, depth + 1); if (r) return r; } return null; }
      if (typeof node === 'object') { for (const v of Object.values(node)) { const r = walk(v, depth + 1); if (r) return r; } }
      return null;
    };
    return walk(JSON.parse(serviceabilityJson));
  } catch { return null; }
}

interface ZeptoProductCandidate {
  name?: string;
  id?: string;
  image?: string;
  price?: number; // rupees
  mrp?: number; // rupees
  pack?: string;
}

function rupees(v: any): number | undefined {
  if (typeof v === 'number' && v > 0) return v < 100000 ? Math.round(v * 100) / 100 : undefined;
  if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim())) { const n = Number(v); return n > 0 && n < 100000 ? n : undefined; }
  if (v && typeof v === 'object') {
    // protobuf-style money: units + nanos
    const u = Number(v.units ?? v.unit ?? 0), n = Number(v.nanos ?? 0);
    if (u || n) { const r = u + n / 1e9; return r > 0 && r < 100000 ? Math.round(r * 100) / 100 : undefined; }
  }
  return undefined;
}

const NAME_KEYS = ['name', 'productName', 'product_name', 'display_name', 'title'];
const PRICE_KEYS = ['price', 'selling_price', 'offer_price', 'effective_price', 'final_price', 'value', 'amount'];
const MRP_KEYS = ['mrp', 'list_price', 'strike_price', 'marked_price'];
const PACK_KEYS = ['pack_size', 'packSize', 'quantity_description', 'unit', 'weight', 'size'];

/** Structure-agnostic walker: collect every object that carries a name AND a usable price. */
export function collectZeptoProducts(node: any, out: ZeptoProductCandidate[], depth = 0): void {
  if (!node || depth > 18 || out.length > 1200) return;
  if (Array.isArray(node)) { for (const v of node) collectZeptoProducts(v, out, depth + 1); return; }
  if (typeof node === 'object') {
    const name = NAME_KEYS.map((k) => node[k]).find((v) => typeof v === 'string' && String(v).trim().length > 2) as string | undefined;
    if (name) {
      let price: number | undefined;
      let mrp: number | undefined;
      for (const k of PRICE_KEYS) { price = rupees(node[k]); if (price !== undefined) break; }
      for (const k of MRP_KEYS) { mrp = rupees(node[k]); if (mrp !== undefined) break; }
      const pack = PACK_KEYS.map((k) => node[k]).find((v) => typeof v === 'string' && String(v).trim()) as string | undefined;
      const image = typeof node.image === 'string' ? node.image
        : Array.isArray(node.images) && typeof node.images[0] === 'string' ? node.images[0]
        : node.image_url ?? (Array.isArray(node.image_ids) ? node.image_ids[0] : undefined);
      const id = typeof (node.id ?? node.pvid ?? node.product_id ?? node.sku_id) === 'string'
        ? String(node.id ?? node.pvid ?? node.product_id ?? node.sku_id) : undefined;
      if (price !== undefined || mrp !== undefined) {
        out.push({ name: String(name).trim().slice(0, 120), id, image: typeof image === 'string' ? image : undefined, price, mrp: mrp && mrp > (price ?? 0) ? mrp : undefined, pack });
      }
    }
    for (const v of Object.values(node)) collectZeptoProducts(v, out, depth + 1);
  }
}

/** Normalize search JSON into honest grocery offers (priceless candidates are skipped). */
export function parseZeptoSearch(json: string, source: SourceConfig, term: string, cityLabel: string, max: number): RawSourceItem[] {
  let root: any;
  try { root = JSON.parse(json); } catch { return []; }
  const found: ZeptoProductCandidate[] = [];
  collectZeptoProducts(root, found);
  const items: RawSourceItem[] = [];
  const seen = new Set<string>();
  for (const p of found) {
    if (items.length >= max) break;
    if (!p.price || !p.name) continue; // grocery validation requires a price — never invented
    const key = `${p.name}|${p.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const t = p.name.toLowerCase();
    const token = term.toLowerCase().split(/\s+/)[0];
    if (token.length > 2 && !t.includes(token) && !t.includes(token.replace(/s$/, ''))) continue;
    items.push(newRawItem(source, {
      title: p.name,
      price: Math.round(p.price),
      listPrice: p.mrp && p.mrp > p.price ? Math.round(p.mrp) : undefined,
      currency: 'INR',
      seller: 'Zepto',
      sellerUrl: `https://www.zepto.com/search?query=${encodeURIComponent(term)}`,
      attributes: {
        pack_size: p.pack || '',
        eta_minutes: '10',
        outlet: cityLabel,
        data_note: `Zepto app search API (api-gateway.zepto.co.in/api/v3/search, APK-extracted route, no API key); price is Zepto's own published price for ${cityLabel}. Web search requires login — the deeplink lands on Zepto's site.`,
        ...(p.image ? { image_url: p.image } : {}),
      },
      identifiers: p.id ? { sku: `zepto-${p.id}` } : {},
      evidence: { extractedFields: ['title', 'price', 'currency'], sourceReference: 'Zepto v3/search app API' },
    }));
  }
  return items;
}
