/**
 * Home-page AI assistant: turns a typed or spoken question into WHICH vertical to open and
 * WHAT to search there. It only routes — every price still comes from the real search pipeline.
 * Rule-based and deterministic (Hinglish-friendly); works with zero external services.
 */
import { understandQuery } from '../query/queryUnderstanding';
import { cleanCategoryQuery, detectCategoryVertical } from './verticalLexicon';
import { findPlaces, normalizeAssistantQuestion } from './questionNormalizer';

// OWNER 28 Oct: the assistant must cover EVERY vertical the app ships, not just
// the travel/shopping ones. 'creditcards' and 'account' were missing, so a credit
// card or bank-account question came back as "I could not tell which category".
export type AssistantVertical = 'flights' | 'hotels' | 'bus' | 'ecommerce' | 'grocery' | 'food' | 'movies' | 'loans' | 'insurance' | 'cab' | 'creditcards' | 'account';

export interface AssistantIntent {
  understood: boolean;
  vertical: AssistantVertical | null;
  query: string;                    // what to put in that vertical's search box
  date?: string;                    // YYYY-MM-DD when the user said "kal", "tomorrow", "15 november"...
  budget?: number;                  // rupees, when the question said "under 3000" / "3000 se kam"
  assumed?: boolean;                // shopping was chosen because a product was named, not a category
  normalized?: { transliterated: boolean; repaired: string[] }; // what was repaired, for transparency
  reply: string;                    // short human sentence shown in the chat bubble
}

const LABEL: Record<AssistantVertical, string> = {
  flights: 'Flights', hotels: 'Hotels', bus: 'Bus', ecommerce: 'E-Commerce', grocery: 'Grocery',
  food: 'Food', movies: 'Movies', loans: 'Loans', insurance: 'Insurance', cab: 'Cab',
  creditcards: 'Credit Cards', account: 'Bank Accounts',
};

// Hinglish / filler words that never belong in a search box.
const FILLER = /\b(batao|bata\s*do|bataiye|dikhao|dikha\s*do|dikhaiye|dhundo|dhoondo|chahiye|chahie|kitna|kitne|kya|hai|hain|ka|ki|ke|ko|me|mein|mai|se|tak|ka\s*rate|rate|rates|price|prices|fare|fares|kimat|keemat|please|pls|show|tell|me|find|search|check|what|is|are|the|of|for|a|an|i|want|need|looking|cheapest|sasta|sabse|best|flight|flights|airfare|ticket|tickets|bus|buses|hotel|hotels|cab|taxi)\b/gi;

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function parseSpokenDate(text: string, now = new Date()): string | undefined {
  const t = text.toLowerCase();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const add = (n: number) => { const d = new Date(base); d.setDate(d.getDate() + n); return isoDate(d); };
  if (/\b(parso|day after tomorrow)\b/.test(t)) return add(2);
  if (/\b(kal|tomorrow|tmrw)\b/.test(t)) return add(1);
  if (/\b(aaj|today|tonight)\b/.test(t)) return add(0);
  const m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
  if (m) {
    const day = Number(m[1]);
    const mon = MONTHS.indexOf(m[2]);
    let d = new Date(base.getFullYear(), mon, day);
    if (d < base) d = new Date(base.getFullYear() + 1, mon, day);
    if (d.getDate() === day) return isoDate(d);
  }
  return undefined;
}

/** "delhi se mumbai" / "delhi to mumbai" / "delhi mumbai" -> "Delhi to Mumbai" */
function extractRoute(text: string): string | null {
  const t = text.toLowerCase().replace(/[?.!,]/g, ' ');
  const pair = t.match(/\b([a-z][a-z .]{1,24}?)\s+(?:to|se|\u2192|->)\s+([a-z][a-z .]{1,24}?)(?=\s+(?:flight|flights|bus|buses|ka|ki|ke|rate|price|fare|cab|taxi|kal|tomorrow|today|aaj|on|for)\b|\s*$)/i);
  if (!pair) return null;
  const clean = (s: string) => s.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  const a = clean(pair[1]);
  const b = clean(pair[2]);
  if (!a || !b) return null;
  const title = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  return `${title(a)} to ${title(b)}`;
}

/** "Today" as the user sees it in India (IST, UTC+5:30), independent of the server's timezone. */
export function istToday(now = new Date()): Date {
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  return new Date(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
}

export function interpretAssistantQuestion(raw: string, now = istToday()): AssistantIntent {
  // OWNER 10 Nov: every phrasing must land on the right vertical. The normalizer runs FIRST so the
  // rest of this function only ever sees Latin text: Devanagari is transliterated, one-edit typos are
  // repaired, and a budget ("under 3000") is lifted out so a number can never pick the category.
  const norm = normalizeAssistantQuestion(raw);
  const text = norm.text;
  if (text.replace(/\s/g, '').length < 2) return { understood: false, vertical: null, query: '', reply: 'Type or say what you want to compare, e.g. "Delhi to Mumbai flight".' };

  const parsed = understandQuery(text);
  let vertical = (parsed.vertical as AssistantVertical | null) || null;
  const lower = text.toLowerCase();

  // Route-style question without a transport word defaults to flights ("delhi se mumbai kitna lagega").
  const route = extractRoute(text) || norm.routeHint || null;
  if (!vertical && route) vertical = 'flights';
  if (vertical === 'movies' || (vertical as string) === 'movie') vertical = 'movies';
  // Engine aliases: 'banking' is the same vertical the UI calls 'account'.
  if ((vertical as string) === 'banking') vertical = 'account';
  if ((vertical as string) === 'coupons' || (vertical as string) === 'giftcards') vertical = 'ecommerce';

  // OWNER 28 Oct ('aata sbse sasta kaha hai' -> ecommerce, 'biryani kaha sasta
  // milega' -> no category at all): the generic parser has no notion of a
  // grocery staple or a restaurant dish, so a question about atta/milk/biryani
  // fell through to shopping (or to the honest "could not pin a category"
  // bubble) and the search box received the whole sentence. The lexicon now owns
  // that decision: a dish -> Food, a staple/pack size -> 10-minute Grocery.
  // An explicit vertical the user named (flight, hotel, movie, loan...) is never
  // overridden, and a bare brand/product with no category stays shopping.
  const category = detectCategoryVertical(text);
  if (category && (!vertical || vertical === 'ecommerce')) vertical = category;

  // A word the user actually typed ("hotel", "bus", "iphone") outranks a guess made from filler, so the
  // normalizer's keyword hit is used whenever the parser produced nothing - or produced shopping from a
  // phrase that never named a product ("goa hotel 2 nights" used to become E-Commerce).
  const keyword = norm.keywordVertical as AssistantVertical | undefined;
  if (keyword && keyword in LABEL && (!vertical || (vertical === 'ecommerce' && !category))) vertical = keyword;

  // A domain we honestly do not cover answers with what we DO cover instead of a confident wrong vertical.
  // A weak word ("card" in "metro card recharge") must not beat an honest "we do not cover that".
  // A typed, supported category word is the only thing that outranks the unsupported-domain guard
  // ("train ticket delhi to jaipur" must not become flights just because it names a route).
  const STRONG_SUPPORTED = /\b(flight|flights|hotel|hotels|bus|buses|cab|cabs|taxi|movie|movies|loan|loans|insurance|policy|grocery|groceries|food|biryani|pizza|account|savings)\b/i;
  const unsupportedWins = norm.unsupported && !STRONG_SUPPORTED.test(text);
  if (unsupportedWins) {
    return {
      understood: false,
      vertical: null,
      query: norm.text,
      reply: `We do not compare ${norm.unsupported} yet. Try flights, hotels, bus, cabs, movie tickets, shopping, grocery, food delivery, loans, insurance, credit cards or bank accounts.`,
    };
  }

  if (!vertical || !(vertical in LABEL)) {
    return { understood: false, vertical: null, query: text, reply: 'I could not tell which category that is. Try "Delhi to Mumbai flight", "hotels in Goa" or a product name.' };
  }

  const date = ['flights', 'bus', 'cab', 'hotels', 'movies'].includes(vertical) ? parseSpokenDate(text, now) : undefined;

  let query: string;
  if (['flights', 'bus', 'cab'].includes(vertical)) {
    query = route || text.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  } else if (vertical === 'hotels') {
    const city = parsed.location?.city || (lower.match(/\b(?:in|at|near)\s+([a-z ]{3,30})/)?.[1] ?? '').trim();
    query = (city || text.replace(FILLER, ' ')).replace(/\s+/g, ' ').trim();
    query = query.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  } else if (vertical === 'grocery' || vertical === 'food') {
    // "aata sbse sasta kaha hai" -> "atta", "biryani kaha sasta milega" -> "biryani".
    query = cleanCategoryQuery(text) || text.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  } else {
    query = text.replace(FILLER, ' ').replace(/\s+/g, ' ').trim() || text;
    if (vertical === 'ecommerce') {
      // OWNER SCREENSHOT 10 Nov: "Indore mein kam price ke Cosmetic" was sent to the shops as
      // "Indore cosmetic", so Shopsy matched a jewellery organiser for a city it had never been asked
      // about. A place is not part of a product name: drop it and search the product alone.
      const places = findPlaces(text);
      for (const pl of places) query = query.replace(new RegExp(`\\b${pl}\\b`, 'gi'), ' ');
      query = query.replace(/\b(available|availability|items?|range|stock|list|ka|ki|ke)\b/gi, ' ');
      query = query.replace(/\s+/g, ' ').trim();
      // A question whose only surviving word is a particle ("me", "se") must not be sent to the shops.
      if (!query || query.length < 3 || /^(me|se|tak|ka|ki|ke|hai|hain|in|at|of)$/i.test(query)) {
        query = places.length ? 'products' : text;
      }
      // "cosmetic" is how people type it; the sellers index "cosmetics".
      if (/^cosmetic$/i.test(query)) query = 'cosmetics';
      if (/^(mobile|phone)$/i.test(query)) query = 'mobile phone';
    }
  }
  if (!query) query = text;

  // Shopping for a bare product name is an ASSUMPTION (the user named a thing, not a category), and the
  // answer layer says so out loud. A typed category noun ("laptop", "headphones") is not an assumption.
  const assumed = vertical === 'ecommerce' && !norm.keywordVertical;

  const when = date ? ` for ${date}` : '';
  const categoryReply =
    vertical === 'grocery'
      ? `"${query}" is a grocery staple, so I am checking the 10-minute delivery apps (Blinkit, Zepto, Instamart, BigBasket, Flipkart Minutes) for the lowest price.`
      : vertical === 'food'
        ? `"${query}" is a food order, so I am checking the restaurant delivery apps (Zomato, Swiggy, Domino's, EatSure…) for the lowest price.`
        : `Opening ${LABEL[vertical]} and searching "${query}"${when}. Live prices from every site are loading.`;
  return {
    understood: true,
    vertical,
    query,
    ...(date ? { date } : {}),
    ...(norm.budget ? { budget: norm.budget } : {}),
    ...(assumed ? { assumed: true } : {}),
    ...(norm.transliterated || norm.repaired.length ? { normalized: { transliterated: norm.transliterated, repaired: norm.repaired } } : {}),
    reply: categoryReply,
  };
}
