/**
 * Croma (croma.com — Tata Digital electronics retailer) search parser.
 *
 * The PWA search page (/searchB) is client-rendered, but the search BFF is a
 * plain GET replayable with Chrome TLS impersonation (cracked 22 Oct 2026):
 *
 *   GET https://api.croma.com/searchservices/v1/search
 *       ?currentPage=0&query=<q>:relevance&fields=FULL&channel=WEB&channelCode=400001
 *
 * Extracted from the PWA main chunk (main.*.chunk.js): E(e) prepends
 * "searchservices/v1/search" on /searchB routes with channel=WEB + a
 * channelCode (pincode; 400001 Mumbai works unauthenticated) and
 * query=<term>:<sort> where the site sends ':relevance'.
 *
 * Response: products[] with name, manufacturer, price.value (selling INR),
 * mrp.value, plpImage (hero), url (PDP path), code (SKU), stockFlag (array of
 * store codes; non-empty = in stock), averageRating, numberOfReviews.
 *
 * Multi-image (owner rule, every ecom card multiple photos): search returns a
 * single hero shot; the PDP embeds the full gallery as
 * media.tatacroma.com/.../Images/<code>_<n>_<hash>.png — the worker fetches the
 * top 3 PDPs (Amazon pattern, 900ms spacing, soft-fail) and mergeCromaGallery
 * unions the shots into attributes.image_urls.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

interface CromaPrice { value?: number; formattedValue?: string }
interface CromaProduct {
  code?: string;
  name?: string;
  manufacturer?: string;
  summary?: string;
  price?: CromaPrice;
  pincodePrice?: CromaPrice;
  mrp?: CromaPrice;
  plpImage?: string;
  url?: string;
  stockFlag?: unknown;
  averageRating?: number;
  finalReviewRating?: number;
  numberOfReviews?: number;
  finalReviewRatingCount?: number;
  discount?: number;
  quickViewDesc?: string;
}

export function parseCromaSearch(rawBody: string, source: SourceConfig, pageUrl: string): RawSourceItem[] {
  let root: any;
  try { root = JSON.parse(rawBody); } catch { return []; }
  const products: CromaProduct[] = Array.isArray(root?.products) ? root.products : [];
  const items: RawSourceItem[] = [];
  const seen = new Set<string>();
  for (const p of products) {
    const name = String(p.name || '').trim();
    const price = Number(p.price?.value ?? p.pincodePrice?.value);
    if (!name || !Number.isFinite(price) || price <= 0) continue;
    const sku = String(p.code || '');
    if (sku && seen.has(sku)) continue;
    if (sku) seen.add(sku);
    const mrpVal = Number(p.mrp?.value);
    const mrp = Number.isFinite(mrpVal) && mrpVal > price ? mrpVal : undefined;
    const brand = p.manufacturer ? String(p.manufacturer) : undefined;
    const rel = String(p.url || '');
    const url = rel
      ? `https://www.croma.com${rel.startsWith('/') ? rel : `/${rel}`}`
      : 'https://www.croma.com';
    const img = /^https:\/\//.test(String(p.plpImage || '')) ? String(p.plpImage) : undefined;
    const stock = Array.isArray(p.stockFlag) ? (p.stockFlag.length > 0 ? 'true' : 'false') : 'true';
    const rating = Number(p.averageRating ?? p.finalReviewRating) || 0;
    const reviews = Number(p.numberOfReviews ?? p.finalReviewRatingCount) || 0;
    items.push(newRawItem(source, {
      title: (brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${name}` : name).slice(0, 200),
      brand,
      model: sku || undefined,
      price,
      listPrice: mrp,
      currency: 'INR',
      seller: 'Croma',
      sellerUrl: url,
      availability: stock === 'true' ? 'in_stock' : 'out_of_stock',
      attributes: {
        brand: brand || '',
        ...(p.discount ? { discount: `${p.discount}%` } : {}),
        image: img || '',
        in_stock: stock,
        ...(rating ? { rating: String(rating) } : {}),
        ...(reviews ? { review_count: String(reviews) } : {}),
        data_note: `Live prices from Croma search API, observed ${new Date().toISOString().slice(0, 10)}`,
      },
      identifiers: sku ? { sku } : undefined,
      evidence: { sourceUrl: pageUrl, extractedFields: ['title', 'price', 'mrp', 'brand', 'image', 'url', 'stock'] },
    }));
    if (items.length >= 30) break;
  }
  return items;
}

/**
 * Extract the PDP gallery for a given product code from a Croma product page.
 * The PDP embeds every shot as media.tatacroma.com/.../Images/<code>_<n>_<hash>.png
 * (n = 0..7 typical). Gallery hashes are unique per shot, so they cannot be
 * guessed from the search payload — the PDP must be fetched.
 */
export function extractCromaGallery(html: string, code: string): string[] {
  if (!code) return [];
  const urls = new Set<string>();
  const re = /https:\/\/media\.tatacroma\.com\/[A-Za-z0-9%_()\/.-]*?Images[^"'\\ )]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const u = m[0];
    if (!u.includes(code) || u.includes('No_image')) continue;
    urls.add(u);
  }
  // Order shots by their <code>_<n>_ index for a stable gallery order.
  return Array.from(urls)
    .map((u) => {
      const idx = new RegExp(`${code}_(\\d+)_`).exec(u);
      return { u, n: idx ? Number(idx[1]) : 99 };
    })
    .sort((a, b) => a.n - b.n)
    .map((x) => x.u)
    .slice(0, 6);
}

/** Merge a fetched gallery into an already-parsed item (in place, soft-fail). */
export function mergeCromaGallery(item: RawSourceItem, gallery: string[]): void {
  const hero = String((item.attributes as any)?.image || '');
  const merged = [hero, ...gallery].filter((u, i, a) => /^https:\/\//.test(u) && a.indexOf(u) === i).slice(0, 6);
  if (merged.length > 1) {
    (item.attributes as any) = { ...(item.attributes as any), image_urls: merged.join('|') };
  }
}
