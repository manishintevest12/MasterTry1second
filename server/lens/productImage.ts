/**
 * Product photo resolver (owner 27 Oct: "image ni aa raha").
 *
 * A seller row can be perfectly valid and still carry no photo: Zepto's rails ship
 * images in shapes the parser missed, and older catalogue rows were written before
 * galleries were captured. The product page then painted "No photo available" even
 * though the SAME product is sitting in our own catalogue with a photo attached,
 * photographed by a different seller.
 *
 * So: when the row itself has no photo, borrow the photo of the same product family
 * from the catalogue. Same brand + same distinctive tokens, any seller, newest first.
 * This is still real data (a real photo of the real product), never a stock image.
 */
import { getStore } from '../common/db';

const STOP = new Set([
  'with', 'from', 'pack', 'combo', 'offer', 'free', 'best', 'india', 'indian',
  'the', 'and', 'for', 'ml', 'kg', 'gm', 'ltr', 'litre', 'liter', 'gram', 'pcs',
  'piece', 'pieces', 'count', 'now', 'fresh', 'new',
]);

/** Distinctive search tokens: brand-ish words and model numbers, unit words dropped. */
export function imageTokens(query: string): string[] {
  return String(query || '')
    .toLowerCase()
    .replace(/[^a-z0-9.\- ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t) && !/^\d+(\.\d+)?$/.test(t))
    .slice(0, 3);
}

function firstHttps(doc: any): string | null {
  if (!doc) return null;
  const list = [
    doc.image_url,
    ...String(doc.image_urls || '').split('|'),
    doc.image,
    doc.thumbnail,
  ];
  for (const u of list) {
    const s = String(u || '').trim();
    if (s.startsWith('https://')) return s;
  }
  return null;
}

/**
 * Best real photo for a product query, from any seller already in the catalogue.
 * Returns null when the catalogue genuinely has no picture of this product.
 */
export async function resolveCatalogueImage(
  query: string,
  vertical: string,
  opts: { excludeSeller?: string } = {},
): Promise<string | null> {
  const tokens = imageTokens(query);
  if (!tokens.length) return null;
  const store = getStore();
  const params: unknown[] = [vertical];
  let where = `vertical = ? AND attributes IS NOT NULL AND attributes LIKE '%image%'`;
  for (const t of tokens) {
    where += ' AND LOWER(title) LIKE ?';
    params.push(`%${t.replace(/[%_]/g, '')}%`);
  }
  try {
    const rows = await store.query<any>(
      `SELECT title, attributes FROM offers WHERE ${where} ORDER BY fetched_at DESC LIMIT 40`,
      params,
    );
    const skip = String(opts.excludeSeller || '').toLowerCase().trim();
    for (const r of rows) {
      if (skip && String(r.title || '').toLowerCase().includes(skip)) continue;
      const url = firstHttps(typeof r.attributes === 'string' ? JSON.parse(r.attributes) : r.attributes);
      if (url) return url;
    }
  } catch {
    /* catalogue hiccup: the caller falls back to the seller logo tile */
  }
  return null;
}
