/**
 * Ask Try1Second AI — ANSWER layer (owner 28 Oct: "ask try1second ai se muje har
 * vertical ka har product ka result chahiye, abhi ye sab vertical cover nahi kar
 * raha").
 *
 * Before this, the assistant only ROUTED: it guessed a vertical, said "opening
 * Flights…" and pushed the user to that vertical's own search box. Eleven of the
 * twelve verticals were reachable only if the question happened to name them, and
 * a plain product name ("iphone 15", "amul butter") fell through as "I could not
 * tell which category that is".
 *
 * Now the assistant is a real answer engine:
 *   1. buildAssistantSearch() turns ANY question into a search input for ALL 12
 *      verticals (flights, hotels, bus, cab, ecommerce, grocery, food, movies,
 *      loans, insurance, creditcards, account/banking) and falls back to shopping
 *      for a bare product name instead of refusing.
 *   2. The route runs that input through the SAME acquisition pipeline as the
 *      feed (no second, parallel implementation of pricing).
 *   3. shapeAssistantAnswer() turns the real rows into a one-line answer plus
 *      comparable top results, so every vertical answers with products and prices.
 *
 * Pure functions only — the pipeline call lives in the route, so this file is
 * fully unit-testable without network.
 */
import { interpretAssistantQuestion, type AssistantIntent, type AssistantVertical } from './assistantIntent';

export interface AssistantAskContext {
  city?: string;
  pincode?: string;
  locality?: string;
  lat?: number;
  lng?: number;
  travelDates?: { depart?: string; return?: string };
}

/** The subset of the feed's SearchInput the assistant fills in. */
export interface AssistantSearchInput {
  query: string;
  vertical: string;
  city?: string;
  pincode?: string;
  locality?: string;
  lat?: number;
  lng?: number;
  travelDates?: { depart?: string; return?: string };
}

export interface AssistantAnswerMeta {
  understood: boolean;
  /** The assistant had to assume a vertical (bare product name) — say so honestly. */
  assumedVertical: boolean;
  vertical: AssistantVertical | null;
  query: string;
  date?: string;
  reply: string;
}

/** Words that are never part of a product/query string. */
const NOISE = /\b(kitna|kitne|kya|hai|hain|ka|ki|ke|ko|me|mein|mai|se|tak|rate|rates|price|prices|batao|bata|do|dikhao|dikha|chahiye|chahie|please|pls|show|tell|me|find|search|compare|check|what|is|are|the|of|for|a|an|i|want|need|looking|best|sabse|sasta|cheapest|cheap|deal|deals|offer|offers|buy|kharidna|kitne\s*ka)\b/gi;

/** Strip Hinglish/English filler so "iphone 15 ka price batao" searches "iphone 15". */
export function cleanAssistantQuery(raw: string): string {
  return String(raw || '')
    .replace(NOISE, ' ')
    .replace(/[?!.,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Bare grocery staples ("amul butter 500g", "atta", "milk 1l") are the one case the
 * intent parser leaves unresolved because the same words are also products; the
 * owner wants every vertical answerable, so these route to Grocery (10-min
 * delivery) instead of falling through to shopping.
 */
/** Bank-account / deposit questions, which the intent parser does not carry yet. */
const ACCOUNT_HINT = /\b(bank account|savings account|saving account|current account|salary account|zero balance|fixed deposit|recurring deposit|\bfd\b|\brd\b|nre account|nro account)\b/i;

const GROCERY_HINT = /\b(milk|doodh|butter|makhan|paneer|curd|dahi|atta|flour|rice|chawal|dal|daal|oil|tel|sugar|cheeni|salt|namak|tea|chai|coffee|maggi|noodles|bread|eggs|anda|chicken|mutton|fish|sabzi|vegetables|onion|pyaz|potato|aloo|tomato|tamatar|fruit|banana|apple|amul|nestle|britannia|parle|tata salt|fortune|aashirvaad|500g|1kg|1\s*kg|\d+\s*g)\b/i;

/** True when the text still looks like something a source could be searched for. */
function searchable(text: string): boolean {
  const t = cleanAssistantQuery(text);
  if (t.length < 3 || !/[a-z0-9]/i.test(t)) return false;
  // Acknowledgements and greetings are not searches.
  return !/^(ok|okay|kk|haan|han|yes|yeah|no|nahi|hi|hello|hey|thanks|thank you|thx|bye|good|nice|test)\b/i.test(t);
}

/**
 * Question -> intent + the exact search input to run.
 * Never returns "I cannot tell": a bare noun falls back to shopping (the vertical
 * that can price literally any product) and the reply says that out loud.
 */
export function buildAssistantSearch(raw: string, ctx: AssistantAskContext = {}): { meta: AssistantAnswerMeta; input: AssistantSearchInput | null } {
  const text = String(raw || '').trim().slice(0, 300);
  const intent: AssistantIntent = interpretAssistantQuestion(text);

  const withContext = (input: AssistantSearchInput): AssistantSearchInput => ({
    ...input,
    ...(ctx.city ? { city: ctx.city } : {}),
    ...(ctx.pincode ? { pincode: ctx.pincode } : {}),
    ...(ctx.locality ? { locality: ctx.locality } : {}),
    ...(Number.isFinite(ctx.lat) ? { lat: ctx.lat } : {}),
    ...(Number.isFinite(ctx.lng) ? { lng: ctx.lng } : {}),
    ...(ctx.travelDates?.depart || intent.date
      ? { travelDates: { depart: intent.date || ctx.travelDates?.depart, return: ctx.travelDates?.return } }
      : {}),
  });

  if (intent.understood && intent.vertical) {
    return {
      meta: { understood: true, assumedVertical: false, vertical: intent.vertical, query: intent.query, ...(intent.date ? { date: intent.date } : {}), reply: intent.reply },
      input: withContext({ query: intent.query, vertical: intent.vertical }),
    };
  }

  // Not understood: if there is a searchable noun left, answer it as a shopping
  // product rather than refusing. Anything truly empty gets an honest ask-back.
  if (!searchable(text)) {
    return {
      meta: {
        understood: false, assumedVertical: false, vertical: null,
        query: cleanAssistantQuery(text) || text,
        reply: 'What should I compare? Say a product ("iphone 15"), a route ("Delhi to Mumbai") or a place ("hotels in Goa") and I will price it across every site.',
      },
      input: null,
    };
  }

  const query = cleanAssistantQuery(text) || text;
  const vertical: AssistantVertical = ACCOUNT_HINT.test(text) ? 'account' : GROCERY_HINT.test(text) ? 'grocery' : 'ecommerce';
  const where = vertical === 'grocery' ? 'the 10-minute grocery sites' : vertical === 'account' ? 'every bank and comparison site' : 'every shopping site';
  return {
    meta: {
      understood: true,
      assumedVertical: true,
      vertical,
      query,
      reply: `I could not pin a single category, so I am comparing "${query}" across ${where}. Results below.`,
    },
    input: withContext({ query, vertical }),
  };
}

export interface AssistantRow {
  vertical: string;
  title: string;
  provider: string;
  price: number;
  priceAvailable: boolean;
  currency: string;
  imageUrl?: string;
  url?: string;
  specs?: Record<string, string>;
  sellerCount?: number;
}

const LABEL: Record<string, string> = {
  flights: 'flights', hotels: 'hotels', bus: 'bus', cab: 'cabs', ecommerce: 'shopping',
  grocery: 'grocery', food: 'food', movies: 'movie tickets', loans: 'loans',
  insurance: 'insurance', creditcards: 'credit cards', account: 'bank accounts',
  banking: 'bank accounts',
};

export function verticalLabel(vertical: string | null): string {
  return LABEL[String(vertical || '')] || 'results';
}

/** Rupee-style formatting without depending on Intl locale data in tests. */
function money(n: number, currency: string): string {
  const sym = (currency || 'INR').toUpperCase() === 'INR' ? '₹' : '';
  return `${sym}${Math.round(n).toLocaleString('en-IN')}`;
}

function rowPrice(o: any): number {
  const p = o?.prices || {};
  const n = Number(p.finalPayablePrice ?? p.effectivePrice ?? p.mandatoryTotal ?? p.listPrice ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Map pipeline offers to the compact rows the assistant answer shows. */
export function toAssistantRows(results: any[], limit = 6): AssistantRow[] {
  const out: AssistantRow[] = [];
  const seen = new Set<string>();
  for (const o of Array.isArray(results) ? results : []) {
    if (!o) continue;
    const title = String(o.title || '').trim();
    if (!title) continue;
    const key = title.toLowerCase().replace(/[^a-z0-9]/g, '') + '|' + rowPrice(o);
    if (seen.has(key)) continue;
    seen.add(key);
    const price = rowPrice(o);
    const specs: Record<string, string> = {};
    for (const [k, v] of Object.entries(o.attributes || {})) {
      if (v !== undefined && v !== null && String(v).trim() && Object.keys(specs).length < 5) specs[k] = String(v);
    }
    for (const k of ['departure time', 'arrival time', 'flight number', 'duration', 'stops']) {
      const v = (o as any)?.[k] ?? (o as any)?.specs?.[k];
      if (v && !specs[k]) specs[k] = String(v);
    }
    out.push({
      vertical: String(o.vertical || ''),
      title,
      provider: String(o.vendor || o.seller || o.provider || ''),
      price,
      priceAvailable: price > 0,
      currency: String(o?.prices?.currency || 'INR'),
      ...(o.imageUrl || o.image ? { imageUrl: String(o.imageUrl || o.image) } : {}),
      ...(o.sellerUrl ? { url: String(o.sellerUrl) } : {}),
      ...(Object.keys(specs).length ? { specs } : {}),
      ...(Array.isArray(o.sellerQuotes) && o.sellerQuotes.length > 1 ? { sellerCount: o.sellerQuotes.length } : {}),
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Rows -> the assistant's answer sentence. Always names the real cheapest price and
 * seller it actually saw; when there is nothing priced it says so instead of
 * inventing a number.
 */
export function shapeAssistantAnswer(vertical: string | null, query: string, rows: AssistantRow[], opts: { pending?: boolean; sourcesSucceeded?: string[]; honestNotice?: string } = {}): { reply: string; results: AssistantRow[]; count: number } {
  const label = verticalLabel(vertical);
  const priced = rows.filter((r) => r.priceAvailable).sort((a, b) => a.price - b.price);
  const best = priced[0];
  const sellers = new Set(rows.map((r) => r.provider).filter(Boolean));
  const sourceCount = Math.max(sellers.size, opts.sourcesSucceeded?.length || 0);

  if (!rows.length) {
    const base = `No live ${label} result for "${query}" came back in this pass.`;
    const tail = opts.pending
      ? ' The engine is still scanning and the prices drop in here automatically within a few seconds.'
      : (opts.honestNotice || ' Try a shorter wording, or open the category to see the last verified prices.');
    return { reply: base + tail, results: [], count: 0 };
  }

  if (!best) {
    return {
      reply: `${rows.length} ${label} listings for "${query}" from ${sourceCount || rows.length} sites — the seller page holds the price (app-only fares), so open the card to see it.`,
      results: rows, count: rows.length,
    };
  }

  const spread = priced.length > 1 ? priced[priced.length - 1].price - best.price : 0;
  const spreadTxt = spread > 0 ? ` Spread across sites: ${money(spread, best.currency)}.` : '';
  return {
    reply: `Cheapest ${label} result for "${query}": ${best.title}${best.provider ? ` on ${best.provider}` : ''} at ${money(best.price, best.currency)}.${spreadTxt} ${rows.length} live option${rows.length === 1 ? '' : 's'} from ${sourceCount || rows.length} site${(sourceCount || rows.length) === 1 ? '' : 's'} below.`,
    results: rows,
    count: rows.length,
  };
}
