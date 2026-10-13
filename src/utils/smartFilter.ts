/**
 * Smart Filter: natural-language (English + Hindi/Hinglish) prompt → structured
 * filter, applied client-side against real live results. No fabrication —
 * an empty match set is shown honestly to the user.
 */

export interface ParsedSmartFilter {
  raw: string;
  maxPrice?: number;
  minPrice?: number;
  minRating?: number;
  tokens: string[];
  veg?: boolean;
  nonVeg?: boolean;
  freeCancellation?: boolean;
  breakfast?: boolean;
  direct?: boolean;
  express?: boolean;
  sortHint?: 'cheapest' | 'highest_rated';
}

const STOP_WORDS = new Set([
  'under', 'below', 'less', 'than', 'max', 'maximum', 'upto', 'up', 'to', 'above', 'over', 'more',
  'between', 'and', 'se', 'kam', 'sasta', 'sekm', 'sabse', 'show', 'me', 'only', 'with', 'ke',
  'saath', 'kar', 'karo', 'de', 'do', 'dikhao', 'find', 'give', 'want', 'need', 'for', 'the',
  'a', 'an', 'in', 'of', 'rs', 'inr', 'rupees', 'rupee', 'price', 'budget', 'around', 'about',
  'star', 'stars', 'rating', 'rated', 'minimum', 'least', 'lowest', 'highest', 'best', 'top',
  'cheapest', 'cheap', 'sasta', 'accha', 'achha', 'bestrated', 'deals', 'deal', 'options',
]);

/** "5k" → 5000, "25,000" → 25000, "₹499" → 499, "1.5 lakh" → 150000 */
function toNumber(raw: string): number | null {
  const s = raw.toLowerCase().replace(/[₹,\s]/g, '');
  if (!s) return null;
  const lakh = s.match(/^([\d.]+)\s*(lakh|lac)$/);
  if (lakh) return Math.round(parseFloat(lakh[1]) * 100000);
  const k = s.match(/^([\d.]+)\s*k$/);
  if (k) return Math.round(parseFloat(k[1]) * 1000);
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s));
  return null;
}

export function parseSmartFilter(prompt: string): ParsedSmartFilter {
  const raw = prompt;
  const p = ' ' + prompt.toLowerCase().replace(/[₹]/g, ' rs ') + ' ';

  const f: ParsedSmartFilter = { raw, tokens: [] };

  // ---- price: "under X", "X se kam", "below X", "max X" ----
  const under = p.match(
    /(?:under|below|less than|max|maximum|upto|up to|within)\s*(?:rs\.?\s*)?([0-9][0-9,.]*\s*(?:k|lakh|lac)?)|([0-9][0-9,.]*\s*(?:k|lakh|lac)?)\s*(?:se kam|se sasta|or less|s se kam)/
  );
  if (under) {
    const n = toNumber(under[1] || under[2]);
    if (n) f.maxPrice = n;
  }

  // ---- price: "above X", "over X", "min X" ----
  const above = p.match(/(?:above|over|more than|min|minimum|at least)\s*(?:rs\.?\s*)?([0-9][0-9,.]*\s*(?:k|lakh|lac)?)/);
  if (above) {
    const n = toNumber(above[1]);
    if (n) f.minPrice = n;
  }

  // ---- price: "between X and Y" ----
  const between = p.match(/between\s*(?:rs\.?\s*)?([0-9][0-9,.]*)\s*(?:and|to|-)\s*(?:rs\.?\s*)?([0-9][0-9,.]*)/);
  if (between) {
    const a = toNumber(between[1]);
    const b = toNumber(between[2]);
    if (a && b) {
      f.minPrice = Math.min(a, b);
      f.maxPrice = Math.max(a, b);
    }
  }

  // ---- rating: "4+ star", "4.5 star and above", "rating 4+", "4 star se upar" ----
  const rating = p.match(/([0-4](?:\.\d)?)\s*\+?\s*(?:star|rating|stars)\b|rating\s*(?:above|of|min|minimum)?\s*([0-4](?:\.\d)?)/);
  if (rating) {
    const n = parseFloat(rating[1] || rating[2]);
    if (!isNaN(n)) f.minRating = n;
  }

  // ---- sort hints ----
  if (/(sabse sasta|cheapest|lowest price|sabse kam|price low|budget first|sasta)/.test(p)) f.sortHint = 'cheapest';
  else if (/(top rated|best rated|highest rated|sabse accha|sabse achha|highest rating)/.test(p)) f.sortHint = 'highest_rated';

  // ---- flags ----
  if (/(free cancellation|refundable|free cancel|cancellation free)/.test(p)) f.freeCancellation = true;
  if (/(breakfast|nashta|nashte|meal included|bfast)/.test(p)) f.breakfast = true;
  if (/(non.?stop|direct flight|nonstop|seedha flight)/.test(p)) f.direct = true;
  if (/(express|fastest|quickest|jaldi|10.?min|quick delivery)/.test(p)) f.express = true;
  if (/(non.?veg|nonveg|chicken|mutton|egg|meat|fish)/.test(p)) f.nonVeg = true;
  if (/(^|[^n])\bveg(etarian)?\b|pure veg|vegitable|sabzi/.test(p.replace(/non.?veg/g, 'nonveg'))) f.veg = true;

  // ---- content tokens (brands, product words) ----
  const tokenSource = prompt
    .replace(/(?:rs\.?|₹)\s*[0-9][0-9,.]*\s*(?:k|lakh|lac)?/gi, ' ')
    .replace(/[0-9][0-9,.]*\s*(?:k|lakh|lac)?/gi, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ');
  const tokens = tokenSource
    .split(/\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t) && !STOP_WORDS.has(t.replace(/(es|s)$/, '')));
  f.tokens = Array.from(new Set(tokens)).slice(0, 6);

  return f;
}

function itemText(item: any): string {
  return [
    item.title,
    item.subtitle,
    item.category,
    item.provider,
    item.description,
    ...(item.features || []),
    ...Object.values(item.specs || {}),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Apply the parsed filter to a live item. Returns true when the item passes. */
export function matchSmartFilter(item: any, f: ParsedSmartFilter): boolean {
  const text = itemText(item);

  if (f.maxPrice != null && (item.primaryPrice == null || item.primaryPrice > f.maxPrice)) return false;
  if (f.minPrice != null && (item.primaryPrice == null || item.primaryPrice < f.minPrice)) return false;
  if (f.minRating != null && !(item.rating >= f.minRating)) return false;

  if (f.veg && !f.nonVeg) {
    const isVeg =
      item.specs?.veg === 'true' ||
      item.specs?.veg === 'veg' ||
      item.specs?.['food type']?.toLowerCase().includes('veg');
    if (isVeg != null && isVeg === false) return false;
    if (!isVeg && !/\bveg(etarian)?\b/.test(text)) return false;
    if (/\b(non.?veg|chicken|mutton|egg|fish|meat|beef|pork)\b/.test(text) && !/\b(with )?veg\b/.test(text)) {
      // a "veg" filter on a chicken biryani card must fail
      return false;
    }
  }

  if (f.freeCancellation && !/(free cancellation|refundable|free cancel)/.test(text)) return false;
  if (f.breakfast && !/(breakfast|nashta|meal included)/.test(text)) return false;
  if (f.direct && !/(non.?stop|direct flight|nonstop)/.test(text)) return false;
  if (f.express && !/(express|10.?min|fast|quick|jaldi|instant)/.test(text)) return false;

  if (f.tokens.length) {
    const matches = f.tokens.filter((t) => text.includes(t)).length;
    if (matches === 0) return false;
  }

  return true;
}
