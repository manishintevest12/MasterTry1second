/**
 * Myntra parser. Myntra serves its search page as SSR with the full result
 * set embedded in window.__myx (searchData.results.products[]). Each product
 * carries name, brand, price, mrp, rating, image and a landing path.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

interface MyxProduct {
  productName?: string;
  product?: string;
  brand?: string;
  price?: number;
  mrp?: number;
  rating?: number;
  ratingCount?: number;
  productId?: number;
  landingPageUrl?: string;
  searchImage?: string;
  discountDisplayLabel?: string;
  category?: string;
}

function findProductArrays(o: any, depth = 0): MyxProduct[][] {
  const out: MyxProduct[][] = [];
  if (depth > 8 || !o || typeof o !== 'object') return out;
  if (Array.isArray(o)) {
    for (const v of o) out.push(...findProductArrays(v, depth + 1));
    return out;
  }
  if (o['products'] && Array.isArray(o['products']) && o['products'].length && typeof o['products'][0] === 'object' && 'productName' in o['products'][0]) {
    out.push(o['products'] as MyxProduct[]);
  }
  for (const v of Object.values(o)) out.push(...findProductArrays(v, depth + 1));
  return out;
}

export function parseMyntra(html: string, source: SourceConfig, pageUrl: string): RawSourceItem[] {
  // window.__myx = {...}; — sometimes assigned via JSON.parse('...')
  let root: any = null;
  const direct = /window\.__myx\s*=\s*(\{[\s\S]*?\})\s*;\s*<\/script>/.exec(html);
  if (direct) { try { root = JSON.parse(direct[1]); } catch { /* fall through */ } }
  if (!root) {
    // Robust path: locate the assignment, then brace-match the object (strings can contain "};</script>").
    const start = /window\.__myx\s*=\s*\{/.exec(html);
    if (start) {
      const from = start.index + start[0].length - 1;
      let depth = 0, inStr = false, esc = false, end = -1;
      for (let i = from; i < html.length; i++) {
        const ch = html[i];
        if (inStr) {
          if (esc) esc = false;
          else if (ch === '\\') esc = true;
          else if (ch === '"') inStr = false;
          continue;
        }
        if (ch === '"') inStr = true;
        else if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end > 0) { try { root = JSON.parse(html.slice(from, end + 1)); } catch { /* fall through */ } }
    }
  }
  if (!root) return [];
  const arrays = findProductArrays(root);
  const products = arrays.sort((a, b) => b.length - a.length)[0] || [];
  const items: RawSourceItem[] = [];
  for (const p of products.slice(0, 40)) {
    const name = String(p.productName || p.product || '').trim();
    const price = Number(p.price);
    if (!name || !Number.isFinite(price) || price <= 0) continue;
    const mrp = Number(p.mrp) > price ? Number(p.mrp) : undefined;
    const landing = String(p.landingPageUrl || '');
    const url = landing ? `https://www.myntra.com/${landing.replace(/^\/+/, '')}` : 'https://www.myntra.com';
    const img = p.searchImage ? String(p.searchImage).replace(/^http:/, 'https:') : undefined;
    items.push(newRawItem(source, {
      title: name.slice(0, 200),
      brand: p.brand ? String(p.brand).slice(0, 120) : undefined,
      model: p.productId ? String(p.productId) : undefined,
      price,
      listPrice: mrp,
      currency: 'INR',
      seller: 'Myntra',
      sellerUrl: url,
      attributes: {
        brand: p.brand ? String(p.brand) : '',
        category: p.category ? String(p.category) : '',
        rating: p.rating ? String(Number(p.rating).toFixed(1)) : '',
        rating_count: p.ratingCount ? String(p.ratingCount) : '',
        discount: p.discountDisplayLabel ? String(p.discountDisplayLabel).replace(/[()]/g, '') : '',
        image: img || '',
        data_note: `Product as listed on Myntra search, observed ${new Date().toISOString().slice(0, 10)}`,
      },
      identifiers: p.productId ? { sku: String(p.productId) } : undefined,
      evidence: { sourceUrl: pageUrl, extractedFields: ['title', 'price', 'mrp', 'brand', 'rating', 'image', 'landingPageUrl'] },
    }));
  }
  return items;
}
