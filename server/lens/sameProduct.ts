/**
 * "Is this search result the SAME product as the one the user pasted?"
 * Showing a ₹150 phone case as the "cheapest iPhone" would be a false claim, so the lens only
 * keeps offers that pass: (1) not an accessory when the pasted product is not one, and
 * (2) the identity tokens (model numbers, capacities, brand words) of the pasted title are present.
 */

const ACCESSORY_WORDS = [
  'case', 'cover', 'back cover', 'pouch', 'sleeve', 'skin', 'screen guard', 'screen protector', 'tempered', 'protector',
  'charger', 'adapter', 'adaptor', 'cable', 'strap', 'band', 'stand', 'holder', 'mount', 'stylus', 'sticker', 'cleaner',
  'refill', 'replacement', 'spare', 'lens guard', 'camera protector', 'magsafe', 'mag-safe', 'pop socket', 'popsocket', 'bumper',
  'ring light', 'tripod', 'dock', 'wallet',
  // Owner 27 Oct ("iphone search -> adapter dikha, ₹199 vs ₹59,900 compare hua"): a power bank
  // titled "... Fast Powerbank | Type-C | iPhone - Android Mobiles" carries the brand word ONLY
  // as a compatibility mention, and it was accepted as the iPhone itself.
  'power bank', 'powerbank', 'power-bank', 'battery pack', 'backup battery', 'car charger',
  'charging brick', 'wall charger', 'data cable', 'charging cable', 'otg',
  // "Compatible with iPhone 15 – Original-Quality OLED Screen" is a spare part, not the phone.
  'compatible', 'compatibility', 'fits', 'replacement part',
];

/**
 * Device TYPES a listing can declare. A candidate that declares a type the query never
 * asked for is a DIFFERENT product — a power bank can never be "the iPhone", whatever
 * compatibility words its title carries.
 */
const TYPE_WORDS: Array<[string, string[]]> = [
  ['powerbank', ['power bank', 'powerbank', 'power-bank', 'portable charger', 'battery pack']],
  ['charger', ['charger', 'adapter', 'adaptor', 'charging brick', 'wall charger']],
  ['cable', ['cable', 'cord', 'data cable', 'otg']],
  ['case', ['case', 'cover', 'back cover', 'flip cover', 'bumper', 'sleeve', 'skin']],
  ['protector', ['screen guard', 'protector', 'tempered glass', 'screen protector']],
  ['earbuds', ['earbuds', 'earbud', 'earphone', 'earphones', 'headphone', 'headphones', 'tws', 'airpods', 'neckband', 'headset']],
  ['watch', ['smartwatch', 'smart watch', 'fitness band']],
  ['speaker', ['speaker', 'soundbar', 'party box']],
  ['tv', ['tv', 'smart tv', 'television', 'led tv', 'oled tv']],
  ['laptop', ['laptop', 'notebook', 'chromebook', 'macbook']],
  ['tablet', ['tablet', 'ipad']],
  ['camera', ['dslr', 'mirrorless', 'action camera', 'gopro']],
  ['monitor', ['monitor']],
  ['printer', ['printer']],
  ['router', ['router', 'modem']],
  ['keyboard', ['keyboard']],
  ['mouse', ['mouse']],
];

/**
 * The part of a listing title that names the product ITSELF. Indian listings append bundles
 * and compatibility after delimiters ("Samsung Galaxy M35 5G ... with Earbuds", "Ambrane
 * Powerbank | Type-C | iPhone"), so type detection reads only the leading segment.
 */
export function primarySegment(title: string): string {
  return String(title || '')
    .split(/[|;]|\s-\s|\s+with\s+|\s+\+\s+|,|\s+free\s+/i)[0]
    .trim() || String(title || '');
}

/**
 * Title scope for the "is this an accessory?" question. Only FREEBIE/bundle clauses are cut
 * ("... with Charger", "... + 20W Adapter", "free case"): what follows a pipe or comma is
 * still the seller's own description of the item, and that is where accessories hide —
 * "Apple iPhone 18 Pro 5G | 512 GB | Burgundy | Mobile Cover" is a COVER at Rs.831
 * (owner 27 Oct, second report: still compared a cover with a phone).
 */
export function accessoryScope(title: string): string {
  return String(title || '').split(/\s+with\s+|\s+\+\s+|\s+free\s+|\s+freebie\s+|\s+comes\s+with\s+/i)[0].trim() || String(title || '');
}

/** Device types a title declares, matched on whole words so "smartwatch" is not a "watch" miss. */
export function declaredTypes(title: string): Set<string> {
  const t = ` ${primarySegment(title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
  const out = new Set<string>();
  for (const [type, words] of TYPE_WORDS) {
    if (words.some((w) => t.includes(` ${w} `) || t.includes(` ${w}s `))) out.add(type);
  }
  return out;
}

/**
 * Segments that merely say "works with X" are compatibility, not identity. Sellers write
 * "Ambrane 20000mAh Fast Powerbank | Type-C | iPhone - Android Mobiles | Black": the word
 * iPhone there describes COMPATIBILITY. Such segments are removed before identity tokens
 * are read, so a compatible accessory can never be mistaken for the phone itself.
 */
const COMPAT_ONLY = new Set([
  'iphone', 'ipad', 'ipod', 'android', 'ios', 'mobile', 'mobiles', 'phone', 'phones', 'smartphone', 'smartphones',
  'device', 'devices', 'tablet', 'tablets', 'laptop', 'laptops', 'compatible', 'compatibility', 'with', 'for', 'and',
  'or', 'all', 'universal', 'usb', 'type', 'type-c', 'typec', 'c', 'port', 'ports', 'support', 'supports', 'works',
  'suitable', 'series', 'model', 'models', 'samsung', 'oneplus', 'redmi', 'xiaomi', 'oppo', 'vivo', 'realme',
  'motorola', 'nothing', 'pixel', 'google',
]);

export function stripCompatibility(title: string): string {
  const parts = String(title || '').split(/[|/]|\s-\s|,(?=\s)/).map((x) => x.trim()).filter(Boolean);
  const kept = parts.filter((seg) => {
    const toks = seg.toLowerCase().replace(/[^a-z0-9+]+/g, ' ').split(' ').filter(Boolean);
    if (!toks.length) return false;
    // Pure compatibility talk ("iPhone", "Android Mobiles", "Type-C") carries no identity.
    // A segment with a model number ("iPhone 12") is real identity and is kept.
    return !toks.every((t) => COMPAT_ONLY.has(t));
  });
  return kept.length ? kept.join(' | ') : String(title || '');
}

const STOP = new Set(['the', 'and', 'with', 'for', 'new', 'latest', 'combo', 'pack', 'of', 'in', 'by', 'free', 'a', 'an', 'online', 'buy', 'best', 'price']);

/** Variant-tier words: '17' vs '17 Pro' are DIFFERENT products; the pasted title's tiers must match exactly. */
const TIERS = new Set(['pro', 'max', 'plus', 'mini', 'ultra', 'lite', 'prime', 'air']);

const COLORS = new Set(['black', 'white', 'blue', 'red', 'green', 'silver', 'gold', 'grey', 'gray', 'pink', 'purple', 'titanium', 'natural', 'midnight', 'starlight', 'yellow', 'orange', 'teal', 'ultramarine', 'lavender']);

/**
 * Users type brand names the way they SAY them: "i phone 18", "one plus 12",
 * "red mi note", "real me 12". A listing writes them as one word. Without this
 * the typed query could never match a real listing (26 Oct bug: "i phone 18"
 * returned "Price unavailable" while Flipkart had the exact phone at 1.64L).
 * Joining the spoken form BEFORE tokenising makes both sides agree.
 */
const BRAND_JOINS: Array<[RegExp, string]> = [
  [/\bi\s*phone\b/gi, 'iphone'],
  [/\bapple\s+mobile\b/gi, 'apple'],
  [/\bone\s*plus\b/gi, 'oneplus'],
  [/\bred\s*mi\b/gi, 'redmi'],
  [/\breal\s*me\b/gi, 'realme'],
  [/\bsam\s*sung\b/gi, 'samsung'],
  [/\bnothing\s*phone\b/gi, 'nothing phone'],
  [/\bmoto\s*rola\b/gi, 'motorola'],
  [/\bgalaxy\s*m\b/gi, 'galaxy m'],
  [/\bmac\s*book\b/gi, 'macbook'],
  [/\bmagic\s*book\b/gi, 'magicbook'],
  [/\bb\s*t\s*w\b/gi, 'btw'],
];

export function normalizeBrandSpelling(t: string): string {
  let out = String(t || '');
  for (const [re, rep] of BRAND_JOINS) out = out.replace(re, rep);
  return out;
}

/**
 * Quantity units in one canonical spelling (owner 27 Oct, grocery comparison): the same
 * pack is written "1 l", "1 ltr", "1 litre" by different shops, and "1l" vs "1 ltr" was a
 * hard-token mismatch, so a Blinkit milk row never matched the query typed as "1 l".
 * Normalises litre/gram/pack synonyms BEFORE tokenising (both sides of every comparison).
 */
function canonicalQuantity(t: string): string {
  return String(t || '')
    // A charger is sold as "adapter" by Apple and as "charger" by everyone else.
    .replace(/\badapt(?:er|or)s?\b/gi, 'charger')
    // "Powerbank" and "power bank" are one product.
    .replace(/\bpower\s*bank\b/gi, 'power bank')
    .replace(/\bpack\s+of\s+(\d+)\b/gi, '$1 pack')
    .replace(/\b(ltrs?|litres?|liters?)\b/gi, 'l')
    .replace(/\b(gms?|grams?)\b/gi, 'g')
    .replace(/\b(kgs?|kilos?|kilograms?)\b/gi, 'kg')
    .replace(/\b(packs?|packets?|pk)\b/gi, 'pack');
}

function words(t: string): string[] {
  return canonicalQuantity(normalizeBrandSpelling(t)).toLowerCase().replace(/[()\[\],:;|]/g, ' ').replace(/(\d)\s*(gb|tb|mb|mah|inch|hz|w|mp|ml|g|kg|l|pack)\b/g, '$1$2').split(/[^a-z0-9.+]+/).filter(Boolean);
}

export function isAccessory(title: string): boolean {
  // Normalise punctuation first: "Fine Woven Wallet-A3323" and "5W-Charger" carry the
  // accessory word glued to a model code, and a naive " wallet " test missed them
  // (owner 27 Oct: a MagSafe wallet priced Rs.2,851 was shown as "the iPhone").
  const t = ` ${String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
  const hits = ACCESSORY_WORDS.filter((w) => t.includes(` ${w} `) || t.includes(` ${w}s `));
  if (hits.length === 0) return false;
  // Grocery packs are sold in a "pouch"/"packet": that is packaging, not an accessory, and
  // it silently blocked every grocery row ("Tata Salt, 1 kg Pouch"). Only packaging words
  // with a weight/volume in the same title are excused.
  const packagingOnly = hits.every((w) => w === 'pouch');
  const quantified = /\d+(?:\.\d+)?\s?(?:g|kg|ml|l|pack|ltr|litre)\b/i.test(title);
  if (packagingOnly && quantified) return false;
  return true;
}

/** Tokens that identify the exact product: numbers/capacities/model codes and brand/model words (not colours/filler). */
export function identityTokens(title: string): string[] {
  return Array.from(new Set(words(title).filter((w) => !STOP.has(w) && !COLORS.has(w) && w.length > 1)));
}

/** Storage-capacity tokens of a title in canonical GB units ("512 GB", "1TB" -> {512}, {1024}). */
export function capacitiesOf(title: string): Set<string> {
  const caps = new Set<string>();
  for (const m of String(title || '').matchAll(/\b(\d+(?:\.\d+)?)\s?(gb|tb)\b/gi)) {
    const n = parseFloat(m[1]) * (/^tb$/i.test(m[2]) ? 1024 : 1);
    if (n > 0) caps.add(String(n));
  }
  return caps;
}

/**
 * @param mode 'strict' (default) — the pasted/pinned product: a variant that cannot
 *   be proven identical is NOT this product (14 Oct 512-vs-256, tier rules).
 *   'typed' — the user typed a product NAME with no variant detail ("i phone 18"),
 *   so an unstated capacity/tier must not disqualify a listing (26 Oct bug:
 *   invocation always answered "Price unavailable"). Brand spellings are normalised
 *   in both modes.
 */
export function isSameProduct(pastedTitle: string, candidateTitle: string, mode: 'strict' | 'typed' = 'strict'): boolean {
  const wantsAccessory = isAccessory(pastedTitle);
  // Only the product part of the title decides "is this an accessory": Indian listings append
  // bundles ("... 128GB Storage) with Charger"), and a bundled charger must not disqualify
  // the phone itself.
  if (!wantsAccessory && isAccessory(accessoryScope(candidateTitle))) return false;
  // TYPE GATE (owner 27 Oct, "iphone search ne adapter dikhaya"): a listing that declares a
  // device type the user never asked for is a different product — a power bank, charger,
  // cable, case, earbuds or TV is never "the iPhone". Types stated BY the query are allowed.
  const wantTypes = declaredTypes(pastedTitle);
  const haveTypes = declaredTypes(candidateTitle);
  for (const t of haveTypes) if (!wantTypes.has(t)) return false;
  // Compatibility mentions ("... | iPhone - Android Mobiles | ...") are not identity: read
  // the candidate's tokens from its own product words only.
  const candidateIdentity = stripCompatibility(candidateTitle);
  // Capacity is part of the product's identity (the 14 Oct bug: a 512 GB link
  // compared 256 GB listings as "cheapest"). If EITHER side declares a storage
  // capacity, both must declare and they must match exactly — a candidate whose
  // variant cannot be verified is NOT this product (it stays in `related`).
  const wantCaps = capacitiesOf(pastedTitle);
  const haveCaps = capacitiesOf(candidateIdentity);
  // A TYPED name usually carries no capacity ("i phone 18"). Treating that as a
  // mismatch rejected every real listing and produced "Price unavailable"
  // (26 Oct bug). The rule now binds only when the QUERY states a capacity: then
  // the candidate must state the SAME one (the 14 Oct 512-vs-256 bug stays fixed).
  if (mode === 'typed' && !wantCaps.size) {
    // typed name, no capacity stated: any capacity is acceptable
  } else if (wantCaps.size || haveCaps.size) {
    if (!wantCaps.size || !haveCaps.size) return false;
    for (const c of wantCaps) if (!haveCaps.has(c)) return false;
  }
  const need = identityTokens(pastedTitle);
  if (need.length === 0) return false;
  const have = new Set(words(candidateIdentity));
  // A type word the QUERY states is satisfied by the candidate declaring the same type
  // ("laptop" vs "MacBook", "tv" vs "Smart LED TV") — synonyms must not read as mismatch.
  for (const t of wantTypes) if (haveTypes.has(t)) have.add(t);
  // Numeric/model tokens (iphone "17", "256gb", "s24") must ALL match, so iPhone 16 is never an iPhone 17.
  // Pack sizes are the exception (owner 27 Oct, grocery comparison): shops title the same pack
  // as "Tata Salt 1 kg", "Tata Salt 1000 g" or just "Tata Salt Crystal", so a stated weight or
  // volume must not veto an otherwise exact product match. Storage capacity (GB/TB) is still
  // strict via capacitiesOf above, so the 512-vs-256 GB rule is untouched.
  const isPackSize = (w: string) => /^\d+(?:\.\d+)?(?:g|kg|ml|l|pack)$/.test(w);
  const hard = need.filter((w) => /\d/.test(w) && !isPackSize(w));
  if (hard.some((w) => !have.has(w))) return false;
  const soft = need.filter((w) => !/\d/.test(w) || isPackSize(w));
  if (soft.length === 0) return hard.length > 0;
  // Tier words must match exactly both ways: no '17 Pro' when the user pasted '17', no 'Air' for 'Pro'.
  const tiersOf = (ws: string[]) => new Set(ws.filter((w) => TIERS.has(w)));
  const wantTiers = tiersOf(need);
  const haveTiers = tiersOf(words(candidateIdentity));
  // Tier rule binds only when the user STATED a tier in TYPED mode. A typed name
  // like "i phone 18" says nothing about Pro/Max, and demanding an exact tier
  // match there rejected every listing (26 Oct "Price unavailable"). Pasted links
  // stay strict both ways, so "17 Pro" never compares a plain "17" and vice versa.
  if (mode === 'typed' && !wantTiers.size) {
    // no tier stated: any tier is acceptable
  } else if (wantTiers.size !== haveTiers.size || [...wantTiers].some((t) => !haveTiers.has(t))) return false;
  const hit = soft.filter((w) => have.has(w)).length;
  if (hit / soft.length < 0.6) return false;
  // The leading word of a product query is its brand ("amul butter", "tata salt", "sony
  // wh-1000xm5"). A 60% word overlap let "amul butter 500 g" collect Sundrop/Myntra PEANUT
  // butter at the same weight, so the brand word is now required in typed mode.
  const lead = need.find((w) => !isPackSize(w) && !/\d/.test(w));
  if (mode === 'typed' && lead && !have.has(lead)) return false;
  return true;
}

/**
 * Relaxed identity check for the comparison page (owner 27 Oct): when no listing
 * matches every rule (e.g. the user typed "i phone 18" but sources only carry
 * "iPhone 18 Pro"), showing the closest real variants with their live prices beats
 * "Price unavailable". Rules kept strict: every numeric/model token must match and
 * at least one word token must match, so it can never show an unrelated product.
 * Never used to claim a "cheapest price" for the exact product — the route labels
 * these rows as closest variants.
 */
export function sharesIdentity(queryTitle: string, candidateTitle: string): boolean {
  if (isAccessory(accessoryScope(candidateTitle)) && !isAccessory(queryTitle)) return false;
  // Same type gate as isSameProduct: the closest-variant fallback must never surface a
  // different KIND of product (owner 27 Oct: adapter shown for an iPhone search).
  const wantTypes = declaredTypes(queryTitle);
  for (const t of declaredTypes(candidateTitle)) if (!wantTypes.has(t)) return false;
  const need = identityTokens(queryTitle);
  if (!need.length) return false;
  const have = new Set(words(stripCompatibility(candidateTitle)));
  const hard = need.filter((w) => /\d/.test(w));
  if (hard.length && hard.some((w) => !have.has(w))) return false;
  const soft = need.filter((w) => !/\d/.test(w));
  if (!soft.length) return hard.length > 0;
  return soft.some((w) => have.has(w));
}
