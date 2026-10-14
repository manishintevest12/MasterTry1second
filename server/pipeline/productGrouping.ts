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

/** Generic words present in almost every credit-card name; they never distinguish cards. */
const CC_GENERIC = new Set(['bank', 'credit', 'card', 'cards', 'visa', 'mastercard', 'master', 'rupay', 'infinite']);
/** Distinctive identity of a credit card: its non-generic name tokens, sorted (order-free). */
function ccCardKey(title: string): string | null {
  const words = String(title || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 1 && !CC_GENERIC.has(w));
  return words.length ? [...new Set(words)].sort().join(' ') : null;
}

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


/**
 * Movies: the SAME film listed by BookMyShow / TicketNew / District / Cinepolis is ONE card with every
 * site as a seller (cheapest first when ticket prices are known, otherwise listing order).
 * Key = normalized title ("Drishyam: The Conclusion" == "Drishyam The Conclusion") + city.
 */
export function movieKey(title: string, city?: string): string | null {
  const t = String(title || '').toLowerCase()
    .replace(/\((?:hindi|english|tamil|telugu|malayalam|kannada|bengali|marathi|punjabi|gujarati|imax|3d|2d|4dx|dolby[^)]*|u\/?a?|a|s)\)/g, ' ')
    .replace(/\b(hindi|english|tamil|telugu|malayalam|kannada|3d|2d|imax|4dx)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|a|an|movie|film|tickets?)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
  if (t.length < 3) return null;
  return `${t}|${String(city || '').toLowerCase()}`;
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
  type Cluster = { sig: ProductSig | null; gtin?: string; vertical: string; members: T[]; movieKey?: string };
  const clusters: Cluster[] = [];
  const slots: Array<T | Cluster> = [];
  for (const it of items) {
    if (it.vertical === 'movies' || it.vertical === 'movie') {
      const mk = movieKey(it.title, (it as any).city || it.specs?.['City'] || (it as any).location);
      if (!mk) { slots.push(it); continue; }
      const mh = clusters.find((c) => c.movieKey === mk && c.vertical === it.vertical);
      if (mh) { mh.members.push(it); continue; }
      const mc: Cluster = { sig: null, vertical: it.vertical, members: [it], movieKey: mk };
      clusters.push(mc); slots.push(mc);
      continue;
    }
    if (it.vertical === 'creditcards') {
      // Same card listed by CardInsider and Paisabazaar = ONE card. STRICT identity: the
      // distinctive name tokens (everything except generic card words) must match EXACTLY,
      // because 'Flipkart Axis Bank Credit Card' and '... Super Elite Credit Card' are
      // different cards even though most words overlap. A wrong merge is worse than two cards.
      const k = ccCardKey(it.title);
      if (!k) { slots.push(it); continue; }
      const hit = clusters.find((c) => c.vertical === 'creditcards' && c.movieKey === k);
      if (hit) { hit.members.push(it); continue; }
      const c: Cluster = { sig: null, vertical: it.vertical, members: [it], movieKey: k };
      clusters.push(c); slots.push(c);
      continue;
    }
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
    // Credit cards: the fee is the issuer's own number, identical across sources — so the
    // RICHEST listing (most published fee/reward fields) becomes the head, not the cheapest.
    const head = (members[0] as any).vertical === 'creditcards'
      ? [...members].sort((a, b) => Object.keys(a.specs || {}).length - Object.keys(b.specs || {}).length).pop()!
      : (priced[0] || members[0]);
    const withImg = members.find((m) => m.imageUrl);
    // UNION THE CARD'S SPEC PANEL: one film's card merges every site, and different sites
    // contribute different real attributes (trailer from District, IMDb/critics/theatres from
    // TicketNew, language from BMS...). The head keeps its own values; missing keys are
    // filled from the other members, cheapest first. Never overwritten, only filled.
    const mergedSpecs: Record<string, string> = { ...(head.specs || {}) };
    const FEATURE_KEYS = ['theatres', 'theatre count', 'shows today', 'price band', 'imdb rating', 'imdb id',
      'critic rating', 'critic review', 'trailer url', 'language', 'genres', 'certification', 'duration min',
      'censor rating', 'runtime minutes', 'sessions today', 'release date', 'director', 'cast', 'starring'];
    const normKey = (k: string) => k.replace(/_/g, ' ').toLowerCase();
    const have = new Set(Object.keys(mergedSpecs).map(normKey));
    for (const m of members) {
      if (m === head) continue;
      for (const [k, v] of Object.entries(m.specs || {})) {
        const nk = normKey(k);
        const wanted = FEATURE_KEYS.includes(nk) || /theatre|imdb|critic|trailer|price band|shows|rating/.test(nk)
          || ((members[0] as any).vertical === 'creditcards'); // cards: union every issuer-published field
        if (!wanted) continue;
        if (!have.has(nk) && v != null && String(v).trim() !== '') {
          mergedSpecs[k] = v; have.add(nk);
        }
      }
    }
    out.push({ ...head, specs: mergedSpecs, imageUrl: head.imageUrl || withImg?.imageUrl, sellerQuotes: quotes } as T);
  }
  return out;
}
