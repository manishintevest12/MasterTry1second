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
];

const STOP = new Set(['the', 'and', 'with', 'for', 'new', 'latest', 'combo', 'pack', 'of', 'in', 'by', 'free', 'a', 'an', 'online', 'buy', 'best', 'price']);

/** Variant-tier words: '17' vs '17 Pro' are DIFFERENT products; the pasted title's tiers must match exactly. */
const TIERS = new Set(['pro', 'max', 'plus', 'mini', 'ultra', 'lite', 'prime', 'air']);

const COLORS = new Set(['black', 'white', 'blue', 'red', 'green', 'silver', 'gold', 'grey', 'gray', 'pink', 'purple', 'titanium', 'natural', 'midnight', 'starlight', 'yellow', 'orange', 'teal', 'ultramarine', 'lavender']);

function words(t: string): string[] {
  return t.toLowerCase().replace(/[()\[\],:;|]/g, ' ').replace(/(\d)\s*(gb|tb|mb|mah|inch|hz|w|mp|ml|g|kg|l)\b/g, '$1$2').split(/[^a-z0-9.+]+/).filter(Boolean);
}

export function isAccessory(title: string): boolean {
  const t = ` ${title.toLowerCase()} `;
  return ACCESSORY_WORDS.some((w) => t.includes(` ${w} `) || t.includes(` ${w}s `));
}

/** Tokens that identify the exact product: numbers/capacities/model codes and brand/model words (not colours/filler). */
export function identityTokens(title: string): string[] {
  return Array.from(new Set(words(title).filter((w) => !STOP.has(w) && !COLORS.has(w) && w.length > 1)));
}

export function isSameProduct(pastedTitle: string, candidateTitle: string): boolean {
  const wantsAccessory = isAccessory(pastedTitle);
  if (!wantsAccessory && isAccessory(candidateTitle)) return false;
  const need = identityTokens(pastedTitle);
  if (need.length === 0) return false;
  const have = new Set(words(candidateTitle));
  // Numeric/model tokens (iphone "17", "256gb", "s24") must ALL match, so iPhone 16 is never an iPhone 17.
  const hard = need.filter((w) => /\d/.test(w));
  if (hard.some((w) => !have.has(w))) return false;
  const soft = need.filter((w) => !/\d/.test(w));
  if (soft.length === 0) return hard.length > 0;
  // Tier words must match exactly both ways: no '17 Pro' when the user pasted '17', no 'Air' for 'Pro'.
  const tiersOf = (ws: string[]) => new Set(ws.filter((w) => TIERS.has(w)));
  const wantTiers = tiersOf(need);
  const haveTiers = tiersOf(words(candidateTitle));
  if (wantTiers.size !== haveTiers.size || [...wantTiers].some((t) => !haveTiers.has(t))) return false;
  const hit = soft.filter((w) => have.has(w)).length;
  return hit / soft.length >= 0.6;
}
