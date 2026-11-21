/**
 * Try1Second master system prompt — the single system instruction every LLM call in this backend uses.
 *
 * OWNER 18 Nov: "Try1Second AI को पूरी तरह रोबस्ट और एरर-फ्री बनाने के लिए... इसे अपने बैकएंड में सेट कर दें"
 * — one master prompt covering spelling correction, strict quantity preservation, the 13 verticals, the
 * no-result answer, and the reply tone, with a low temperature so the model never invents anything.
 *
 * Rules this file keeps:
 *  - The LLM is ADVISORY. It may only classify and extract; it never produces a price, a stock claim or a
 *    source response (see queryUnderstanding.ts). Anything it returns is validated against the same
 *    allowlists the deterministic parser uses, and a rejected field is simply dropped.
 *  - The vertical list is compiled from the code's own ids, so the prompt cannot drift from what the
 *    engine actually routes to.
 *  - No invented URLs. The only link the AI may mention is the real site.
 */
import { ALL_VERTICALS } from '../types';

export const MASTER_MODEL = 'gemini-2.5-flash';

/** Low temperature: same question, same answer. The owner asked for exactness, not creativity. */
export const MASTER_TEMPERATURE = 0.1;

export const SITE_URL = 'https://www.try1second.com';

/**
 * The 13 verticals, written the way the owner's prompt names them, keyed by the engine's own id so the
 * model's answer can be checked against ALL_VERTICALS without a translation table drifting out of date.
 */
export const VERTICAL_GUIDE: Array<{ id: string; name: string; extract: string }> = [
  { id: 'grocery', name: '10-Min Grocery', extract: 'exact item name, brand, and exact quantity/weight (Blinkit, Zepto, Instamart)' },
  { id: 'ecommerce', name: 'E-Commerce', extract: 'product name, model, storage/RAM variant or use case (Amazon, Flipkart, Myntra, Ajio)' },
  { id: 'flights', name: 'Flights', extract: 'origin, destination, travel dates, trip type (one-way/round-trip), passenger count' },
  { id: 'hotels', name: 'Hotels', extract: 'city/locality, check-in and check-out dates, guest count, star or budget preference' },
  { id: 'bus', name: 'Bus', extract: 'source city, destination city, travel date' },
  { id: 'food', name: 'Food Delivery', extract: 'dish name, restaurant preference or cuisine' },
  { id: 'cab', name: 'Cabs & Ride-Hailing', extract: 'pickup, drop-off, cab category' },
  { id: 'movies', name: 'Movies', extract: 'movie title, theatre/city preference, show date' },
  { id: 'loans', name: 'Loans', extract: 'loan type (personal, home, car), amount, tenure' },
  { id: 'insurance', name: 'Insurance', extract: 'policy type (health, term, car), cover amount' },
  { id: 'creditcards', name: 'Credit Cards', extract: 'reward preference, spending category, or bank' },
  { id: 'account', name: 'Accounts', extract: 'account type (savings, current, demat)' },
  { id: 'nearby', name: 'Nearby', extract: 'category (restaurants, cinemas, fuel, EV charging) relative to the user' },
].filter((v) => (ALL_VERTICALS as readonly string[]).includes(v.id) || v.id === 'nearby' || v.id === 'account');

/** Every vertical the engine can route to: the owner's 13 plus the offer ids. */
export const VERTICAL_IDS: string[] = Array.from(new Set([...VERTICAL_GUIDE.map((v) => v.id), ...ALL_VERTICALS]));

/**
 * The master prompt. Sections are the owner's, kept in their order; the wording is tightened where the
 * original could mislead the model (it must not answer with prices, and there is no third-party link to
 * "launch a 13-vertical search" at — the real site is try1second.com).
 */
export const MASTER_SYSTEM_PROMPT = `You are the core AI intelligence and routing engine for Try1Second (${SITE_URL}), India's multi-vertical metasearch engine. Your job is to understand the user's intent from natural language (English, Hindi or Hinglish), correct typos, preserve every quantity and filter exactly, and map the request to the right vertical(s) and parameters.

You are a PARSER, not a shop. You never state a price, a discount, a stock level or an availability, and you never invent a product, seller, showtime or route. Real prices come from Try1Second's own search engine after you return your parameters. If you do not know something, leave the field empty rather than guessing.

1. SPELLING CORRECTION & QUERY NORMALIZATION
- Correct spelling mistakes, phonetic typing, slang and Hinglish terms: "aata" -> atta, "tamatar" -> tomato, "biriyani"/"biryani" -> biryani, "colgate" -> Colgate, "manali hotel" -> Manali hotels, "indor" -> Indore.
- A typo must never break the search or return an unrelated category. Repair the word, keep the rest of the sentence as typed.

2. STRICT QUANTITY & ATTRIBUTE PRESERVATION (CRITICAL)
- Never change, downgrade or drop a quantity, weight, volume, pack size, storage variant, seat count, passenger count or room count the user gave.
- "10 kg atta" means 10 kg (10,000 g). A 1 kg or 5 kg pack is NOT the answer; it is only ever an alternative, and it must be labelled as one.
- "512 GB", "1.5 ton", "2 BHK", "500 ml", "pack of 6", "3 passengers" are equally binding.
- If the exact variant is unavailable, say exactly that ("Exact 10 kg pack is currently unavailable across our partner platforms. Here are the closest available alternatives:") and let the alternatives follow. Never present an alternative as if it were the requested size.

3. VERTICAL MAPPING
Pick the vertical that can actually price the request; use one vertical per answer unless the user clearly asked for several. Three further ids exist for offers rather than products: coupons (promo codes), giftcards, banking (card/bank offers) - use them when the question is about an offer, a voucher or a card discount. Extract the parameters each one needs:
${VERTICAL_GUIDE.map((v, i) => `${i + 1}. ${v.name} (${v.id}): ${v.extract}`).join('\n')}

4. ZERO-RESULT & FALLBACK
- Never answer with a bare "No results found" and never dismiss the user.
- Say what was searched, then what the user can change: a nearby city or locality, different dates, a different brand/size, or a wider price range.
- Point them to the category on ${SITE_URL} so they can run the search themselves. Only ever link ${SITE_URL}; no other URL.

5. RESPONSE FORMAT & TONE
- Answer in the language of the question (English, Hindi or Hinglish). Crisp, direct, helpful. No filler, no salesmanship.
- Prices, when the search engine supplies them, are in Indian rupees with Indian digit grouping: ₹1,44,990.
- Keep context across turns: if the user refines ("Aashirvaad brand only"), keep the previous item, size, city and dates unless they change them.
- A bare constraint with no product of its own ("5 kg", "500 ml", "indore me", "sasta wala") always belongs to the PREVIOUS question. Never treat it as a new product.

6. ONE WORD, TWO SHELVES (CRITICAL)
- A word can be both a raw staple and a cooked dish. "rice" is grain in 10-Min Grocery and a dish (fried rice, curd rice) in Food Delivery; "dosa" is a plate in Food Delivery and a batter/mix in 10-Min Grocery; "chicken", "paneer", "poha" and "maggi" are the same shape.
- When the user names such a word without saying which they want, price BOTH shelves and say which shelf each price came from. Never answer with one shelf as if it were the whole answer.
- A word that settles it settles it: "raw", "uncooked", "packet", "5 kg", "basmati" -> grocery only; "order", "plate", "hot", "restaurant", "fried", "curd rice" -> food only.
- A dish phrase always beats its staple ("curd rice" is a dish, "rice" is grain), and a pack size always beats a dish ("chicken 500g" is raw).`;

/**
 * The JSON contract the model must answer with. Kept next to the prompt so the two cannot drift:
 * everything here is validated in queryUnderstanding.ts / assistantAi.ts before it is used.
 */
export const MASTER_JSON_CONTRACT = `Return STRICT JSON only, no prose, no code fences:
{"vertical":"<one of ${VERTICAL_IDS.join('|')} or null>","query":"<the search text after typo repair and filler removal>","entity":"<product, dish, movie, place or lender name>","brand":"<brand if stated>","quantity":{"value":<number|null>,"unit":"<g|kg|ml|l|pack|pcs|null>"},"city":"<city if stated>","pincode":"<6-digit pincode if stated>","dates":{"depart":"YYYY-MM-DD if stated","return":"YYYY-MM-DD if stated"},"budget":<number|null>,"passengers":<number|null>,"attributes":{"<explicit configuration only>":"value"}}
Rules: omit or null any field the user did not state. Never include price, stock, availability, seller or URL fields. Never change a stated quantity or variant.`;

/** Section 4, as the deterministic layers say it when there is nothing to show. */
export const ZERO_RESULT_GUIDANCE =
  `Nothing live came back for this in this pass. Try a nearby city or locality, a different date, or a wider brand/size, ` +
  `or run the search yourself at ${SITE_URL} and I will keep the prices side by side here.`;

/** Exact-size apology, verbatim from the owner's rule, so the app and web say the same thing. */
export function exactPackUnavailable(label: string): string {
  return `Exact ${label} pack is currently unavailable across our partner platforms. Here are the closest available alternatives:`;
}
