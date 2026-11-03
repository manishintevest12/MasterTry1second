/**
 * Assistant conversation thread.
 *
 * OWNER 3 Nov (screenshot): he asked "muje tata tea ka rate batao" and got Blinkit ₹50, then asked
 * "aur v website batao sirf blinkit hi kyun bata rahe ho" — and the assistant treated that sentence as
 * a NEW PRODUCT: "aur v website sirf hi kyun rahe ho is a grocery staple, so I am checking the
 * 10-minute delivery apps". It had no idea it was still talking about Tata Tea.
 *
 * The assistant is stateless between calls (the app posts one question at a time), so the fix is
 * twofold and both halves live here:
 *   1. a per-session subject memory (vertical + product + city + the sellers it just answered with),
 *   2. a strict follow-up detector: if what is left of the sentence after removing the question
 *      machinery (aur, bhi, website, kyun, sirf...) and the SITE NAMES (blinkit, zepto, amazon...)
 *      is empty, the user is talking about the SAME product and must be answered from that subject.
 *      Anything with a real product noun left is a new question and is routed normally.
 *
 * Nothing here invents a price: follow-ups re-read the same live rows (and, when the user asks for
 * more sites, one extra shopping pass for that same product) and the reply names only what answered.
 */

export type FollowUpKind = 'more_sellers' | 'cheaper' | 'detail' | 'repeat';

export interface AssistantSubject {
  /** engine vertical of the last answer ("grocery", "ecommerce", "flights"...) */
  vertical: string;
  /** the product / route / city that was actually searched */
  query: string;
  city?: string;
  date?: string;
  return?: string;
  /** sellers the last answer actually showed */
  sellers: string[];
  best?: { title: string; provider: string; price: number };
  at: number;
}

export interface ThreadSlot {
  subject: AssistantSubject;
  touchedAt: number;
}

const TTL_MS = 60 * 60_000;      // an hour of conversation is plenty
const MAX_SESSIONS = 2000;

const store = new Map<string, ThreadSlot>();

/** Deterministic test hook: drop every remembered subject. */
export function resetAssistantThreads(): void {
  store.clear();
}

export function readSubject(sessionId: string): AssistantSubject | null {
  if (!sessionId) return null;
  const slot = store.get(sessionId);
  if (!slot) return null;
  if (Date.now() - slot.touchedAt > TTL_MS) {
    store.delete(sessionId);
    return null;
  }
  return slot.subject;
}

export function writeSubject(sessionId: string, subject: AssistantSubject): void {
  if (!sessionId) return;
  store.set(sessionId, { subject: { ...subject, at: Date.now() }, touchedAt: Date.now() });
  if (store.size <= MAX_SESSIONS) return;
  // Oldest first eviction; a long-running server must not grow without bound.
  const oldest = [...store.entries()].sort((a, b) => a[1].touchedAt - b[1].touchedAt).slice(0, store.size - MAX_SESSIONS);
  for (const [key] of oldest) store.delete(key);
}

/** Every site the assistant can price a product on. A bare mention of one is not a new question. */
const SITE_NAMES = /\b(blinkit|zepto|instamart|swiggy\s*instamart|bigbasket|big\s*basket|jiomart|jio\s*mart|dmart|d\s*mart|dunzo|flipkart\s*minutes|flipkart|amazon|ajio|myntra|meesho|nykaa|tatacliq|tata\s*cliq|croma|reliance\s*digital|snapdeal|paytm\s*mall|swiggy|zomato|dominos|domino'?s|eatsure|faasos|behrouz|ola\s*dash|uber\s*eats|makemytrip|goibibo|yatra|cleartrip|ixigo|easemytrip|ease\s*my\s*trip|agoda|booking|oyo|expedia|hotels\.com|redbus|abhibus|ola|uber|rapido)\b/gi;

/** Question machinery: words that carry no subject at all. */
const FOLLOW_VOCAB = new Set([
  'aur', 'or', 'and', 'more', 'other', 'others', 'dusre', 'dusri', 'doosre', 'doosri', 'baaki', 'baki',
  'website', 'websites', 'site', 'sites', 'app', 'apps', 'seller', 'sellers', 'shop', 'shops', 'store',
  'stores', 'platform', 'platforms', 'option', 'options', 'choice', 'choices', 'v', 'bhi', 'sab', 'sabhi',
  'all', 'list', 'full', 'every', 'har', 'kuch', 'koi', 'any', 'sirf', 'only', 'hi', 'just', 'ek',
  'kyun', 'kyu', 'why', 'kaise', 'how', 'kaun', 'kaunsa', 'which', 'kahan', 'kaha', 'where',
  'batao', 'bata', 'bataiye', 'batado', 'dikhao', 'dikha', 'dikhaiye', 'show', 'tell', 'give', 'do',
  'chahiye', 'chahie', 'need', 'want', 'please', 'pls', 'plz', 'bro', 'bhai', 'yaar',
  'rahe', 'raha', 'rahi', 'ho', 'hun', 'hai', 'hain', 'he', 'be', 'being', 'to', 'is', 'it', 'this',
  'that', 'these', 'those', 'ye', 'yeh', 'wo', 'woh', 'iska', 'uska', 'iske', 'uske', 'isme', 'usme',
  'same', 'wahi', 'wohi', 'phir', 'fir', 'again', 'dobara', 'repeat', 'compare', 'comparison',
  'price', 'prices', 'rate', 'rates', 'fare', 'fares', 'daam', 'dam', 'kimat', 'keemat', 'cost',
  'sasta', 'saste', 'sabse', 'cheapest', 'cheap', 'cheaper', 'lowest', 'low', 'kam', 'best', 'better',
  'detail', 'details', 'detail', 'kya', 'what', 'of', 'for', 'in', 'at', 'near', 'on', 'me', 'mein',
  'mai', 'ka', 'ki', 'ke', 'ko', 'se', 'tak', 'a', 'an', 'the', 'my', 'our', 'your', 'i', 'we', 'you',
  'so', 'then', 'now', 'ab', 'abhi', 'bhi', 'thoda', 'zyada', 'jada', 'bahut', 'much', 'many', 'down',
  'below', 'upar', 'niche', 'side', 'side', 'please', 'kro', 'karo', 'kar', 'kr', 'de', 'dena',
  // Hinglish verb / question tails that carry no product: "zepto par kitna hai", "kaun bech raha hai",
  // "sasta kahan milega" must all stay on the product the thread is already about.
  'par', 'pe', 'upar', 'kitna', 'kitne', 'kitni', 'bech', 'bechta', 'bechte', 'bechti', 'bechna',
  'bechraha', 'milta', 'milte', 'milti', 'milega', 'milegi', 'mile', 'mil', 'mila', 'dega', 'degi',
  'deta', 'deti', 'dikhega', 'dikhegi', 'hoga', 'hogi', 'hota', 'hoti', 'hote', 'karega', 'karti',
  'karta', 'karte', 'sakta', 'sakte', 'sakti', 'chalo', 'dekho', 'dekh', 'between', 'across',
  'shops', 'selling', 'available', 'getting', 'where', 'which', 'all', 'kis', 'kisne', 'kaunsa',
]);

function tokens(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .replace(SITE_NAMES, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** What is actually being asked about, once the question machinery is removed. */
export function followUpResidue(text: string): string[] {
  return tokens(text).filter((t) => t.length >= 2 && !FOLLOW_VOCAB.has(t));
}

const ASK_MORE = /\b(aur|or|more|dusre|dusri|doosre|doosri|other|baaki|baki|sabhi|all|har|every)\b|(website|site|app|seller|shop|store|platform|option)|\b(kaun|kaunsa|kisne|which\s+sites?)\b/i;
const ASK_WHY_ONLY = /\b(sirf|only|just)\b[\s\S]{0,24}\b(kyun|kyu|why|bata|rahe|raha|dikha)\b|\b(kyun|kyu|why)\b[\s\S]{0,16}\b(sirf|only)\b/i;
const ASK_CHEAPER = /\b(sasta|saste|sabse\s*sasta|cheap|cheaper|cheapest|lowest|kam\s*daam|best\s*price)\b/i;
const ASK_DETAIL = /\b(detail|details|specs?|feature|features|kaisa|kaisi|review|reviews|accha|good|quality)\b/i;
const ASK_REPEAT = /^\s*(phir\s*se|fir\s*se|again|dobara|repeat|wahi|same)\b/i;

export interface FollowUpVerdict {
  follow: boolean;
  kind: FollowUpKind;
  /** the product/route the question is still about (from the subject) */
  query: string;
  vertical: string;
  reason: string;
}

/**
 * Is `text` a follow-up on `subject`, or a new question?
 * A follow-up must (a) look like it is asking something about the previous answer and
 * (b) contain NO new subject of its own.
 */
export function classifyFollowUp(text: string, subject: AssistantSubject | null): FollowUpVerdict {
  const none: FollowUpVerdict = { follow: false, kind: 'repeat', query: '', vertical: '', reason: 'new-question' };
  if (!subject || !subject.query) return none;
  const raw = String(text || '').trim();
  if (!raw) return none;
  const residue = followUpResidue(raw);
  const looksLikeFollowUp = ASK_MORE.test(raw) || ASK_WHY_ONLY.test(raw) || ASK_CHEAPER.test(raw)
    || ASK_DETAIL.test(raw) || ASK_REPEAT.test(raw);
  if (!looksLikeFollowUp) return none;
  // A real product noun left over means the user moved on ("amul butter ka rate batao").
  if (residue.length > 0) return none;
  const kind: FollowUpKind = (ASK_MORE.test(raw) || ASK_WHY_ONLY.test(raw)) ? 'more_sellers'
    : ASK_CHEAPER.test(raw) ? 'cheaper'
    : ASK_DETAIL.test(raw) ? 'detail' : 'repeat';
  return { follow: true, kind, query: subject.query, vertical: subject.vertical, reason: 'residue-empty' };
}

/** One priced row per seller, cheapest first - the "which other sites" answer. */
export function sellerBreakdown(rows: any[]): { provider: string; title: string; price: number; currency: string }[] {
  const best = new Map<string, { provider: string; title: string; price: number; currency: string }>();
  for (const r of Array.isArray(rows) ? rows : []) {
    const provider = String(r?.provider || r?.vendor || r?.seller || '').trim();
    const price = Number(r?.price ?? r?.primaryPrice ?? 0);
    if (!provider || !Number.isFinite(price) || price <= 0) continue;
    const key = provider.toLowerCase();
    const prev = best.get(key);
    if (!prev || price < prev.price) {
      best.set(key, { provider, title: String(r?.title || ''), price, currency: String(r?.currency || 'INR') });
    }
  }
  return [...best.values()].sort((a, b) => a.price - b.price);
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/**
 * The follow-up reply. Names EVERY seller that actually answered (that is what the owner asked
 * for: "aur v website batao"), says which one is cheapest, and stays honest when only some sites
 * have answered so far.
 */
export function shapeFollowUpAnswer(
  kind: FollowUpKind,
  query: string,
  rows: any[],
  opts: { pending?: boolean; alsoShopping?: boolean; sellersLastTime?: string[] } = {},
): string {
  const quoted = `"${query}"`;
  const breakdown = sellerBreakdown(rows);
  if (!breakdown.length) {
    const tail = opts.pending
      ? 'No site had answered yet in this pass - the prices drop in here as soon as they do.'
      : 'No other site answered for it this time.';
    return `Still about ${quoted}: ${opts.sellersLastTime?.length ? `only ${opts.sellersLastTime.join(', ')} had it. ` : ''}${tail}`;
  }
  const list = breakdown.slice(0, 8).map((b) => `${b.provider} ${inr(b.price)}`).join(', ');
  const cheapest = breakdown[0];
  if (breakdown.length === 1) {
    const pendingOne = opts.pending
      ? ' The other sites are still scanning; their prices appear here as they answer.'
      : ' No other site answered for it this time.';
    return `So far only ${cheapest.provider} has ${quoted} at ${inr(cheapest.price)}.${pendingOne}`.replace(/\s+/g, ' ').trim();
  }
  const where = opts.alsoShopping ? ' (grocery apps + shopping sites)' : '';
  const more = breakdown.length > 8 ? ` and ${breakdown.length - 8} more` : '';
  const kindLine = kind === 'cheaper'
    ? `Cheapest for ${quoted}: ${cheapest.provider} at ${inr(cheapest.price)}.`
    : kind === 'detail'
      ? `About ${quoted}: ${breakdown[0].title || query} - ${cheapest.provider} has it at ${inr(cheapest.price)}.`
      : `${breakdown.length} site${breakdown.length === 1 ? '' : 's'}${where} have ${quoted}: ${list}${more}.`;
  const cheapestLine = kind === 'cheaper' ? '' : ` Cheapest is ${cheapest.provider} at ${inr(cheapest.price)}.`;
  const pendingLine = opts.pending ? ' The remaining sites are still scanning; their prices appear here as they answer.' : '';
  return `${kindLine}${cheapestLine}${pendingLine}`.replace(/\s+/g, ' ').trim();
}

/** Remember the answer we just gave, so the next turn knows the product and the sellers. */
export function subjectFromAnswer(
  vertical: string,
  query: string,
  rows: any[],
  ctx: { city?: string; date?: string; return?: string } = {},
): AssistantSubject {
  const breakdown = sellerBreakdown(rows);
  return {
    vertical: String(vertical || ''),
    query: String(query || ''),
    ...(ctx.city ? { city: ctx.city } : {}),
    ...(ctx.date ? { date: ctx.date } : {}),
    ...(ctx.return ? { return: ctx.return } : {}),
    sellers: breakdown.map((b) => b.provider).slice(0, 8),
    ...(breakdown[0] ? { best: { title: breakdown[0].title, provider: breakdown[0].provider, price: breakdown[0].price } } : {}),
    at: Date.now(),
  };
}
