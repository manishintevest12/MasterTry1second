/**
 * Credit Cards worker (India). A credit-card search runs ONLY this worker.
 *
 * Sources (all browserless, curl_cffi chrome, no keys, verified live 14 Oct 2026):
 *  - CardInsider  : issuer index pages list every card; each card page is SSR with joining/renewal fee,
 *                   reward rate, welcome benefit, lounge, forex, APR, fuel waiver, image, rating.
 *  - Paisabazaar  : issuer index + card pages with labelled Joining/Annual fee rows (second website,
 *                   so the SAME card can be compared across sites).
 *  - BankBazaar   : attempted, reported honestly (card list is a JS shell, no per-card facts).
 *  - Bank sites   : the apply deeplink target (seller = issuing bank). Affiliate params are injected
 *                   server-side in /api/out, never here.
 * The search query selects the cards: bank name, card name or a use-case ("travel", "cashback", "lifetime free").
 */
import { registerVerticalWorker, looksLikeChallenge, type VerticalWorker, type WorkerTaskContext } from '../verticalWorker';
import { AcquisitionError } from '../../common/httpClient';
import { cffiFetch } from '../../common/curlCffiFetch';
import { parseCardInsiderCard, parseIssuerIndex, cardToRawItem, BANK_NAMES } from '../parsers/cardInsider';
import { parsePaisabazaarCard, parsePaisabazaarIndex, pbToRawItem } from '../parsers/paisabazaarCards';
import { resolveBankCardUrl } from '../parsers/bankCardLinks';

const CI_BANKS = ['hdfc-bank', 'sbi-card', 'axis-bank', 'icici-bank', 'idfc-first-bank', 'indusind-bank', 'au-bank', 'yes-bank', 'rbl-bank', 'american-express', 'bank-of-baroda', 'standard-chartered', 'kotak-mahindra-bank'];
const PB_BANKS = ['hdfc-bank', 'axis-bank', 'icici-bank', 'sbi-card', 'idfc-first-bank', 'indusind-bank', 'au-small-finance-bank', 'yes-bank', 'rbl-bank', 'amex-bank', 'bobcard', 'kotak-mahindra-bank'];
const PB_TO_CI: Record<string, string> = { 'au-small-finance-bank': 'au-bank', 'amex-bank': 'american-express', bobcard: 'bank-of-baroda' };

const BANK_ALIASES: Array<{ slug: string; re: RegExp }> = [
  { slug: 'hdfc-bank', re: /\bhdfc\b/i }, { slug: 'sbi-card', re: /\bsbi\b/i }, { slug: 'axis-bank', re: /\baxis\b/i },
  { slug: 'icici-bank', re: /\bicici\b/i }, { slug: 'idfc-first-bank', re: /\bidfc\b/i }, { slug: 'indusind-bank', re: /indusind/i },
  { slug: 'au-bank', re: /\bau\b|au small/i }, { slug: 'yes-bank', re: /\byes bank\b|\byes\b/i }, { slug: 'rbl-bank', re: /\brbl\b/i },
  { slug: 'american-express', re: /amex|american express/i }, { slug: 'bank-of-baroda', re: /\bbob\b|baroda|bobcard/i },
  { slug: 'standard-chartered', re: /standard chartered|\bsc\b/i }, { slug: 'kotak-mahindra-bank', re: /kotak/i },
];

/** Use-case words -> a predicate over parsed facts, so "travel cards" returns real travel cards, not everything. */
const INTENTS: Array<{ re: RegExp; test: (t: string) => boolean }> = [
  { re: /travel|lounge|airport|miles/i, test: (t) => /lounge|miles|travel|air|vistara|indigo|atlas|flight/i.test(t) },
  { re: /cash\s*back|cashback/i, test: (t) => /cashback/i.test(t) },
  { re: /lifetime\s*free|\bltf\b|no annual fee|zero fee/i, test: (t) => /lifetime free/i.test(t) },
  { re: /fuel|petrol|diesel/i, test: (t) => /fuel|petrol|indian oil|bpcl|hpcl/i.test(t) },
  { re: /shopping|online|amazon|flipkart/i, test: (t) => /shopping|amazon|flipkart|myntra|online/i.test(t) },
  { re: /dining|food|swiggy|zomato/i, test: (t) => /dining|swiggy|zomato|food/i.test(t) },
  { re: /rupay|upi/i, test: (t) => /rupay/i.test(t) },
];

const STOP = new Set(['credit', 'card', 'cards', 'best', 'top', 'compare', 'comparison', 'india', 'bank', 'for', 'with', 'the', 'and', 'in', 'a', 'of', 'to', 'me', 'my', 'cc', 'free', 'lifetime', 'travel', 'cashback', 'cash', 'back', 'fuel', 'shopping', 'online', 'dining', 'rupay', 'lounge']);

export function queryPlan(raw: string): { banks: string[]; tokens: string[]; intents: typeof INTENTS } {
  const q = raw || '';
  const banks = BANK_ALIASES.filter((b) => b.re.test(q)).map((b) => b.slug);
  const tokens = q.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t) && !BANK_ALIASES.some((b) => b.re.test(t)));
  return { banks, tokens, intents: INTENTS.filter((i) => i.re.test(q)) };
}

/** Bank slugs to crawl for this query. No bank named => the big issuers (bounded). */
function banksFor(plan: ReturnType<typeof queryPlan>, universe: string[], map: (s: string) => string = (s) => s): string[] {
  const wanted = plan.banks.map((b) => universe.find((u) => map(u) === b) || b).filter((b) => universe.includes(b));
  return wanted.length ? wanted : universe.slice(0, 6);
}

const nameMatches = (name: string, tokens: string[]) => !tokens.length || tokens.every((t) => name.toLowerCase().includes(t));

/**
 * OWNER 9 Nov ("credit card mai quick picks kaam ni kr rha"): the quick picks are descriptive sentences
 * - "Premium Metal Cards (Atlas, Infinia)", "HDFC Credit Cards (Millennia, Regalia, Infinia)",
 * "Best Cashback Cards (Amazon, Flipkart, Myntra)". queryPlan turns each into long tokens
 * (premium/metal/atlas/infinia) and the old code kept only issuer pages whose URL slug contained EVERY
 * token - no slug ever does, so the tap crawled nothing and the feed answered zero rows. The pick has to
 * narrow, and when the strict reading matches nothing it must widen instead of returning nothing:
 *   1. slug contains all tokens  -> 2. slug contains any token  -> 3. the unfiltered universe.
 * Nothing is invented by widening: the same real catalogue is crawled and the INTENT still filters cards.
 */
export function pickTargets<T extends { u: string }>(targets: T[], tokens: string[]): T[] {
  if (!tokens.length || !targets.length) return targets;
  const slug = (t: T) => t.u.split('/').filter(Boolean).pop()!.replace(/-/g, ' ').toLowerCase();
  const all = targets.filter((t) => nameMatches(slug(t), tokens));
  if (all.length) return all;
  const any = targets.filter((t) => tokens.some((tok) => slug(t).includes(tok)));
  return any.length ? any : targets;
}

/** Several intent words ("travel ... lounge") map to the SAME predicate, so requiring every intent to
 *  hold is how a reasonable pick like "Travel Cards with Airport Lounge Access" ended up empty. Any
 *  matched intent is enough; with no intent nothing is filtered. */
const intentOk = (hay: string, intents: Array<{ test: (t: string) => boolean }>) =>
  !intents.length || intents.some((i) => i.test(hay));

async function pool<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

const MAX_CARDS = 40;

async function ciTask(ctx: WorkerTaskContext) {
  const plan = queryPlan(`${ctx.query.rawQuery || ''} ${ctx.query.entityName || ''}`);
  const banks = banksFor(plan, CI_BANKS);
  const indexes = await pool(banks, 4, async (b) => {
    const r = await cffiFetch(`https://cardinsider.com/${b}/`, { impersonate: 'chrome', timeoutMs: 15_000 });
    return { b, status: r.status, links: r.status === 200 ? parseIssuerIndex(r.body, b) : [] };
  });
  if (indexes.every((i) => i.status !== 200)) throw new AcquisitionError('SERVER_ERROR', `CardInsider issuer pages HTTP ${indexes.map((i) => i.status).join('/')}`);
  // Name filter on the URL slug first (cheap), then fetch only the cards that can match.
  let targets = indexes.flatMap((i) => i.links.map((u) => ({ b: i.b, u })));
  targets = pickTargets(targets, plan.tokens);
  targets = targets.slice(0, plan.intents.length ? 90 : MAX_CARDS + 10);
  if (!targets.length) throw new AcquisitionError('EMPTY_RESPONSE', 'CardInsider lists no card matching this search');
  const pages = await pool(targets, 8, async (t) => {
    try {
      const r = await cffiFetch(t.u, { impersonate: 'chrome', timeoutMs: 15_000 });
      return { t, r };
    } catch { return { t, r: null as any }; }
  });
  const out = [];
  for (const { t, r } of pages) {
    if (!r || r.status !== 200) continue;
    const c = parseCardInsiderCard(r.body, t.u);
    if (!c) continue;
    if (plan.intents.length) {
      const hay = `${c.name} ${c.bestFor || ''} ${c.rewardRate || ''} ${c.domesticLounge || ''} ${c.intlLounge || ''} ${c.joiningFee || ''} ${c.annualFee || ''} ${c.fuelWaiver || ''}`;
      if (!intentOk(hay, plan.intents)) continue;
    }
    const item = cardToRawItem(c, ctx.source, t.b, r.body);
    // Apply deeplink = the issuing bank's own card page when it can be resolved (never guessed).
    const official = await resolveBankCardUrl(t.b, c.name);
    if (official) { item.sellerUrl = official; (item.attributes as any).official_page = official; }
    else (item.attributes as any).apply_note = 'Card-specific bank page not found; link opens the bank\'s credit-card hub';
    out.push(item);
    if (out.length >= MAX_CARDS) break;
  }
  if (!out.length) throw new AcquisitionError('EMPTY_RESPONSE', 'No CardInsider card page matched this search');
  return out;
}

async function pbTask(ctx: WorkerTaskContext) {
  const plan = queryPlan(`${ctx.query.rawQuery || ''} ${ctx.query.entityName || ''}`);
  const banks = banksFor(plan, PB_BANKS, (s) => PB_TO_CI[s] || s);
  const indexes = await pool(banks, 4, async (b) => {
    const r = await cffiFetch(`https://www.paisabazaar.com/${b}/credit-card/`, { impersonate: 'chrome', timeoutMs: 15_000 });
    return { b, status: r.status, links: r.status === 200 ? parsePaisabazaarIndex(r.body, b) : [] };
  });
  let targets = indexes.flatMap((i) => i.links.map((u) => ({ b: i.b, u })));
  if (!targets.length) throw new AcquisitionError(indexes.some((i) => i.status === 403) ? 'ACCESS_CHALLENGE' : 'EMPTY_RESPONSE', `Paisabazaar issuer pages gave no card links (HTTP ${indexes.map((i) => i.status).join('/')})`);
  targets = pickTargets(targets, plan.tokens);
  targets = targets.slice(0, plan.intents.length ? 60 : 30);
  const pages = await pool(targets, 6, async (t) => {
    try { return { t, r: await cffiFetch(t.u, { impersonate: 'chrome', timeoutMs: 15_000 }) }; } catch { return { t, r: null as any }; }
  });
  const out = [];
  for (const { t, r } of pages) {
    if (!r || r.status !== 200) continue;
    const c = parsePaisabazaarCard(r.body, t.u);
    if (!c) continue;
    if (!intentOk(`${c.name} ${c.joiningFee || ''} ${c.annualFee || ''}`, plan.intents)) continue;
    const ciSlug = PB_TO_CI[t.b] || t.b;
    const item = pbToRawItem(c, ctx.source, ciSlug, r.body);
    const official = await resolveBankCardUrl(ciSlug, c.name);
    if (official) { item.sellerUrl = official; (item.attributes as any).official_page = official; }
    out.push(item);
    if (out.length >= MAX_CARDS) break;
  }
  if (!out.length) throw new AcquisitionError('EMPTY_RESPONSE', 'No Paisabazaar card page matched this search');
  return out;
}

export const creditCardsWorker: VerticalWorker = {
  vertical: 'creditcards',
  tasks: [
    { sourceId: 'w_creditcards_cardinsider', name: 'Credit cards worker: CardInsider issuer index + card pages (SSR)', priority: 10, timeoutMs: 40_000, run: ciTask },
    { sourceId: 'w_creditcards_paisabazaar', name: 'Credit cards worker: Paisabazaar issuer index + card pages (SSR)', priority: 11, timeoutMs: 40_000, run: pbTask },
    {
      sourceId: 'w_creditcards_bankbazaar', name: 'Credit cards worker: BankBazaar (probe)', priority: 20,
      run: async () => {
        const r = await cffiFetch('https://www.bankbazaar.com/credit-card.html', { impersonate: 'chrome', timeoutMs: 15_000 });
        if (r.status !== 200) throw new AcquisitionError('FORBIDDEN', `BankBazaar HTTP ${r.status}`, r.status);
        if (looksLikeChallenge(r.body)) throw new AcquisitionError('ACCESS_CHALLENGE', 'BankBazaar presented a challenge page');
        throw new AcquisitionError('EMPTY_RESPONSE', 'BankBazaar credit-card hub is a client-rendered list: it publishes card names but no per-card fee or reward table to browserless HTTP.');
      },
    },
  ],
};

export { BANK_NAMES };
registerVerticalWorker(creditCardsWorker);
