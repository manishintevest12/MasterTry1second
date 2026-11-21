/**
 * Two shelves, one question (owner 20 Nov).
 *
 * OWNER: "ai mai dosa jb search hota hai tho result sirf grocery se aaya jb ki dosa food section
 * mai v hota hai waha se v aana chaiye waise hi jb rice daalte hai tho result rice ka aag aata hai
 * raw rice ka alag aata hai. ai itna intelligent hona chaiye ki wo excat results de aur samje user
 * kya maang raha hoga."
 *
 * Measured before this file existed: "dosa" answered from the grocery shelf only (dosa batter and
 * instant mix), and "rice" answered only as raw grain, because the assistant runs exactly ONE
 * vertical per question. Both words genuinely live on two shelves, so a single-vertical answer is a
 * wrong answer: the user sees half of what they asked for and concludes the AI did not understand.
 *
 * The rule here is deliberately narrow and honest:
 *   - the SECOND shelf is only ever ADDED, never substituted; the primary vertical keeps deciding
 *     the headline price, so every existing route and reply stays exactly as it was,
 *   - a row is shown only when the pipeline actually returned it with a real price (the site-wide
 *     "No Price, No Card" rule is untouched),
 *   - the reply says which shelf each price came from, so "raw rice ₹52" and "rice plate ₹120" can
 *     never be read as the same product.
 *
 * Pure functions only, so the merge and the copy are unit-testable without network.
 */
import type { AssistantRow } from './assistantAnswer';

/** The two verticals an ambiguous word is priced in, in display order. */
export interface DualPair {
  primary: string;
  secondary: string;
}

const LABEL: Record<string, string> = {
  grocery: '10-minute grocery',
  food: 'food delivery',
  ecommerce: 'shopping',
};

function labelOf(vertical: string): string {
  return LABEL[vertical] || vertical;
}

const inr = (n: number, currency = 'INR'): string =>
  `${(currency || 'INR').toUpperCase() === 'INR' ? '₹' : ''}${Math.round(n).toLocaleString('en-IN')}`;

/** The cheapest priced row of a shelf, or null when that shelf answered nothing priced. */
function cheapest(rows: AssistantRow[]): AssistantRow | null {
  let best: AssistantRow | null = null;
  for (const r of rows) {
    if (!r.priceAvailable || !Number.isFinite(r.price) || r.price <= 0) continue;
    if (!best || r.price < best.price) best = r;
  }
  return best;
}

/**
 * One shelf's one-line summary: "raw rice from ₹52 on Blinkit".
 * The shelf label is what makes the two answers distinguishable, so it is always present.
 */
function shelfLine(vertical: string, rows: AssistantRow[], what: string): string | null {
  if (!rows.length) return null;
  const best = cheapest(rows);
  const sellers = new Set(rows.map((r) => String(r.provider || '').trim()).filter(Boolean));
  const where = labelOf(vertical);
  if (!best) {
    return `${what} on the ${where} apps: ${rows.length} listing${rows.length === 1 ? '' : 's'} (price on the seller's page).`;
  }
  const sellerCount = sellers.size || rows.length;
  return `${what} on the ${where} apps from ${inr(best.price, best.currency)}${best.provider ? ` on ${best.provider}` : ''} (${rows.length} option${rows.length === 1 ? '' : 's'} from ${sellerCount} site${sellerCount === 1 ? '' : 's'})`;
}

/**
 * The sentence for a question that belongs on two shelves.
 * Names both prices when both answered, says plainly which shelf stayed silent when one did, and
 * never turns a missing shelf into an invented one.
 */
export function dualReply(
  pair: DualPair,
  query: string,
  primaryRows: AssistantRow[],
  secondaryRows: AssistantRow[],
  opts: { pending?: boolean; primaryWhat?: string; secondaryWhat?: string } = {},
): string {
  const whatPrimary = opts.primaryWhat || `"${query}"`;
  const whatSecondary = opts.secondaryWhat || `"${query}"`;
  const a = shelfLine(pair.primary, primaryRows, whatPrimary);
  const b = shelfLine(pair.secondary, secondaryRows, whatSecondary);
  const pendingTxt = opts.pending ? ' More sellers are still answering and the prices fill in here automatically.' : '';
  if (a && b) return `"${query}" is on both shelves. ${a}. ${b}. Both are below, grouped by shelf.${pendingTxt}`;
  if (a) return `${a}. Nothing priced came back from the ${labelOf(pair.secondary)} apps for this pass, so it is not shown as if it had.${pendingTxt}`;
  if (b) return `${b}. Nothing priced came back from the ${labelOf(pair.primary)} apps for this pass, so it is not shown as if it had.${pendingTxt}`;
  return `No live price for "${query}" came back from either the ${labelOf(pair.primary)} or the ${labelOf(pair.secondary)} apps in this pass.${pendingTxt}`;
}

/**
 * Merge the two shelves into one grid: the primary shelf's rows first (so the headline answer keeps
 * leading), then the secondary shelf's, each row carrying the vertical it actually came from so the
 * card can be labelled honestly.
 */
export function mergeDualRows(
  primaryRows: AssistantRow[],
  secondaryRows: AssistantRow[],
  pair: DualPair,
  limit = 10,
): AssistantRow[] {
  const out: AssistantRow[] = [];
  const seen = new Set<string>();
  const push = (rows: AssistantRow[], vertical: string) => {
    for (const r of rows) {
      const key = `${String(r.provider || '').toLowerCase()}|${String(r.title || '').toLowerCase().replace(/[^a-z0-9]/g, '')}|${r.price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...r, vertical });
      if (out.length >= limit) return;
    }
  };
  // Half the grid to each shelf when both answered, so one shelf cannot crowd out the other -
  // that is exactly the complaint ("result sirf grocery se aaya").
  const primaryBudget = secondaryRows.length ? Math.max(4, Math.ceil(limit * 0.6)) : limit;
  push(primaryRows, pair.primary);
  if (out.length > primaryBudget) out.length = primaryBudget;
  push(secondaryRows, pair.secondary);
  return out.slice(0, limit);
}
