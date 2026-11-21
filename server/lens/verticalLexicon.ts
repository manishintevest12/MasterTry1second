/**
 * Ask Try1Second AI — product/category lexicon (owner 28 Oct).
 *
 * Complaint: "aata sbse sasta kaha hai" came back as "I could not pin a single
 * category, so I am comparing it across every shopping site" (and searched the
 * literal string "aata sbse kaha"), and "biryani kaha sasta milega" did the same.
 * Aata (atta / flour) is a 10-minute GROCERY staple and biryani is a FOOD dish —
 * both have their own vertical in this product, so the assistant must route the
 * question there instead of dumping it on e-commerce.
 *
 * Two reasons it did not:
 *   1. The old hint regexes only knew the spelling "atta", so the everyday
 *      Hinglish "aata" (and dozens of other staples/dishes) never matched, and
 *      there was no FOOD list at all.
 *   2. The question words ("kaha", "kahan", "milega", "milegi"…) were never
 *      stripped, so the search box received the whole sentence and no source
 *      could answer it.
 *
 * This module is the single source of truth for that mapping, used by BOTH the
 * router (assistantIntent) and the answer layer (assistantAnswer) so the bubble
 * copy and the actual search can never disagree.
 */

export type CategoryVertical = 'grocery' | 'food';

/** 10-minute grocery staples: Hinglish + English spellings, brands, pack sizes. */
const GROCERY_TERMS = [
  // staples / grains / pulses
  'aata', 'atta', 'aattha', 'flour', 'maida', 'sooji', 'rava', 'besan', 'chawal', 'rice',
  'basmati', 'dal', 'daal', 'toor', 'arhar', 'moong', 'urad', 'chana', 'rajma', 'chole',
  'poha', 'suji', 'daliya', 'oats', 'cornflakes',
  // oils / dairy / eggs
  'tel', 'oil', 'sarson', 'mustard oil', 'refined oil', 'ghee', 'butter', 'makhan',
  'milk', 'doodh', 'curd', 'dahi', 'yogurt', 'paneer', 'cheese', 'cream', 'malai',
  'egg', 'eggs', 'anda', 'ande', 'chicken', 'mutton', 'fish', 'soya',
  // masala / condiments / sweeteners
  'masala', 'haldi', 'mirch', 'mirchi', 'jeera', 'dhania', 'garam masala', 'namak',
  'salt', 'cheeni', 'sugar', 'shakkar', 'gud', 'jaggery', 'honey', 'sauce', 'ketchup',
  'mayonnaise', 'vinegar', 'baking powder',
  // bakery / breakfast / snacks
  'bread', 'bun', 'pav', 'rusk', 'biscuit', 'cookies', 'namkeen', 'chips', 'maggi',
  'noodles', 'pasta', 'vermicelli', 'sevai', 'cereal', 'jam', 'peanut butter',
  // beverages
  'tea', 'chai', 'coffee', 'juice', 'cold drink', 'soft drink', 'water bottle',
  // household / personal care
  'soap', 'sabun', 'detergent', 'surf', 'shampoo', 'conditioner', 'toothpaste', 'toothbrush',
  'tissue', 'toilet cleaner', 'phenyl', 'harpic', 'lizol', 'handwash', 'sanitizer',
  'diaper', 'pads', 'razor', 'blade', 'bulb', 'battery', 'candle', 'matchbox',
  'mosquito', 'repellent', 'agarbatti', 'garbage bag', 'dishwash', 'vim',
  // produce
  'sabzi', 'sabji', 'vegetables', 'onion', 'pyaz', 'potato', 'aloo', 'tomato', 'tamatar',
  'ginger', 'adrak', 'garlic', 'lehsun', 'palak', 'spinach', 'gobhi', 'cabbage',
  'carrot', 'gajar', 'cucumber', 'kheera', 'capsicum', 'shimla mirch', 'fruit', 'fruits',
  'banana', 'kela', 'apple', 'seb', 'orange', 'santra', 'mango', 'aam', 'grapes', 'angur',
  'pomegranate', 'anar', 'papaya', 'watermelon', 'coconut', 'nariyal', 'lemon', 'nimbu',
  // brands people actually name
  'amul', 'nestle', 'britannia', 'parle', 'haldiram', 'tata salt', 'fortune', 'aashirvaad',
  'patanjali', 'dabur', 'colgate', 'dove', 'lifebuoy', 'colin', 'saffola', 'mdh', 'everest',
];

/** Dishes / cuisines / restaurant brands: these belong to the FOOD vertical. */
const FOOD_TERMS = [
  // dishes
  'biryani', 'briyani', 'biriyani', 'pulao', 'pizza', 'burger', 'momos', 'momo', 'dosa',
  'idli', 'vada', 'uttapam', 'samosa', 'kachori', 'chowmein', 'chow mein', 'hakka noodles',
  'manchurian', 'thali', 'curry', 'kebab', 'tikka', 'tandoori', 'roll', 'wrap', 'sandwich',
  'paratha', 'naan', 'roti', 'chaat', 'panipuri', 'golgappa', 'pav bhaji', 'vada pav',
  'butter chicken', 'dal makhani', 'paneer butter masala', 'fried rice', 'mutton curry',
  'cake', 'pastry', 'ice cream', 'dessert', 'sweets', 'mithai', 'gulab jamun', 'rasgulla',
  'cold coffee', 'milkshake', 'shake', 'smoothie', 'lassi', 'falooda',
  // OWNER 20 Nov: a cooked RICE dish is a dish, not a bag of grain. The lexicon only knew
  // 'fried rice', so 'curd rice', 'jeera rice', 'lemon rice', 'boiled rice' and 'sambar'
  // were priced as grocery staples (or, for sambar/rasam/upma, fell through to shopping).
  'curd rice', 'jeera rice', 'lemon rice', 'tamarind rice', 'boiled rice', 'steamed rice',
  'plain rice', 'veg rice', 'ghee rice', 'bisi bele bath', 'sambar', 'sambhar', 'rasam',
  'upma', 'uppuma', 'pongal', 'khichdi', 'khichadi', 'rajma chawal', 'dal chawal',
  'chole bhature', 'chana bhatura', 'aloo paratha', 'paneer paratha', 'parotta', 'parotta',
  'appam', 'puttu', 'shawarma', 'chicken 65', 'chilli chicken', 'chilli paneer',
  'misal pav', 'puri', 'dahi vada', 'medu vada', 'idli sambar', 'pav bhajji',
  'kheer', 'payasam', 'halwa', 'jalebi', 'kulfi', 'rasmalai', 'pakora', 'pakode', 'bhajji',
  // how people ask for restaurant food
  'restaurant', 'dhaba', 'cafe', 'menu', 'order food', 'food delivery', 'near me khana',
  'khana', 'lunch', 'dinner', 'breakfast', 'nashta', 'tiffin',
  // cuisines
  'chinese', 'south indian', 'north indian', 'mughlai', 'punjabi food', 'fast food',
  'street food', 'continental', 'italian food', 'mughlai food',
  // brands / apps
  'zomato', 'swiggy', 'dominos', 'domino', 'pizza hut', 'pizzahut', 'kfc', 'burger king',
  'mcdonald', 'subway', 'starbucks', 'barbeque nation', 'bikanervala', 'eatsure',
  'oven story', 'faasos', 'behrouz', 'third wave coffee',
];

/**
 * Every grocery/food noun this module knows, as a flat set. The place-repair pass in
 * questionNormalizer uses it: "basmati" is two edits from the town Baramati, so a
 * question about basmati rice was being rewritten to "Baramati rice" and priced as a
 * different product (owner 20 Nov: "ai ko samajhna chahiye user kya maang raha hai").
 */
const PRODUCT_WORDS = new Set<string>([
  ...GROCERY_TERMS.flatMap((t) => t.split(' ')),
  ...FOOD_TERMS.flatMap((t) => t.split(' ')),
]);

/** True when a single token is a grocery/food noun and must never be "repaired" into a place. */
export function isProductWord(token: string): boolean {
  const w = String(token || '').toLowerCase().replace(/[^a-z]/g, '');
  return w.length > 0 && PRODUCT_WORDS.has(w);
}

/**
 * Terms that live on BOTH shelves (owner 20 Nov).
 *
 * "dosa" came back from the grocery apps only, and "rice" only as raw grain, while the
 * same word also exists as a restaurant dish. A single-vertical answer is therefore a
 * wrong answer for these words: the assistant has to price both and say which is which.
 * The pair is only used to ADD the second shelf - detectCategoryVertical keeps deciding
 * the primary vertical, so every existing route stays exactly as it was.
 */
const DUAL_TERMS: Array<{ re: RegExp; primary: CategoryVertical; secondary: CategoryVertical }> = [
  { re: /(?:^|[^a-z])rice(?![a-z])/i, primary: 'grocery', secondary: 'food' },
  { re: /(?:^|[^a-z])chawal(?![a-z])/i, primary: 'grocery', secondary: 'food' },
  { re: /(?:^|[^a-z])poha(?![a-z])/i, primary: 'grocery', secondary: 'food' },
  { re: /(?:^|[^a-z])chicken(?![a-z])/i, primary: 'grocery', secondary: 'food' },
  { re: /(?:^|[^a-z])paneer(?![a-z])/i, primary: 'grocery', secondary: 'food' },
  { re: /(?:^|[^a-z])maggie?(?![a-z])/i, primary: 'grocery', secondary: 'food' },
  { re: /(?:^|[^a-z])dosa(?![a-z])/i, primary: 'food', secondary: 'grocery' },
  { re: /(?:^|[^a-z])idli(?![a-z])/i, primary: 'food', secondary: 'grocery' },
  { re: /(?:^|[^a-z])uttapam(?![a-z])/i, primary: 'food', secondary: 'grocery' },
  { re: /(?:^|[^a-z])parathas?(?![a-z])/i, primary: 'food', secondary: 'grocery' },
  { re: /(?:^|[^a-z])momos?(?![a-z])/i, primary: 'food', secondary: 'grocery' },
  { re: /(?:^|[^a-z])samosa(?![a-z])/i, primary: 'food', secondary: 'grocery' },
];

/** "raw rice" / "rice 5 kg" / "packet wala" / "basmati rice" is a shelf product, not a plate. */
const RAW_INTENT = /\b(raw|uncooked|un\s*cooked|kaccha|kacha|packet|pack|pouch|kilo|kg|kgs|gram|grams|gm|gms|atta|flour|brand)\b|\b\d+\s*(?:g|gm|gms|gram|grams|kg|kgs|ml|l|ltr|litre|liter|pcs|pieces?)\b/i;
/** A rice VARIETY is a bag of grain, never a plate: "basmati rice", "sona masoori rice". */
const RICE_VARIETY = /\b(basmati|sona\s*masoori|masoori|kolam|ponni|brown|red\s*rice|black\s*rice|mogra|pusa|idli\s*rice|rawa|broken\s*rice|mini\s*rice)\b/i;
/** "dosa batter" / "idli mix" is the packaged twin, so the grocery shelf is the answer. */
const BATTER_INTENT = /\b(batter|batter\s*only|mix|instant\s*mix|ready\s*mix|powder)\b/i;
/** "order" / "plate" / "hot" / "restaurant" is a dish, not a shelf product. */
const COOKED_INTENT = /\b(order|plate|hot|cooked|ready to eat|restaurant|cafe|dhaba|zomato|swiggy|delivery|tiffin|khana|nashta|lunch|dinner|breakfast|table)\b/i;

/**
 * The second vertical an ambiguous word must also be priced in, or null.
 * An explicit raw/cooked word settles it: "raw rice" is grocery only, "rice plate" is food only.
 */
export function dualCategoryFor(text: string): { primary: CategoryVertical; secondary: CategoryVertical } | null {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return null;
  if (RAW_INTENT.test(t) || COOKED_INTENT.test(t)) return null;
  if (RICE_VARIETY.test(t) || BATTER_INTENT.test(t)) return null;
  const primary = detectCategoryVertical(t);
  if (!primary) return null;
  for (const d of DUAL_TERMS) {
    if (!d.re.test(t)) continue;
    // A dish phrase ("curd rice", "chicken biryani") is unambiguous: the dish already won.
    if (d.primary !== primary) return null;
    return { primary: d.primary, secondary: d.secondary };
  }
  return null;
}

/** Question words that must never reach a search box. */
const QUESTION_NOISE =
  /\b(kaha|kahan|kahaan|kidhar|kaunse|kaunsi|konsa|konsi|kaunsa|which|where|milega|milegi|milta|milte|mile|milege|milegaa|available|aas\s*paas|near\s*me|nearby|sbse|sabse|sabsay|sasta|sasti|sastta|saste|cheapest|cheap|best|accha|behtar|bhav|bhaav|daam|dam|price|prices|rate|rates|kitne|kitna|kitni|kya|kaun|please|pls|plz|karna|karu|kare|karo|kar\s*do|kar|batao|bata\s*do|bata|bataye|dikhao|dikha\s*do|chahiye|chahie|hai|hain|hoga|hogi|ka|ki|ke|ko|me|mein|mai|se|tak|par|pe|is|are|the|of|for|a|an|i|want|need|looking|find|search|compare|check|what|how|much|does|cost|kaunse|par\s+mil|online|order|buy|kharidna|kharido|khareed|dukan|dukaan|store|stores|shop|shops|muje|mujhe|mujhko|mujko|mera|meri|mere|mai|main|hum|humko|hamko|apna|apni|apne|yaar|bhai|bro)\b/gi;

/** Destination apps/brands: naming them does not change WHAT to search for. */
const PLATFORM = /\b(zomato|swiggy|blinkit|zepto|instamart|bigbasket|bb\s*now|flipkart\s*minutes|dunzo|jiomart|amazon|flipkart|shopsy|digihaat|digi\s*haat|myntra|ajio|tatacliq|tata\s*cliq)\b/gi;

/** Everyday transliterations that sources index under the standard spelling. */
const SPELLING: Record<string, string> = {
  aata: 'atta', aattha: 'atta', ata: 'atta', chawal: 'rice', doodh: 'milk',
  sabun: 'soap', cheeni: 'sugar', namak: 'salt', tel: 'oil', dahi: 'curd',
  briyani: 'biryani', biriyani: 'biryani', momo: 'momos',
};

function toTermRegex(terms: string[]): RegExp {
  // Longest first so "pav bhaji" is not eaten by "pav" and "butter chicken" by "butter".
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
  return new RegExp(`(?:^|[^a-z])((?:${escaped.join('|')}))(?![a-z])`, 'i');
}

const GROCERY_RE = toTermRegex(GROCERY_TERMS);
const FOOD_RE = toTermRegex(FOOD_TERMS);
const QUANTITY_RE = /\b\d+\s*(?:g|gm|gms|gram|grams|kg|kgs|ml|l|ltr|litre|liter|pack|packet|pcs|piece|dozen)\b/i;

/**
 * Which grocery/food vertical (if any) a question belongs to.
 * A dish or restaurant brand always wins: "chicken biryani" is food, while
 * "chicken 500g" (raw, with a pack size) stays grocery.
 */
export function detectCategoryVertical(text: string): CategoryVertical | null {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return null;
  // "dosa batter" / "idli mix" / "sambar powder" is a packaged product even though the word
  // in front of it is a dish: the grocery shelf is the only place that can price it.
  if (BATTER_INTENT.test(t)) return 'grocery';
  const food = FOOD_RE.test(t);
  const grocery = GROCERY_RE.test(t);
  if (food && !grocery) return 'food';
  if (food && grocery) {
    // Both matched: a dish/brand means the user wants it cooked and delivered,
    // unless they explicitly asked for a pack size of a raw staple.
    if (QUANTITY_RE.test(t) && !/\b(restaurant|cafe|dhaba|zomato|swiggy|menu|order)\b/i.test(t)) {
      return 'grocery';
    }
    return 'food';
  }
  if (grocery) {
    // "order rice", "rice plate", "hot chicken" is a dish even though the noun is a staple:
    // the user named the cooked version, so the restaurant apps are the ones that can price it.
    if (COOKED_INTENT.test(t) && /(?:^|[^a-z])(rice|chawal|poha|chicken|paneer|maggi|noodles)(?![a-z])/i.test(t)) {
      return 'food';
    }
    return 'grocery';
  }
  return null;
}

/** Strip the question wrapper: "aata sbse sasta kaha hai" -> "aata". */
export function cleanCategoryQuery(raw: string): string {
  const cleaned = String(raw || '')
    .replace(QUESTION_NOISE, ' ')
    .replace(PLATFORM, ' ')
    .replace(/[?!.,;:"']+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ').filter(Boolean).map((w) => SPELLING[w.toLowerCase()] || w);
  return words.join(' ').trim();
}

/** True when the text names something only a category vertical can price. */
export function isCategoryQuestion(text: string): boolean {
  return detectCategoryVertical(text) !== null;
}
