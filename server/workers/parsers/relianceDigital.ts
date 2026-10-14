/**
 * Reliance Digital parser (ecommerce). reliancedigital.in is a Fynd/Jio-platform
 * SSR storefront: https://www.reliancedigital.in/products?q=<term> embeds
 * window.__INITIAL_STATE__ with productListingPage.productlists.items[] —
 * real name, brand, effective/marked price (INR), 1200x1200 images, slug,
 * EAN/SKU identifiers and sellable quantity. No API key, no browser.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export const RELIANCE_WEB = 'https://www.reliancedigital.in';

/** Brace-match window.__INITIAL_STATE__ = {...} (string-aware) and JSON.parse it. */
export function extractRelianceState(html: string): any | null {
  const i = html.indexOf('window.__INITIAL_STATE__');
  if (i < 0) return null;
  const eq = html.indexOf('=', i);
  if (eq < 0) return null;
  const s = html.slice(eq + 1).trimStart();
  if (s[0] !== '{') return null;
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let k = 0; k < s.length; k++) {
    const ch = s[k];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = k + 1; break; } }
  }
  if (end < 0) return null;
  try { return JSON.parse(s.slice(0, end)); } catch { return null; }
}

export function parseRelianceDigital(html: string, source: SourceConfig, pageUrl: string): RawSourceItem[] {
  const state = extractRelianceState(html);
  const list = state?.productListingPage?.productlists?.items;
  if (!Array.isArray(list)) return [];
  const today = new Date().toISOString().slice(0, 10);
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  for (const it of list.slice(0, 40)) {
    const name = String(it?.name || '').trim();
    const price = Number(it?.price?.effective?.min);
    if (!name || !Number.isFinite(price) || price <= 0) continue; // never publish an unseen price
    if (it?.sellable === false) continue;
    const slug = String(it?.slug || '').trim();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const marked = Number(it?.price?.marked?.min);
    const mrp = Number.isFinite(marked) && marked > price ? marked : undefined;
    const brand = it?.brand?.name ? String(it.brand.name) : undefined;
    const medias: string[] = (Array.isArray(it?.medias) ? it.medias : [])
      .filter((m: any) => m?.type !== 'video' && typeof m?.url === 'string')
      .map((m: any) => String(m.url).replace(/^http:/, 'https:'));
    const ean = Array.isArray(it?.attributes?.identifier?.ean) ? String(it.attributes.identifier.ean[0] || '') : '';
    const sku = Array.isArray(it?.attributes?.identifier?.sku_code) ? String(it.attributes.identifier.sku_code[0] || '') : '';
    const rating = Number(it?.rating);
    const url = `${RELIANCE_WEB}/product/${slug}`;
    out.push(newRawItem(source, {
      title: name.slice(0, 200),
      brand,
      model: sku || undefined,
      price,
      listPrice: mrp,
      currency: 'INR',
      seller: 'Reliance Digital',
      sellerUrl: url,
      attributes: {
        brand: brand || '',
        discount: mrp ? `${Math.round(((mrp - price) / mrp) * 100)}%` : '',
        image: medias[0] || '',
        ...(medias.length > 1 ? { image_urls: medias.slice(0, 6).join('|') } : {}),
        ...(Number.isFinite(rating) && rating > 0 ? { rating: String(rating) } : {}),
        data_note: `Price as listed on reliancedigital.in search, observed ${today}`,
      },
      identifiers: (ean || sku) ? { ...(ean ? { gtin: ean } : {}), ...(sku ? { sku } : {}) } : undefined,
      evidence: { sourceUrl: pageUrl, extractedFields: ['title', 'price', 'mrp', 'brand', 'image', 'url'] },
    }));
  }
  return out;
}
