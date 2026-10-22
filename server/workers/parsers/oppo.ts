/**
 * Oppo India (oppo.com/in) search parser — two-stage, all browserless.
 *
 * Stage 1 (search SSR, cracked 22 Oct): the search page is server-rendered by
 * "Venus-Render" and embeds the product cards as JSON objects inside <script>
 * blocks — every object carrying a buyLink is a product hit:
 *   { title, buyLink: https://www.oppo.com/in/product/<slug>.P.P<pid>,
 *     image: /content/dam/... (relative, prefix https://www.oppo.com),
 *     link, tag, toStore }
 * The SSR search carries NO prices, so stage 2 fills them.
 *
 * Stage 2 (PDP, same host): each product page embeds per-variant schema.org
 * objects (one per colour/storage SKU, found by walking back from "color"):
 *   { @type: ProductVariant, name, sku, color, memory, storageCapacity,
 *     image: [4 shots], offers: { price, priceCurrency: INR,
 *       listPrice: { price }, availability: schema.org/InStock,
 *       priceValidUntil }, model, mpn, gtin13 }
 * The first in-stock variant wins; its image[] is the multi-shot gallery
 * (owner rule satisfied without any browser).
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export interface OppoSearchProduct {
  title: string;
  buyLink: string;
  image: string;
  tag: string;
}

export interface OppoVariant {
  name: string;
  sku: string;
  price: number;
  listPrice?: number;
  inStock: boolean;
  images: string[];
  color?: string;
  storage?: string;
  memory?: string;
  model?: string;
  variantCount: number;
}

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Stage 1: extract product objects (with buyLink) from the SSR search HTML. */
export function parseOppoSearch(html: string): OppoSearchProduct[] {
  const out: OppoSearchProduct[] = [];
  const seen = new Set<string>();
  // Every buyLink occurrence lives inside a JSON object; find each and
  // walk back to its opening brace, then read the fields with a tolerant scan.
  let idx = html.indexOf('buyLink');
  while (idx !== -1 && out.length < 40) {
    const start = walkBackToObject(html, idx);
    if (start !== -1) {
      const obj = scanObject(html, start);
      if (obj && typeof obj.buyLink === 'string' && /^https?:/.test(obj.buyLink)) {
        const title = String(obj.title || '').trim();
        const key = String(obj.buyLink);
        if (title && !seen.has(key)) {
          seen.add(key);
          let img = String(obj.image || '');
          if (img && !/^https?:/.test(img)) img = img.startsWith('/') ? `https://www.oppo.com${img}` : `https://www.oppo.com/${img}`;
          out.push({ title, buyLink: key, image: img, tag: String(obj.tag || '') });
        }
      }
    }
    idx = html.indexOf('buyLink', idx + 7);
  }
  return out;
}

/** Walk backwards from position i to the opening '{' at object depth 0. */
function walkBackToObject(s: string, i: number): number {
  let depth = 0;
  let j = i;
  while (j > 0) {
    const c = s[j];
    if (c === '}') depth += 1;
    else if (c === '{') {
      if (depth === 0) return j;
      depth -= 1;
    }
    j -= 1;
  }
  return -1;
}

/** Tolerantly scan a flat JSON object starting at '{' and return its string fields. */
function scanObject(s: string, start: number): Record<string, string> | null {
  const end = findObjectEnd(s, start);
  if (end === -1) return null;
  const body = s.slice(start, end + 1);
  const out: Record<string, string> = {};
  const re = /"([A-Za-z0-9_]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out[m[1]] = m[2];
  return Object.keys(out).length ? out : null;
}

function findObjectEnd(s: string, start: number): number {
  let depth = 0;
  for (let k = start; k < s.length && k < start + 20_000; k++) {
    const c = s[k];
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return k;
    }
  }
  return -1;
}

/** Stage 2: extract per-variant price/gallery objects from a PDP page. */
export function parseOppoPdp(html: string): OppoVariant[] {
  const variants: OppoVariant[] = [];
  const seenSku = new Set<string>();
  // Every priced variant object carries offers.priceCurrency. From each
  // occurrence climb to the ENCLOSING object that has both a name and a price
  // (walking straight back stops at the inner offers{} — so climb until the
  // candidate body contains "name" and "priceCurrency" together).
  let idx = html.indexOf('"priceCurrency"');
  let steps = 0;
  while (idx !== -1 && variants.length < 20 && steps < 120) {
    steps += 1;
    let start = walkBackToObject(html, idx);
    let v: OppoVariant | null = null;
    while (start !== -1) {
      const end = findObjectEnd(html, start);
      if (end === -1) break;
      const body = html.slice(start, end + 1);
      if (body.includes('"sku"') && body.includes('"priceCurrency"')) { // variant objects carry sku; the inner Offer{} does not
        v = extractVariant(body);
        break;
      }
      start = walkBackToObject(html, start - 1);
    }
    if (v && !seenSku.has(v.sku)) {
      seenSku.add(v.sku);
      variants.push(v);
    }
    idx = html.indexOf('"priceCurrency"', idx + 15);
  }
  return variants;
}

function extractVariant(body: string): OppoVariant | null {
  // Prices and images live in nested objects; pull them with targeted regexes.
  const priceM = /"offers"\s*:\s*\{[^{}]*?"price"\s*:\s*"([0-9.]+)"/.exec(body);
  const price = num(priceM?.[1]);
  if (!price) return null;
  const listM = /"listPrice"\s*:\s*\{\s*[^{}]*?"price"\s*:\s*"([0-9.]+)"/.exec(body);
  const skuM = /"sku"\s*:\s*"([0-9A-Za-z-]+)"/.exec(body);
  const nameM = /"name"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(body);
  const availM = /"availability"\s*:\s*"([^"]+)"/.exec(body);
  const colorM = /"color"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(body);
  const memM = /"memory"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(body);
  const storM = /"storageCapacity"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(body);
  const modelM = /"model"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(body);
  const images: string[] = [];
  const imgRe = /"image"\s*:\s*\[([\s\S]*?)\]/.exec(body);
  if (imgRe) {
    for (const u of imgRe[1].match(/https?:\/\/[^"',\s]+/g) || []) {
      if (!images.includes(u)) images.push(u);
      if (images.length >= 6) break;
    }
  }
  const name = (nameM?.[1] || '').trim();
  if (!name) return null;
  return {
    name,
    sku: skuM?.[1] || `${name}-${colorM?.[1] || ''}`,
    price,
    listPrice: num(listM?.[1]),
    inStock: (availM?.[1] || '').includes('InStock'),
    images,
    color: colorM?.[1] || undefined,
    memory: memM?.[1] || undefined,
    storage: storM?.[1],
    model: modelM?.[1],
    variantCount: 1,
  };
}

/**
 * Some PDPs (Find X9 Ultra, Find X9s) embed no schema.org variant objects and
 * load prices via a session-gated buy XHR — but their FAQ/description prose
 * states the genuine launch price: "The Find X9 Ultra is ₹1,69,999 in a single
 * India configuration" / "Priced from ₹79,999 (12GB+256GB; ...)".
 * Extract that site-authored price when (and only when) it is present.
 */
export function extractOppoProsePrice(html: string): { price: number; matched: string } | null {
  const indian = (raw: string) => Number(raw.replace(/,/g, ''));
  const pats = [
    /is ₹([0-9][0-9,]{3,9}) in (?:a|an) [A-Za-z ]{0,30}configuration/,
    /Priced from ₹([0-9][0-9,]{3,9})/,
  ];
  for (const re of pats) {
    const m = re.exec(html);
    if (m) {
      const price = indian(m[1]);
      if (Number.isFinite(price) && price >= 1000) {
        return { price, matched: m[0].slice(0, 120) };
      }
    }
  }
  return null;
}

/** Build a RawSourceItem from a search product + its chosen PDP variant. */
export function oppoItem(
  source: SourceConfig,
  pageUrl: string,
  prod: OppoSearchProduct,
  v: OppoVariant,
  totalVariants: number,
  dataNoteOverride?: string,
): RawSourceItem {
  const gallery: string[] = [];
  if (/^https?:/.test(prod.image) && !gallery.includes(prod.image)) gallery.push(prod.image);
  for (const u of v.images) {
    if (/^https?:/.test(u) && !gallery.includes(u)) gallery.push(u);
    if (gallery.length >= 6) break;
  }
  const model = v.model || '';
  return newRawItem(source, {
    title: prod.title.slice(0, 200),
    brand: 'Oppo',
    model,
    price: v.price,
    listPrice: v.listPrice && v.listPrice > v.price ? v.listPrice : undefined,
    currency: 'INR',
    seller: 'Oppo (oppo.com/in)',
    sellerUrl: prod.buyLink,
    availability: v.inStock ? 'in_stock' : 'out_of_stock',
    attributes: {
      brand: 'Oppo',
      image: gallery[0] || '',
      image_urls: gallery.length > 1 ? gallery.join('|') : '',
      category: 'electronics',
      in_stock: v.inStock ? 'true' : 'false',
      ...(v.color ? { variant: v.color } : {}),
      ...(v.storage ? { storage: v.storage } : {}),
      ...(totalVariants > 1 ? { variant_count: String(totalVariants) } : {}),
      data_note: dataNoteOverride || `Live price from Oppo India PDP schema.org offers (search SSR + product page), observed ${new Date().toISOString().slice(0, 10)}`,
    },
    identifiers: { sku: v.sku },
    evidence: { sourceUrl: pageUrl, extractedFields: ['title', 'price', 'mrp', 'brand', 'image', 'url', 'stock', 'pdp_gallery'] },
  });
}
