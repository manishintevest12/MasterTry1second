/**
 * QueryUnderstanding (Section 6): vertical detection, entity/intent extraction,
 * location/date/party/configuration extraction. Rule-based core — runs with zero
 * external dependencies. Gemini MAY assist when configured; AI output is used only
 * for classification/extraction, never to invent prices or source responses
 * (Section 10), and every AI candidate must pass deterministic validation.
 */
import type { ParsedQuery, VerticalId } from '../types';
import { ALL_VERTICALS } from '../types';
import { settings } from '../common/settings';

const VERTICAL_KEYWORDS: Record<VerticalId, string[]> = {
  food: ['pizza', 'biryani', 'order food', 'swiggy', 'zomato', 'restaurant', 'dosa', 'burger', 'meal', 'thali', 'combo', 'sandwich', 'pasta'],
  grocery: ['grocery', 'milk', 'atta', 'vegetable', 'fruit', 'zepto', 'blinkit', 'instamart', 'insta mart', 'quick commerce', 'paneer', 'curd', 'bread', 'egg', 'rice', 'dal', 'oil', 'ghee', 'maggi', 'chips', 'cold drink', 'snacks', 'detergent', 'shampoo', 'soap'],
  ecommerce: ['buy', 'price of', 'under', 'shopping', 'amazon', 'flipkart', 'myntra', 'laptop', 'phone', 'mobile', 'headphone', 'earbud', 'tv', 'watch', 'shoe', 'shirt', 'camera', 'speaker', 'power bank', 'tablet'],
  flights: ['flight', 'flights', 'air ticket', 'fly to', 'delhi to mumbai', 'airline', 'indigo', 'air india', 'airfare', 'plane'],
  hotels: ['hotel', 'hotels', 'stay in', 'resort', 'room in', 'check in', 'accommodation', 'oyo', 'night stay'],
  cab: ['cab', 'taxi', 'uber', 'ola', 'rapido', 'ride to', 'auto', 'drop to', 'pick up', 'pickup and drop'],
  loans: ['loan', 'personal loan', 'home loan', 'car loan', 'credit line', 'borrow', 'lender', 'interest rate', 'emi'],
  insurance: ['insurance', 'policy', 'premium', 'term plan', 'health cover', 'bike insurance', 'car insurance', 'insurer'],
  movies: ['movie', 'cinema', 'pvr', 'showtime', 'show', 'ticket for', 'film', 'concert', 'event', 'bookmyshow'],
  bus: ['bus', 'buses', 'volvo', 'redbus', 'sleeper bus', 'bus ticket', 'bus to'],
  coupons: ['coupon', 'coupons', 'promo code', 'voucher', 'discount code', 'offer code', 'cashback offer', 'deal'],
  giftcards: ['gift card', 'gift cards', 'giftcard', 'voucher card', 'gift voucher'],
  banking: ['credit card', 'debit card', 'card offer', 'bank offer', 'hdfc offer', 'sbi offer', 'axis offer', 'icici offer', 'no cost emi', 'card discount'],
};

const PINCODE_RE = /\b(\d{6})\b/;

const MAJOR_CITIES = [
  'delhi', 'mumbai', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'kolkata', 'pune',
  'ahmedabad', 'jaipur', 'lucknow', 'goa', 'noida', 'gurgaon', 'gurugram', 'indore', 'chandigarh',
];

const STOPWORDS = new Set(['price', 'best', 'cheap', 'cheapest', 'compare', 'comparison', 'for', 'in', 'the', 'a', 'an', 'of', 'to', 'near', 'me', 'under', 'buy', 'order', 'book', 'find', 'show', 'on', 'and', 'with', 'under', 'rs', 'rupees', 'today', 'now', 'deals', 'deal', 'offer', 'offers']);

function detectVertical(q: string): { vertical: VerticalId | null; confidence: number } {
  const lower = ` ${q.toLowerCase()} `;
  const scores: Array<{ v: VerticalId; s: number }> = [];
  for (const v of ALL_VERTICALS) {
    let s = 0;
    for (const kw of VERTICAL_KEYWORDS[v]) {
      if (lower.includes(` ${kw}`)) s += kw.split(' ').length;
    }
    if (s > 0) scores.push({ v, s });
  }
  scores.sort((a, b) => b.s - a.s);
  if (scores.length === 0) return { vertical: null, confidence: 0 };
  const top = scores[0];
  const second = scores[1];
  const conf = second ? Math.min(0.9, 0.5 + 0.2 * (top.s - second.s)) : 0.85;
  return { vertical: top.v, confidence: conf };
}

function extractEntity(q: string): string | null {
  const cleaned = q
    .replace(/\b(under|below|less than)\s*₹?\s*\d+(\s*k)?\b/gi, '')
    .replace(/₹\s*\d+(\.\d+)?/g, '')
    .replace(/\bfrom\s+(amazon|flipkart|blinkit|zepto|swiggy|zomato|amazon)\b/gi, '')
    .trim();
  const tokens = cleaned.split(/\s+/).filter((t) => t && !STOPWORDS.has(t.toLowerCase()));
  return tokens.length > 0 ? tokens.join(' ').slice(0, 160) : null;
}

function extractLocation(q: string): ParsedQuery['location'] {
  const loc: ParsedQuery['location'] = {};
  const pin = q.match(PINCODE_RE);
  if (pin) loc.pincode = pin[1];
  const lower = q.toLowerCase();
  const city = MAJOR_CITIES.find((c) => lower.includes(c));
  if (city) loc.city = city === 'bengaluru' ? 'Bengaluru' : city.charAt(0).toUpperCase() + city.slice(1);
  return loc;
}

function extractDates(q: string): ParsedQuery['travelDates'] | undefined {
  const dateMatch = q.match(/\b(20\d{2}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/);
  const tomorrow = /\b(tomorrow|today|tonight)\b/i.test(q);
  if (!dateMatch && !tomorrow) return undefined;
  if (tomorrow) return { depart: /today|tonight/i.test(q) ? new Date().toISOString().slice(0, 10) : new Date(Date.now() + 86400000).toISOString().slice(0, 10) };
  return { depart: dateMatch?.[1] };
}

function extractParties(q: string): ParsedQuery['parties'] | undefined {
  const pax = q.match(/\b(\d+)\s*(?:passengers?|pax|guests?|people|adults?|seats?)\b/i);
  if (!pax) return undefined;
  const n = Number(pax[1]);
  if (/\b(passenger|pax)\b/i.test(q)) return { passengers: n };
  return { guests: n };
}

function extractConfiguration(q: string): Record<string, string> | undefined {
  const cfg: Record<string, string> = {};
  const storage = q.match(/\b(\d+)\s*(?:gb|tb)\b/i);
  if (storage) cfg['storage'] = storage[0];
  const color = q.match(/\b(black|white|blue|red|green|gold|silver|grey|gray|graphite|midnight)\b/i);
  if (color) cfg['color'] = color[1];
  const size = q.match(/\b(xl|xxl|large|medium|small|size \d+)\b/i);
  if (size) cfg['size'] = size[1];
  const room = q.match(/\b(deluxe|luxury|suite|standard|ac room|non-ac)\b/i);
  if (room) cfg['room_type'] = room[1];
  const seat = q.match(/\b(sleeper|seater|semi-sleeper|window seat)\b/i);
  if (seat) cfg['seat_type'] = seat[1];
  return Object.keys(cfg).length > 0 ? cfg : undefined;
}

function detectIntent(q: string): ParsedQuery['intent'] {
  const lower = q.toLowerCase();
  if (/\b(compare|vs\.?|versus|difference between)\b/.test(lower)) return 'compare';
  if (/\b(book|reserve|ticket)\b/.test(lower)) return 'book';
  if (/\b(buy|order|purchase)\b/.test(lower)) return 'buy';
  if (/\b(review|rating|worth it|should i)\b/.test(lower)) return 'research';
  return 'browse';
}

/** Rule-based understanding — the deterministic core, no network needed. */
export function understandQuery(rawQuery: string, provided?: Partial<ParsedQuery['location']>): ParsedQuery {
  const { vertical, confidence } = detectVertical(rawQuery);
  const loc = { ...extractLocation(rawQuery), ...provided };
  return {
    rawQuery,
    vertical,
    verticalConfidence: confidence,
    entityName: extractEntity(rawQuery),
    intent: detectIntent(rawQuery),
    location: loc,
    travelDates: extractDates(rawQuery),
    parties: extractParties(rawQuery),
    configuration: extractConfiguration(rawQuery),
  };
}

/**
 * Optional AI assist (Section 10): Gemini refines classification/attribute extraction when
 * configured. Output is advisory only — it must pass deterministic validation, and any
 * AI-suggested price/stock/source field is discarded (never trusted, never stored).
 */
export async function aiAssistedUnderstanding(query: ParsedQuery): Promise<ParsedQuery> {
  if (!settings.aiAssistEnabled || !settings.geminiApiKey) return query;
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });
    const prompt = `Classify this Indian shopping/travel search query. Return strict JSON only:
{"vertical":"one of food|grocery|ecommerce|flights|hotels|cab|loans|insurance|movies|bus|coupons|giftcards|banking","entity":"product/service name","city":"city if mentioned","pincode":"6-digit pincode if mentioned","dates":{"depart":"YYYY-MM-DD if mentioned"},"attributes":{"key":"value only for explicit configuration mentions"}}
Rules: Do NOT include prices, stock, or availability. Do NOT guess unstated fields.
Query: ${query.rawQuery}`;
    const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    const text = res.text || '';
    const json = JSON.parse(text.replace(/```json|```/g, '').trim());
    const refined: ParsedQuery = { ...query };
    if (json.vertical && ALL_VERTICALS.includes(json.vertical)) refined.vertical = json.vertical;
    if (json.entity) refined.entityName = String(json.entity).slice(0, 160);
    if (json.city && !query.location.city) refined.location = { ...query.location, city: String(json.city) };
    if (json.pincode && /^\d{6}$/.test(String(json.pincode))) refined.location = { ...query.location, pincode: String(json.pincode) };
    if (json.dates?.depart && /^\d{4}-\d{2}-\d{2}$/.test(json.dates.depart)) refined.travelDates = { ...query.travelDates, depart: json.dates.depart };
    if (json.attributes && typeof json.attributes === 'object') {
      refined.configuration = { ...(query.configuration || {}) };
      for (const [k, v] of Object.entries(json.attributes)) {
        if (typeof v === 'string' && !/price|stock|availab/i.test(k)) refined.configuration![k.toLowerCase()] = v.slice(0, 60);
      }
    }
    return refined;
  } catch {
    // AI unavailable → deterministic core result stands (never a failure for search)
    return query;
  }
}
