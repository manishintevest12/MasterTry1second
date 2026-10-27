/**
 * SPELLING TOLERANCE (owner 27 Oct: "spelling agar galat bhi hai tho uske closest search kar de").
 *
 * The product page and the search box must not answer "no results" for a typo like
 * "amul buter", "iphnoe 16", "blinkt milk" or "samsng galaxy". Before a product query
 * reaches the sources we repair the obviously misspelled WORD tokens against a
 * vocabulary of brands and everyday products, then search the corrected phrase.
 *
 * Rules (deliberately conservative — a wrong correction is worse than no correction):
 *  - only alphabetic tokens of 4+ characters are considered (model numbers, sizes
 *    like "16", "500g", "wh-1000xm5" are never touched);
 *  - a token that is already in the vocabulary is left alone;
 *  - edit distance must be 1 for short words and at most 2 for long ones, and the
 *    distance must be small relative to length (<= 1/3 of the word);
 *  - the closest vocabulary word must be unambiguous: a second-best candidate at the
 *    same distance cancels the correction.
 * The caller always keeps the user's original text in `searchedAs`/`originalQuery`,
 * so the UI can say "showing results for ..." honestly.
 */

/** Brands, categories and products people actually type on Try1Second. */
const VOCAB: string[] = [
  // retail brands
  'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'tatacliq', 'croma', 'reliance',
  'apple', 'iphone', 'ipad', 'macbook', 'airpods', 'samsung', 'galaxy', 'oneplus', 'oppo',
  'vivo', 'realme', 'redmi', 'xiaomi', 'poco', 'nothing', 'motorola', 'nokia', 'google', 'pixel',
  'sony', 'boat', 'noise', 'boult', 'jbl', 'bose', 'sennheiser', 'logitech', 'hp', 'dell',
  'lenovo', 'asus', 'acer', 'msi', 'toshiba', 'whirlpool', 'haier', 'godrej', 'voltas',
  'hitachi', 'panasonic', 'philips', 'havells', 'bajaj', 'prestige', 'pigeon', 'butterfly',
  'nike', 'adidas', 'puma', 'reebok', 'levis', 'zara', 'hm', 'decathlon', 'titan', 'fastrack',
  // grocery
  'amul', 'tata', 'maggi', 'nestle', 'britannia', 'parle', 'aashirvaad', 'atta', 'suji',
  'besan', 'dal', 'rice', 'basmati', 'sugar', 'salt', 'oil', 'ghee', 'butter', 'cheese',
  'paneer', 'curd', 'dahi', 'milk', 'taaza', 'toned', 'fullcream', 'cream', 'lassi', 'chaas',
  'bread', 'bun', 'pav', 'eggs', 'egg', 'noodles', 'pasta', 'sauce', 'ketchup', 'jam',
  'chocolate', 'biscuit', 'biscuits', 'cookies', 'chips', 'namkeen', 'bhujia', 'papad',
  'masala', 'haldi', 'turmeric', 'chilli', 'mirch', 'jeera', 'dhaniya', 'garam', 'tea',
  'coffee', 'juice', 'water', 'soda', 'coke', 'pepsi', 'sprite', 'thums', 'redbull',
  'detergent', 'surf', 'ariel', 'rin', 'harpic', 'lizol', 'colgate', 'pepsodent', 'dettol',
  'shampoo', 'soap', 'harpic', 'dove', 'lifebuoy', 'nivea', 'ponds', 'gillette',
  'potato', 'onion', 'tomato', 'banana', 'apple', 'mango', 'grapes', 'orange', 'lemon',
  'chicken', 'mutton', 'fish', 'prawns', 'paneer', 'soya', 'oats', 'cornflakes', 'honey',
  // grocery platforms
  'blinkit', 'zepto', 'instamart', 'swiggy', 'bigbasket', 'dunzo', 'jiomart', 'dmart',
  // categories
  'mobile', 'phone', 'laptop', 'tablet', 'headphones', 'earbuds', 'earphone', 'speaker',
  'charger', 'cable', 'powerbank', 'television', 'fridge', 'refrigerator', 'washing',
  'machine', 'microwave', 'mixer', 'grinder', 'cooler', 'fan', 'iron', 'trimmer', 'watch',
  'shoes', 'sandals', 'shirt', 'tshirt', 'jeans', 'kurta', 'saree', 'bag', 'wallet',
];

const VOCAB_SET = new Set(VOCAB);
const BY_LEN = new Map<number, string[]>();
for (const w of VOCAB) {
  const arr = BY_LEN.get(w.length) || [];
  arr.push(w);
  BY_LEN.set(w.length, arr);
}

/**
 * Damerau-Levenshtein (optimal string alignment), capped: a swapped pair counts as ONE
 * edit, because "slat"->"salt" and "iphnoe"->"iphone" are the typos people actually make.
 * Returns `cap + 1` as soon as the edit count cannot beat the cap.
 */
export function editDistance(a: string, b: string, cap = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) rows.push(new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, rows[i - 2][j - 2] + 1);
      }
      rows[i][j] = best;
      if (best < rowMin) rowMin = best;
    }
    if (rowMin > cap) return cap + 1;
  }
  return rows[a.length][b.length];
}

function maxDistanceFor(word: string): number {
  if (word.length <= 5) return 1;
  if (word.length <= 7) return 2;
  return 2;
}

/** Closest vocabulary word for a single token, or null when nothing is close enough. */
export function closestWord(token: string): string | null {
  const w = token.toLowerCase();
  if (w.length < 4 || VOCAB_SET.has(w)) return null;
  const cap = maxDistanceFor(w);
  let best: string | null = null;
  let bestDist = cap + 1;
  let tie = false;
  for (let len = w.length - cap; len <= w.length + cap; len++) {
    const bucket = BY_LEN.get(len);
    if (!bucket) continue;
    for (const cand of bucket) {
      // first letter and one interior letter must agree: "buter"->"butter" ok,
      // "buffer"->"butter" ok, "batter"->"butter" ok, "bottle"->"butter" not.
      const d = editDistance(w, cand, cap);
      if (d > cap) continue;
      if (d < bestDist) {
        bestDist = d;
        best = cand;
        tie = false;
      } else if (d === bestDist) {
        tie = true;
      }
    }
  }
  if (!best) return null;
  if (tie) return null;
  if (bestDist > cap) return null;
  if (bestDist / w.length > 1 / 3) return null;
  return best;
}

export interface SpellFix {
  /** Query to actually search with (same as input when nothing changed). */
  query: string;
  /** The text exactly as the user typed it. */
  original: string;
  /** True when at least one token was repaired. */
  corrected: boolean;
  /** Token-level repairs, for logging and the UI's "showing results for" line. */
  fixes: Array<{ from: string; to: string }>;
}

/**
 * Repairs misspelled word tokens in a product query. Pure and synchronous so it can run
 * on the request's critical path: a typo must never cost the user a search round-trip.
 */
export function fixSpelling(query: string): SpellFix {
  const original = String(query || '').trim();
  if (!original) return { query: original, original, corrected: false, fixes: [] };
  const fixes: Array<{ from: string; to: string }> = [];
  const out = original.split(/(\s+)/).map((chunk) => {
    if (!chunk.trim()) return chunk;
    // Keep punctuation and joined things ("wh-1000xm5", "500g", "2l") untouched.
    if (!/^[A-Za-z]{4,}$/.test(chunk)) return chunk;
    const fixed = closestWord(chunk);
    if (!fixed || fixed === chunk.toLowerCase()) return chunk;
    fixes.push({ from: chunk, to: fixed });
    return fixed;
  }).join('');
  if (!fixes.length) return { query: original, original, corrected: false, fixes: [] };
  return { query: out.replace(/\s+/g, ' ').trim(), original, corrected: true, fixes };
}
