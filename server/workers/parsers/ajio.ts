/**
 * Ajio parser. Ajio exposes a direct JSON search API:
 *   GET https://www.ajio.com/api/search?fields=FULL&query={q}&pageSize=N
 * Each product carries name, brand, price, MRP, image and a relative product URL.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

interface AjioProduct {
  code?: string;
  name?: string;
  url?: string;
  price?: { value?: number };
  wasPriceData?: { value?: number };
  discountPercent?: number;
  fnlColorVariantData?: { brandName?: string; outfitPictureURL?: string };
  /** 2026 API shape: flat {altText, format, imageType, url} entries. */
  images?: Array<{ altText?: string; url?: string; media?: Array<{ imageUrl?: string; mediumImageUrl?: string }> }>;
  /** 2026 API shape: model shots, each {model, images: [{format, url}]}. */
  extraImages?: Array<{ model?: string; images?: Array<{ format?: string; url?: string }> }>;
}

function pickImage(p: AjioProduct): string | undefined {
  const direct = p.fnlColorVariantData?.outfitPictureURL;
  if (direct) return String(direct).replace(/^http:/, 'https:');
  const media = p.images?.[0]?.media;
  const url = media?.[0]?.mediumImageUrl || media?.[0]?.imageUrl;
  return url ? String(url).replace(/^http:/, 'https:') : undefined;
}

function pickImages(p: AjioProduct): string[] {
  const out: string[] = [];
  const add = (u?: string) => { if (u) { const x = String(u).replace(/^http:/, 'https:'); if (!out.includes(x)) out.push(x); } };
  add(p.fnlColorVariantData?.outfitPictureURL);
  // 2026 flat shape: images[].url ; legacy shape: images[].media[]
  for (const g of p.images || []) {
    add(g.url);
    for (const m of g.media || []) add(m.mediumImageUrl || m.imageUrl);
  }
  // 2026 model shots: extraImages[].images[].url
  for (const x of p.extraImages || []) for (const m of x.images || []) add(m.url);
  return out.slice(0, 8);
}

export function parseAjio(rawBody: string, source: SourceConfig, pageUrl: string): RawSourceItem[] {
  let root: any;
  try { root = JSON.parse(rawBody); } catch { return []; }
  const products: AjioProduct[] = Array.isArray(root?.products) ? root.products : [];
  const items: RawSourceItem[] = [];
  for (const p of products.slice(0, 40)) {
    const name = String(p.name || '').trim();
    const price = Number(p.price?.value);
    if (!name || !Number.isFinite(price) || price <= 0) continue;
    const mrp = Number(p.wasPriceData?.value) > price ? Number(p.wasPriceData?.value) : undefined;
    const brand = p.fnlColorVariantData?.brandName ? String(p.fnlColorVariantData.brandName) : undefined;
    const rel = String(p.url || '');
    const url = rel ? `https://www.ajio.com${rel.startsWith('/') ? rel : `/${rel}`}` : 'https://www.ajio.com';
    const img = pickImage(p);
    items.push(newRawItem(source, {
      title: (brand ? `${brand} ${name}` : name).slice(0, 200),
      brand,
      model: p.code ? String(p.code) : undefined,
      price,
      listPrice: mrp,
      currency: 'INR',
      seller: 'Ajio',
      sellerUrl: url,
      attributes: {
        brand: brand || '',
        discount: p.discountPercent ? `${p.discountPercent}%` : '',
        image: img || '',
        ...(pickImages(p).length > 1 ? { image_urls: pickImages(p).join('|') } : {}),
        data_note: `Product as listed on Ajio search API, observed ${new Date().toISOString().slice(0, 10)}`,
      },
      identifiers: p.code ? { sku: String(p.code) } : undefined,
      evidence: { sourceUrl: pageUrl, extractedFields: ['title', 'price', 'mrp', 'brand', 'discount', 'image', 'url'] },
    }));
  }
  return items;
}
