/**
 * Flipkart search parser. Verified live: the SSR HTML embeds
 * window.__INITIAL_STATE__ containing ProductSummaryValue units with
 * titles.title, pricing.prices[{strikeOff,value}], availability.displayState,
 * rating.average/count and baseUrl. We read exactly those fields; nothing else.
 */
import { createHash } from 'crypto';
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

/** Extract the balanced JSON object that follows `marker =` in an HTML document. */
export function extractAssignedJson(html: string, marker: string): any | null {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const eq = html.indexOf('=', at);
  if (eq < 0) return null;
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = eq + 1; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') { if (start < 0) start = i; depth++; }
    else if (ch === '}') { depth--; if (depth === 0 && start >= 0) { try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; } } }
  }
  return null;
}

function collectUnits(node: any, out: any[]) {
  if (Array.isArray(node)) { for (const v of node) collectUnits(v, out); return; }
  if (node && typeof node === 'object') {
    // Product units are recognised by their shape (id + title + prices), not by the
    // type tag — Flipkart renames the tag between deploys but keeps the shape.
    if (node.id && node.titles?.title && Array.isArray(node.pricing?.prices) && node.pricing.prices.length) {
      out.push(node);
      return; // do not descend into a product unit further
    }
    for (const v of Object.values(node)) collectUnits(v, out);
  }
}

export function parseFlipkart(html: string, source: SourceConfig, searchUrl: string): RawSourceItem[] {
  const state = extractAssignedJson(html, 'window.__INITIAL_STATE__');
  if (!state) return [];
  const units: any[] = [];
  collectUnits(state, units);
  const fingerprint = createHash('sha256').update(html.slice(0, 50000)).digest('hex');
  const seen = new Set<string>();
  const out: RawSourceItem[] = [];
  for (const u of units) {
    const id: string | undefined = u.id;
    const title: string | undefined = u.titles?.title;
    const prices: Array<{ strikeOff: boolean; value: number }> = Array.isArray(u.pricing?.prices) ? u.pricing.prices : [];
    const selling = prices.find((p) => !p.strikeOff)?.value;
    const mrp = prices.find((p) => p.strikeOff)?.value;
    if (!id || !title || !selling || selling <= 0 || seen.has(id)) continue;
    seen.add(id);
    const state2 = String(u.availability?.displayState || '');
    const availability = state2 === 'IN_STOCK' ? 'in_stock' : /OUT_OF_STOCK|SOLD_OUT|UNAVAILABLE/i.test(state2) ? 'out_of_stock' : 'unknown';
    const avg = u.rating?.average;
    const rawImg = String(u.media?.images?.[0]?.url || u.imageUrl || '');
    const imageUrl = rawImg
      ? rawImg.replace(/^http:/, 'https:').replace('{@width}', '400').replace('{@height}', '400').replace('{@quality}', '70')
      : '';
    const fkImgs: string[] = (Array.isArray(u.media?.images) ? u.media.images : [])
      .map((im: any) => String(im?.url || ''))
      .filter(Boolean)
      .map((x: string) => x.replace(/^http:/, 'https:').replace('{@width}', '400').replace('{@height}', '400').replace('{@quality}', '70'))
      .filter((x: string) => /^https:\/\/rukmini/.test(x))
      .slice(0, 6);
    out.push(newRawItem(source, {
      title: title.slice(0, 220),
      price: selling,
      currency: 'INR',
      listPrice: mrp && mrp > selling ? mrp : undefined,
      brand: u.titles?.superTitle || undefined,
      identifiers: { vendorProductId: id },
      attributes: { ...(avg ? { rating: String(avg) } : {}), ...(u.rating?.count ? { rating_count: String(u.rating.count) } : {}), ...(/^https:\/\/rukmini/.test(imageUrl) ? { image_url: imageUrl } : {}), ...(fkImgs.length > 1 ? { image_urls: fkImgs.join('|') } : {}) },
      seller: 'Flipkart',
      sellerUrl: u.baseUrl ? `https://www.flipkart.com${String(u.baseUrl).split('&')[0]}` : undefined,
      availability,
      evidence: {
        sourceUrl: searchUrl,
        sourceReference: id,
        rawFingerprint: fingerprint,
        extractedFields: ['title', 'price', ...(mrp ? ['listPrice'] : []), ...(availability !== 'unknown' ? ['availability'] : []), ...(avg ? ['rating'] : [])],
      },
    }));
  }
  return out.slice(0, 20);
}
