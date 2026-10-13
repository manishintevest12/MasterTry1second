/**
 * Cross-seller product grouping (metasearch core): when the SAME product is offered by
 * several sellers, show ONE card with every seller's price in sellerQuotes.
 *
 * Conservative on purpose (a wrong merge is worse than two cards):
 *  - only e-commerce and grocery rows;
 *  - same product key = shared GTIN/EAN/UPC, OR identical normalized "brand + product words + size";
 *  - size/quantity tokens ("100 g", "500ml", "2 x 250g", "128gb") must be IDENTICAL, so
 *    a 100 g pack never merges with a 200 g pack;
 *  - one quote per seller (the cheapest), cheapest quote becomes the headline price.
 * Nothing is invented: every quote is an original, evidence-backed offer.
 */
const UNIT_RE = /(\d+(?:\.\d+)?)\s*(kg|g|gm|gms|gram|grams|ml|l|ltr|litre|liter|litres|liters|pcs|pc|pack|units?|tb|gb|mb|mm|cm|inch|in)\b/g;

const NOISE = new Set([
  'the', 'and', 'with', 'for', 'of', 'pack', 'combo', 'new', 'premium', 'original', 'fresh', 'natural', 'all', 'by', 'in', 'a', 'an',
  'buy', 'online', 'best', 'price', 'india', 'pouch', 'packet',
]);

const UNIT_CANON: Record<string, string> = {
  kg: 'kg', g: 'g', gm: 'g', gms: 'g', gram: 'g', grams: 'g', ml: 'ml', l: 'l', ltr: 'l', litre: 'l', liter: 'l', litres: 'l', liters: 'l',
  pcs: 'pc', pc: 'pc', unit: 'pc', units: 'pc', pack: 'pc', tb: 'tb', gb: 'gb', mb: 'mb', mm: 'mm', cm: 'cm', inch: 'in', in: 'in',
};

/** Canonical size tokens, e.g. "100 g" -> "100g", "1 kg" -> "1000g", "1 l" -> "1000ml". */
export function sizeTokens(text: string): string[] {
  const out: string[] = [];
  const t = text.toLowerCase().replace(/(\d),(\d)/g, '$1$2');
  for (const m of t.matchAll(UNIT_RE)) {
    let n = parseFloat(m[1]);
    let u = UNIT_CANON[m[2]] || m[2];
    if (u === 'kg') { n *= 1000; u = 'g'; }
    if (u === 'l') { n *= 1000; u = 'ml'; }
    out.push(`${Math.round(n * 100) / 100}${u}`);
  }
  return Array.from(new Set(out)).sort();
}

export interface ProductSig { brand: string; words: string[]; sizes: string; }

export function productSig(title: string, brand?: string): ProductSig | null {
  const t = String(title || '').toLowerCase();
  const sizes = sizeTokens(t).join(',');
  // parenthetical text often holds the common name ("(Phool Makhana)"), so keep its words
  const words = t
    .replace(UNIT_RE, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !NOISE.has(w))
    .map((w) => w.replace(/(ies|es|s)$/, ''));
  const b = String(brand || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const uniq = Array.from(new Set(words));
  if (uniq.length < 2) return null;
  return { brand: b, words: uniq, sizes };
}

/** Back-compat helper (tests): null when there is too little signal. */
export function productKey(title: string, brand?: string): string | null {
  const sig = productSig(title, brand);
  return sig ? `${sig.brand}|${[...sig.words].sort().join(' ')}|${sig.sizes}` : null;
}

/** Same product? brand equal (when both known), sizes identical, and the shorter title's words are (almost) all in the longer. */
export function sameProduct(a: ProductSig, b: ProductSig): boolean {
  if (a.sizes !== b.sizes) return false;
  // a brand known on both sides must match; a brand known on one side must appear in the other's words
  if (a.brand && b.brand && a.brand !== b.brand) return false;
  const brandIn = (sig: ProductSig, other: ProductSig) => !sig.brand || other.words.join('').includes(sig.brand) || other.brand === sig.brand;
  if (!brandIn(a, b) || !brandIn(b, a)) return false;
  const [small, large] = a.words.length <= b.words.length ? [a, b] : [b, a];
  const lw = new Set(large.words);
  const shared = small.words.filter((w) => lw.has(w)).length;
  return shared >= 2 && shared / small.words.length >= 0.75;
}

interface Quote { sellerName: string; price: number; originalPrice?: number; [k: string]: any }

/**
 * Merge legacy-shape comparison items (already mapped by offerToComparisonItem) of the same product.
 * `gtinOf` lets the caller supply an identifier for stronger matching.
 */
export function groupSameProduct<T extends { id: string; vertical: string; title: string; primaryPrice: number; sellerQuotes: Quote[]; imageUrl?: string; specs?: Record<string, string> }>(
  items: T[],
  extra: (item: T) => { brand?: string; gtin?: string } = () => ({}),
): T[] {
  type Cluster = { sig: ProductSig | null; gtin?: string; vertical: string; members: T[] };
  const clusters: Cluster[] = [];
  const slots: Array<T | Cluster> = [];
  for (const it of items) {
    if (it.vertical !== 'ecommerce' && it.vertical !== 'grocery') { slots.push(it); continue; }
    const { brand, gtin } = extra(it);
    const sig = productSig(it.title, brand);
    if (!sig && !gtin) { slots.push(it); continue; }
    const hit = clusters.find((c) => c.vertical === it.vertical &&
      ((gtin && c.gtin && gtin === c.gtin) || (sig && c.sig && sameProduct(sig, c.sig))));
    if (hit) { hit.members.push(it); if (!hit.gtin && gtin) hit.gtin = gtin; continue; }
    const c: Cluster = { sig, gtin, vertical: it.vertical, members: [it] };
    clusters.push(c);
    slots.push(c);
  }
  const out: T[] = [];
  for (const entry of slots) {
    if (!('members' in (entry as any))) { out.push(entry as T); continue; }
    const members = (entry as Cluster).members;
    if (members.length === 1) { out.push(members[0]); continue; }
    // one quote per seller: keep the cheapest priced quote
    const bySeller = new Map<string, Quote>();
    for (const m of members) {
      for (const q of m.sellerQuotes) {
        const key = String(q.sellerName || '').toLowerCase();
        const cur = bySeller.get(key);
        if (!cur || ((q.price > 0) && (cur.price <= 0 || q.price < cur.price))) bySeller.set(key, { ...q });
      }
    }
    const quotes = Array.from(bySeller.values()).sort((a, b) => (a.price > 0 ? a.price : Infinity) - (b.price > 0 ? b.price : Infinity));
    quotes.forEach((q, i) => { q.isLowest = i === 0 && q.price > 0; });
    const priced = members.filter((m) => m.primaryPrice > 0).sort((a, b) => a.primaryPrice - b.primaryPrice);
    const head = priced[0] || members[0];
    const withImg = members.find((m) => m.imageUrl);
    out.push({ ...head, imageUrl: head.imageUrl || withImg?.imageUrl, sellerQuotes: quotes } as T);
  }
  return out;
}
