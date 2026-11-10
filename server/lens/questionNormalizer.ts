/**
 * Ask Try1Second — QUESTION NORMALIZER (owner 10 Nov: "ask try1second ai ko bilkul advanced ai bnao
 * jiss pr kissi v tarike se baat kre tho exact 100% correct results laye").
 *
 * Measured before writing this (24 real phrasings): only 13 routed correctly. The failures were not
 * random, they were four specific shapes:
 *   1. Devanagari — "इंदौर से भोपाल बस कल", "दिल्ली से मुंबई फ्लाइट का किराया", "बस इंदौर भोपाल" (5 cases)
 *      all returned vertical=null because every keyword list is Latin-only.
 *   2. Typos — "hotal in indor", "flite delhi mumbai" returned null; a person typing fast on a phone
 *      keyboard makes exactly this error and got "I could not tell which category that is".
 *   3. Budget phrasing hijacked routing — "goa hotel 2 nights under 3000" routed to E-COMMERCE because
 *      the number/under pair read like shopping, even though the word "hotel" was right there.
 *   4. Bare product + price — "iphone 15 price" returned null instead of shopping.
 *
 * The normalizer is deterministic and offline (no LLM): it transliterates the domain vocabulary,
 * repairs one-edit typos, extracts budget/date/city side-information, and only then hands a clean Latin
 * question to the existing intent parser. Nothing here invents a price; it only decides WHERE to look,
 * and the answer still comes from the live pipeline under the 'No Price, No Card' rule.
 */

import { INDIAN_CITIES } from '../seo/cityCorpus';
import { translateIndic, type IndicScript } from './indicLexicon';

/** Devanagari vocabulary the site actually answers. Cities come first because a question is mostly place. */
const DEVA_TO_LATIN: Record<string, string> = {
  // verticals / nouns
  'फ्लाइट': 'flight', 'फ्लाइट्स': 'flights', 'उड़ान': 'flight', 'हवाई': 'flight', 'एयरलाइंस': 'airline',
  'बस': 'bus', 'बसें': 'bus', 'होटल': 'hotel', 'होटल्स': 'hotels', 'कमरा': 'room', 'रूम': 'room',
  'टिकट': 'ticket', 'टिकटें': 'tickets', 'मूवी': 'movie', 'फिल्म': 'movie', 'सिनेमा': 'cinema', 'शो': 'show',
  'कैब': 'cab', 'टैक्सी': 'taxi', 'ऑटो': 'auto', 'कार': 'car',
  'लोन': 'loan', 'ऋण': 'loan', 'ब्याज': 'interest', 'ईएमआई': 'emi',
  'बीमा': 'insurance', 'इंश्योरेंस': 'insurance', 'पॉलिसी': 'policy',
  'क्रेडिट': 'credit', 'कार्ड': 'card', 'डेबिट': 'debit',
  'टर्म': 'term', 'अकाउंट': 'account', 'खाता': 'account', 'बैंक': 'bank', 'बचत': 'savings', 'एफडी': 'fd',
  'ग्रॉसरी': 'grocery', 'किराना': 'grocery', 'दूध': 'milk', 'आटा': 'flour', 'चावल': 'rice',
  'खाना': 'food', 'भोजन': 'food', 'बिरयानी': 'biryani', 'पिज्जा': 'pizza', 'बर्गर': 'burger',
  'प्रोडक्ट': 'product', 'मोबाइल': 'mobile', 'फोन': 'phone', 'लैपटॉप': 'laptop', 'टीवी': 'tv',
  'सस्ता': 'sasta', 'सस्ते': 'sasta', 'सस्ती': 'sasta', 'महंगा': 'mehnga',
  'कितना': 'kitna', 'कितने': 'kitne', 'कितनी': 'kitni', 'क्या': 'kya', 'कहां': 'kaha', 'कहाँ': 'kaha',
  'कौन': 'kaun', 'कौनसा': 'kaunsa', 'चाहिए': 'chahiye', 'चाहिये': 'chahiye', 'बताओ': 'batao',
  'बताइए': 'bataiye', 'दिखाओ': 'dikhao', 'ढूंढो': 'dhundo', 'खोजो': 'dhundo', 'तुलना': 'compare',
  'मुझे': 'mujhe', 'मेरा': 'mera', 'मेरी': 'meri', 'हमें': 'hume',
  'का': 'ka', 'की': 'ki', 'के': 'ke', 'को': 'ko', 'से': 'se', 'तक': 'tak', 'में': 'me', 'मे': 'me',
  'पर': 'par', 'और': 'aur', 'या': 'ya', 'है': 'hai', 'हैं': 'hain', 'था': 'tha', 'होगा': 'hoga',
  'किराया': 'kiraya', 'भाड़ा': 'bhada', 'रेट': 'rate', 'दाम': 'daam', 'कीमत': 'keemat', 'प्राइस': 'price',
  'कल': 'kal', 'परसों': 'parso', 'आज': 'aaj', 'अभी': 'abhi', 'अगले': 'agle', 'अगली': 'agli', 'हफ्ते': 'hafte',
  'रात': 'raat', 'दिन': 'din', 'रातें': 'raat', 'बजे': 'baje', 'लिए': 'liye', 'लिये': 'liye',
  'वाला': 'wala', 'वाले': 'wale', 'सबसे': 'sabse', 'बेस्ट': 'best', 'अच्छा': 'accha', 'नजदीक': 'nazdeek',
  'पास': 'paas', 'एयरपोर्ट': 'airport', 'स्टेशन': 'station', 'थाना': 'thana',
  // brand names, because a question about a product almost always names one
  'आईफोन': 'iphone', 'सैमसंग': 'samsung', 'वनप्लस': 'oneplus', 'रेडमी': 'redmi', 'रियलमी': 'realme',
  'ओप्पो': 'oppo', 'वीवो': 'vivo', 'शाओमी': 'xiaomi', 'सोनी': 'sony', 'बोट': 'boat',
  'अमेज़न': 'amazon', 'फ्लिपकार्ट': 'flipkart', 'मिंत्रा': 'myntra', 'अजियो': 'ajio', 'मीशो': 'meesho',
  'बिगबास्केट': 'bigbasket', 'ब्लिंकिट': 'blinkit', 'जेप्टो': 'zepto', 'इंस्टामार्ट': 'instamart',
  'स्विगी': 'swiggy', 'जोमैटो': 'zomato', 'डोमिनोज': 'dominos', 'हल्दीराम': 'haldiram',
  'बुकमायशो': 'bookmyshow', 'पीवीआर': 'pvr', 'इनॉक्स': 'inox', 'ओयो': 'oyo',
  'मेकमायट्रिप': 'makemytrip', 'गोइबिबो': 'goibibo', 'क्लियरट्रिप': 'cleartrip', 'यात्रा': 'yatra',
  'उबर': 'uber', 'ओला': 'ola', 'रैपिडो': 'rapido', 'इंडिगो': 'indigo', 'एयरइंडिया': 'air india',
  'एचडीएफसी': 'hdfc', 'आईसीआईसीआई': 'icici', 'एसबीआई': 'sbi', 'एक्सिस': 'axis', 'कोटक': 'kotak',
  'बजाज': 'bajaj', 'टाटा': 'tata', 'लाइसेंस': 'licence', 'एलआईसी': 'lic',
  // cities / places people actually type in Hindi
  'दिल्ली': 'Delhi', 'मुंबई': 'Mumbai', 'इंदौर': 'Indore', 'भोपाल': 'Bhopal', 'गोवा': 'Goa',
  'पुणे': 'Pune', 'जयपुर': 'Jaipur', 'लखनऊ': 'Lucknow', 'चेन्नई': 'Chennai', 'कोलकाता': 'Kolkata',
  'बेंगलुरु': 'Bangalore', 'बैंगलोर': 'Bangalore', 'हैदराबाद': 'Hyderabad', 'अहमदाबाद': 'Ahmedabad',
  'सूरत': 'Surat', 'नागपुर': 'Nagpur', 'उज्जैन': 'Ujjain', 'जबलपुर': 'Jabalpur', 'पटना': 'Patna',
  'कानपुर': 'Kanpur', 'लुधियाना': 'Ludhiana', 'आगरा': 'Agra', 'वाराणसी': 'Varanasi', 'ठाणे': 'Thane',
  'नोएडा': 'Noida', 'गुरुग्राम': 'Gurugram', 'गुड़गांव': 'Gurugram', 'फरीदाबाद': 'Faridabad',
  'गाजियाबाद': 'Ghaziabad', 'दुबई': 'Dubai', 'देहरादून': 'Dehradun', 'रायपुर': 'Raipur',
  'रांची': 'Ranchi', 'भुवनेश्वर': 'Bhubaneswar', 'गुवाहाटी': 'Guwahati', 'कोच्चि': 'Kochi',
  'कोयंबटूर': 'Coimbatore', 'मदुरै': 'Madurai', 'विशाखापत्तनम': 'Visakhapatnam',
  'औरंगाबाद': 'Aurangabad', 'नासिक': 'Nashik', 'वडोदरा': 'Vadodara', 'राजकोट': 'Rajkot',
  'जोधपुर': 'Jodhpur', 'उदयपुर': 'Udaipur', 'कोटा': 'Kota', 'अजमेर': 'Ajmer', 'ग्वालियर': 'Gwalior',
  'बैंकॉक': 'Bangkok', 'सिंगापुर': 'Singapore', 'लंदन': 'London', 'न्यूयॉर्क': 'New York',
  'श्रीनगर': 'Srinagar', 'जम्मू': 'Jammu', 'अमृतसर': 'Amritsar', 'चंडीगढ़': 'Chandigarh',
  'हरिद्वार': 'Haridwar', 'ऋषिकेश': 'Rishikesh', 'मसूरी': 'Mussoorie', 'शिमला': 'Shimla',
  'मनाली': 'Manali', 'धर्मशाला': 'Dharamshala', 'तिरुपति': 'Tirupati',
};

const DEVA_RE = /[\u0900-\u097F]/;

/** Vertical keyword vocabulary used for typo repair and as a fallback when the parser returns nothing. */
const VERTICAL_WORDS: { vertical: string; words: string[] }[] = [
  { vertical: 'flights', words: ['flight', 'flights', 'airfare', 'airline', 'airlines', 'plane', 'fly', 'flightticket', 'flite', 'fligth', 'flght', 'fligths'] },
  { vertical: 'hotels', words: ['hotel', 'hotels', 'room', 'rooms', 'stay', 'resort', 'oyo', 'homestay', 'guesthouse', 'hotal', 'hotell', 'hotles'] },
  { vertical: 'bus', words: ['bus', 'buses', 'busticket', 'volvo', 'sleeper', 'seater', 'buss'] },
  { vertical: 'cab', words: ['cab', 'cabs', 'taxi', 'uber', 'ola', 'rapido', 'auto', 'airporttransfer', 'taxii', 'cabss'] },
  { vertical: 'movies', words: ['movie', 'movies', 'cinema', 'pvr', 'inox', 'showtime', 'show', 'ticket', 'bookmyshow'] },
  { vertical: 'grocery', words: ['grocery', 'groceries', 'kirana', 'milk', 'atta', 'flour', 'rice', 'dal', 'blinkit', 'zepto', 'instamart', 'bigbasket', 'dmart'] },
  { vertical: 'food', words: ['food', 'biryani', 'pizza', 'burger', 'swiggy', 'zomato', 'restaurant', 'thali', 'dosa', 'chicken', 'paneer'] },
  { vertical: 'loans', words: ['loan', 'loans', 'emi', 'interest', 'carloan', 'homeloan', 'personalloan', 'creditline'] },
  { vertical: 'insurance', words: ['insurance', 'policy', 'termplan', 'premium', 'cover', 'healthinsurance', 'carinsurance', 'bikeinsurance'] },
  { vertical: 'creditcards', words: ['creditcard', 'card', 'cards', 'rewardcard', 'cashbackcard', 'rupay'] },
  { vertical: 'account', words: ['account', 'savings', 'currentaccount', 'zerobalance', 'fd', 'fixeddeposit', 'rd', 'recurringdeposit', 'nri'] },
  // Only CATEGORY nouns here, never brand names: "boat airdopes" or "sony wh-1000xm5" name a product but
  // not a category, so they must keep going through the honest assumed-shopping path (assumedVertical: true).
  { vertical: 'ecommerce', words: ['cosmetic', 'cosmetics', 'makeup', 'make-up', 'beauty', 'skincare', 'skin', 'lipstick', 'kajal', 'eyeliner', 'foundation', 'compact', 'sunscreen', 'serum', 'shampoo', 'conditioner', 'facewash', 'bodywash', 'moisturizer', 'moisturiser', 'perfume', 'deodorant', 'nailpolish', 'nail', 'haircare', 'grooming', 'trimmer', 'mobile', 'phone', 'smartphone', 'laptop', 'tablet', 'tv', 'television', 'fridge', 'refrigerator', 'washingmachine', 'geyser', 'cooler', 'shoes', 'shirt', 'tshirt', 'jeans', 'kurta', 'saree', 'cosmetics', 'perfume', 'headphones', 'earbuds', 'airpods', 'watch', 'smartwatch', 'camera', 'product'] },
];

/** Phrases that carry a budget, not a category: they must never decide the vertical. */
const JUNK_PHRASES = /\b(kam\s*price|kam\s*rate|kam\s*rate\s*me|low\s*price|range\s*available|available\s*range|items\s*for\s*range|price\s*range|within\s*range|rate\s*list|detail\s*chahiye)\b/gi;
const BUDGET_RE = /(?:under|below|less\s+than|upto|up\s+to|within|max|maximum|budget\s*of|se\s+kam|ke\s+andar|ke\s+nice|tak\s+ka)\s*(?:rs\.?|₹|inr)?\s*([\d,]{1,9})(k\b)?/i;

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Curated typo map, not a generic Levenshtein pass against the category vocabulary: a generic pass
 * "repaired" real words into wrong ones (pressure cooker -> pressure cooler, iphone -> phone), which is a
 * confident wrong answer. Only misspellings seen in real questions are listed here.
 */
const TYPO_MAP: Record<string, string> = {
  hotal: 'hotel', hotell: 'hotel', hotles: 'hotel', hoel: 'hotel', hotle: 'hotel',
  flite: 'flight', fligth: 'flight', flght: 'flight', fligths: 'flight', fligts: 'flight',
  buss: 'bus', bxus: 'bus', busticket: 'bus ticket',
  cabss: 'cab', taxi_: 'taxi', txi: 'taxi',
  muvie: 'movie', moive: 'movie', movi: 'movie', mvies: 'movies',
  grocerry: 'grocery', grocry: 'grocery', grosery: 'grocery',
  insurnce: 'insurance', insuranc: 'insurance', insurence: 'insurance',
  lona: 'loan', laon: 'loan',
  creidt: 'credit', crad: 'card',
  acount: 'account', accont: 'account',
  chennai_: 'chennai', banglore: 'bangalore', bengaluru_: 'bengaluru', hydrabad: 'hyderabad',
  mumbi: 'mumbai', delhii: 'delhi', indor: 'indore', bhopl: 'bhopal', jaipur_: 'jaipur',
  chandigrah: 'chandigarh', kolkatta: 'kolkata', ahmedbad: 'ahmedabad', lucknow_: 'lucknow',
};

/** Repair one token from the curated typo map (case preserved). */
function repairWord(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  const hit = TYPO_MAP[w];
  if (!hit) return word;
  return word.replace(new RegExp(word.replace(/[^A-Za-z0-9]/g, ''), 'i'), hit);
}

/**
 * Domains this site does NOT compare. Saying so is the right answer; routing "metro card recharge" to
 * credit cards (which the word "card" used to do) is a confident wrong answer, the worst kind.
 */
const UNSUPPORTED: { label: string; re: RegExp }[] = [
  { label: 'train tickets (IRCTC)', re: /\b(train|trains|irctc|railway|rail\s?ticket)\b/i },
  { label: 'metro cards', re: /\bmetro\s*(card|recharge|pass)?\b/i },
  { label: 'mobile or DTH recharge', re: /\b(recharge|dth|prepaid\s+plan|postpaid\s+plan)\b/i },
  { label: 'utility bills', re: /\b(electricity|water|gas|broadband|wifi)\s*bill\b/i },
  { label: 'LPG cylinder booking', re: /\b(lpg|gas\s*cylinder|cylinder)\b/i },
  { label: 'toll or FASTag', re: /\b(fastag|toll)\b/i },
];

/**
 * City repair. A person types "indor", "mumai", "banglore"; the merchant search needs the real name or it
 * returns nothing. Places come from cityCorpus (525 real places) plus the international cities flights serve.
 */
const EXTRA_PLACES = ['Dubai', 'Bangkok', 'Singapore', 'London', 'New York', 'Abu Dhabi', 'Doha', 'Kathmandu', 'Colombo', 'Male', 'Sharjah', 'Muscat', 'Riyadh', 'Jeddah', 'Toronto', 'Sydney', 'Melbourne', 'Tokyo', 'Bali', 'Phuket'];
let placeMap: Map<string, string> | null = null;
function places(): Map<string, string> {
  if (placeMap) return placeMap;
  const m = new Map<string, string>();
  const add = (name: string) => { const k = name.toLowerCase(); if (k.length >= 4 && !m.has(k)) m.set(k, name); };
  try {
    for (const c of INDIAN_CITIES as { name: string }[]) add(c.name);
  } catch { /* corpus unavailable: the international list still works */ }
  for (const pl of EXTRA_PLACES) add(pl);
  placeMap = m;
  return m;
}

/**
 * Words that are never a city even when one edit away: "kahan" is one edit from Nahan (Himachal) and
 * "karna" from Karnal (Haryana). Without this guard a question like "kahan milega sabse sasta doodh" was
 * rewritten to search milk in Nahan.
 */
const NOT_A_PLACE = new Set([
  'kahan', 'kaha', 'kitna', 'kitne', 'kitni', 'kaun', 'kaunsa', 'kya', 'sasta', 'saste', 'sasti',
  'sabse', 'milega', 'milegi', 'milta', 'milte', 'chahiye', 'chahie', 'batao', 'bata', 'dikhao', 'dikha',
  'dhundo', 'compare', 'today', 'tomorrow', 'tonight', 'kal', 'aaj', 'parso', 'agle', 'next', 'best',
  'cheapest', 'cheaper', 'price', 'prices', 'rate', 'rates', 'fare', 'fares', 'under', 'below', 'above',
  'near', 'from', 'with', 'without', 'me', 'se', 'tak', 'aur', 'hai', 'hain', 'hoga', 'wala', 'wale',
  'ticket', 'tickets', 'flight', 'flights', 'hotel', 'hotels', 'bus', 'buses', 'cab', 'cabs', 'taxi',
  'movie', 'movies', 'loan', 'loans', 'insurance', 'policy', 'card', 'cards', 'credit', 'debit',
  'account', 'savings', 'grocery', 'groceries', 'food', 'product', 'amul', 'atta', 'aata', 'chawal',
  'dal', 'biryani', 'chicken', 'paneer', 'doodh', 'milk', 'pizza', 'burger', 'thali', 'dosa', 'rice',
  'flour', 'iphone', 'samsung', 'mobile', 'phone', 'laptop', 'shoes', 'shirt', 'watch', 'earbuds',
  'karna', 'karni', 'karne', 'karke', 'karo', 'kare', 'kar', 'lena', 'leni', 'dena', 'deni', 'jaana',
  'jana', 'aana', 'ana', 'chalo', 'chal', 'dekhna', 'dekh', 'dekhni', 'batana', 'bataye', 'puchna',
  'poochna', 'bhejo', 'bhej', 'order', 'orders', 'book', 'booking', 'buy', 'sell', 'khareed', 'khareedna',
  'kharidna', 'khana', 'khane', 'peena', 'peene', 'jaldi', 'abhi', 'baad', 'pehle', 'sahi', 'theek',
  'accha', 'acha', 'bhai', 'bro', 'please', 'pls', 'thanks', 'sir', 'madam', 'kuch', 'koi', 'bhi',
  'nahi', 'nai', 'haan', 'hmm', 'kab', 'kaise', 'kyu', 'kyun', 'kyon', 'jitna', 'utna', 'itna', 'sirf',
  'only', 'also', 'and', 'or', 'but', 'my', 'your', 'our', 'this', 'that', 'mujhe', 'hume', 'mera',
  'meri', 'apna', 'apni', 'dijiye', 'kijiye', 'chaiye', 'chahta', 'chahti', 'chahte', 'lagta',
  'mile', 'mil', 'paisa', 'paise', 'rupees', 'rupaye', 'thousand', 'hazar', 'hazaar', 'lakh', 'crore',
  'cosmetic', 'cosmetics', 'makeup', 'beauty', 'skincare', 'lipstick', 'perfume', 'shampoo', 'cream',
]);

/** Every real place named in the text, canonicalised ("indor" -> "Indore"). */
export function findPlaces(text: string): string[] {
  const found: string[] = [];
  for (const token of String(text || '').split(/\s+/)) {
    const raw = token.replace(/[^A-Za-z]/g, '');
    if (raw.length < 4) continue;
    const known = places().get(raw.toLowerCase());
    if (known && !found.includes(known)) found.push(known);
  }
  return found;
}

/** Repair one token against the place list; a real place name is returned unchanged. */
export function repairPlace(token: string): string {
  const raw = token.replace(/[^A-Za-z]/g, '');
  if (raw.length < 4) return token;
  const lowerRaw = raw.toLowerCase();
  if (NOT_A_PLACE.has(lowerRaw)) return token;
  const known = places().get(lowerRaw);
  if (known) return token.replace(raw, known);
  const tol = raw.length >= 7 ? 2 : raw.length >= 5 ? 1 : 0;
  if (!tol) return token;
  for (const [key, canonical] of places()) {
    if (Math.abs(key.length - raw.length) > tol) continue;
    if (key[0] !== lowerRaw[0]) continue;
    if (levenshtein(lowerRaw, key) <= tol) return token.replace(raw, canonical);
  }
  return token;
}

export interface NormalizedQuestion {
  /** Latin, filler-free question handed to the intent parser. */
  text: string;
  /** The question as typed (kept for the reply / debugging). */
  original: string;
  /** True when Devanagari was transliterated, so the reply can say the question was read in Hindi. */
  transliterated: boolean;
  /** Budget found in the question (rupees), when the user said "under 3000". */
  budget?: number;
  /** Vertical detected by keyword/typo repair, used as a fallback by the intent parser. */
  keywordVertical?: string;
  /** Which Indian language the question arrived in, when it was not plain Latin. */
  language?: IndicScript | 'hindi';
  /** Words repaired by the typo pass, for transparency in the answer meta. */
  repaired: string[];
  /** "Delhi to Mumbai" when the question names two places in a row and no explicit "to/se" was used. */
  routeHint?: string;
  /** Named when the question is about something this site does not compare. */
  unsupported?: string;
}

/** Transliterate Devanagari domain vocabulary word by word; unknown words are kept as-is. */
export function transliterateHindi(text: string): { text: string; changed: boolean } {
  if (!DEVA_RE.test(text)) return { text, changed: false };
  let changed = false;
  const out = String(text).split(/(\s+)/).map((chunk) => {
    if (!DEVA_RE.test(chunk)) return chunk;
    // Strip Devanagari danda and punctuation but keep the word edge.
    const lead = (chunk.match(/^[^\u0900-\u097F]+/) || [''])[0];
    const tail = (chunk.match(/[^\u0900-\u097F]+$/) || [''])[0];
    const core = chunk.slice(lead.length, chunk.length - tail.length);
    const hit = DEVA_TO_LATIN[core];
    if (hit) { changed = true; return lead + hit + tail; }
    return chunk;
  }).join('');
  return { text: out, changed };
}

/**
 * Normalise any phrasing of a question into a Latin, parseable one. Pure and deterministic.
 */
export function normalizeAssistantQuestion(raw: string): NormalizedQuestion {
  const original = String(raw || '').trim().slice(0, 300);
  // Indian languages first (Bengali/Tamil/Telugu/Kannada/Malayalam/Gujarati/Punjabi/Odia/Urdu + romanised),
  // then Devanagari (Hindi/Marathi). Both land on the same Latin vocabulary the engine already speaks.
  const indic = translateIndic(original);
  const hindi = transliterateHindi(indic.text);
  const language: IndicScript | 'hindi' | undefined = indic.script || (hindi.changed ? 'hindi' : undefined);
  let text = hindi.text;
  // Words the lexicon could not map (inflected city forms like "சென்னையிலிருந்து", Urdu suffixes) would be
  // sent to merchant sites verbatim and match nothing. Drop the unmapped native characters instead: the
  // mapped part of the word survives ("Chennai"), which is what a merchant can answer.
  text = text.replace(/[\u0900-\u0DFF\u0600-\u06FF]+/g, ' ');

  // Budget first, so "under 3000" can never be read as a category hint.
  let budget: number | undefined;
  const bm = text.match(BUDGET_RE);
  if (bm) {
    const digits = Number(bm[1].replace(/,/g, ''));
    // "under 2k" is a budget; a bare single digit ("under 5") is not, so it is left in the text.
    if (Number.isFinite(digits) && digits > 0 && (bm[2] || String(bm[1]).replace(/,/g, '').length >= 2)) {
      budget = bm[2] ? digits * 1000 : digits;
    }
    text = text.replace(BUDGET_RE, ' ');
  }

  // Junk phrasing that carries no meaning for a search box ('kam price', 'range available').
  text = text.replace(JUNK_PHRASES, ' ');

  // Currency symbols alone never help a query string.
  text = text.replace(/[₹]/g, ' ').replace(/\brs\.?\b/gi, ' ');

  // Typo repair on the whole phrase, word by word (keeps punctuation/spacing).
  const repaired: string[] = [];
  text = text.split(/(\s+)/).map((chunk) => {
    if (!chunk.trim()) return chunk;
    const fixed = repairWord(chunk);
    if (fixed !== chunk) repaired.push(`${chunk}->${fixed}`);
    return fixed;
  }).join('');

  // Place names after vertical typos, in the same pass (a city typo is the most common search-killer).
  text = text.split(/(\s+)/).map((chunk) => {
    if (!chunk.trim()) return chunk;
    const fixed = repairPlace(chunk);
    if (fixed !== chunk) repaired.push(`${chunk}->${fixed}`);
    return fixed;
  }).join('');

  // Two real places side by side with no "to"/"se" ("delhi mumbai", "इंदौर भोपाल") is a route question.
  let routeHint: string | undefined;
  const tokens = text.split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = places().get(tokens[i].replace(/[^A-Za-z]/g, '').toLowerCase());
    const b = places().get(tokens[i + 1].replace(/[^A-Za-z]/g, '').toLowerCase());
    if (a && b && a !== b) { routeHint = `${a} to ${b}`; break; }
  }

  // Keyword vertical: the strongest signal in the sentence, used only as a fallback.
  const lower = text.toLowerCase();
  let keywordVertical: string | undefined;
  for (const group of VERTICAL_WORDS) {
    if (group.words.some((w) => new RegExp(`(^|\\s)${w}(s|es)?(\\s|$)`, 'i').test(lower))) { keywordVertical = group.vertical; break; }
  }

  const unsupported = UNSUPPORTED.find((u) => u.re.test(text))?.label;
  return { text: text.replace(/\s+/g, ' ').trim(), original, transliterated: hindi.changed || indic.changed, ...(language ? { language } : {}), budget, keywordVertical, repaired, ...(routeHint ? { routeHint } : {}), ...(unsupported ? { unsupported } : {}) };
}
