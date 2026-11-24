/**
 * Smart Cart (owner rule): compare a BASKET of grocery products across
 * quick-commerce stores, total it per store, and redirect to the store with
 * the lowest FULL-basket cost. Pure functions — no I/O — so tests pin the
 * whole ranking; the API route feeds them real runSearch offers.
 */
export interface BasketItemIn { name: string; qty?: number }
export interface StoreOfferIn { seller: string; price: number; title: string; url: string | null }

export interface ItemCompare {
  name: string;              // what the user asked for
  qty: number;               // units wanted
  unitPrices: { seller: string; price: number; title: string; url: string | null }[]; // best price per store for THIS product
  found: boolean;
}

export interface StoreTotal {
  seller: string;
  total: number;             // sum of unit price x qty for the items the store carries
  itemsCovered: number;
  itemsMissing: number;      // basket items this store does NOT carry
  missing: string[];         // names of the missing items
  complete: boolean;         // carries the FULL basket
  itemized: { name: string; qty: number; price: number; unitPrice: number; url: string | null }[];
}

export interface BasketComparison {
  items: ItemCompare[];
  stores: StoreTotal[];      // complete stores cheapest-first, then partial
  best?: StoreTotal;         // cheapest FULL basket (undefined when no store has all items)
  savingsVsWorst?: number;   // best complete vs most expensive complete store
  notFound: string[];        // basket items no store returned
}

/** Unit price of a normalized offer (owner bug 22 Oct: `prices.price` does not
 *  exist on normalized offers — effectivePrice/mandatoryTotal do; reading `price`
 *  alone dropped EVERY grocery offer and broke the Smart Cart basket compare). */
export function unitPriceOf(o: { prices?: Record<string, unknown> } | null | undefined): number {
  const p = (o && o.prices) || {};
  return Number(
    (p as any).effectivePrice ?? (p as any).mandatoryTotal ?? (p as any).finalPayablePrice ?? (p as any).price ?? 0,
  ) || 0;
}

/** Normalize 'Amul Butter 100 g' == 'Amul Butter - 100g' for grouping. */
export function groceryProductKey(title: string): string {
  return String(title || '')
    .toLowerCase()
    // packaging/qualifier parentheticals ('(old)', '(Pack of 2)') vary per store;
    // they are dropped so the same product+size groups together.
    .replace(/\([^)]*\)/g, ' ')
    .replace(/&/g, ' and ')
    // glue a number to its unit so '100 g' == '100g'
    .replace(/(\d)\s*(g|gm|gram|grams|kg|ml|l|ltr|litre|liter|litre|pc|pcs|piece|pieces|pack|pk)\b/g, '$1$2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Query tokens used to keep only offers that are actually the searched product. */
export function queryTokens(name: string): string[] {
  const stop = new Set(['the', 'a', 'an', 'of', 'for', 'best', 'cheap', 'price', 'buy', 'order', 'online']);
  return groceryProductKey(name).split(' ').filter((t) => t && !stop.has(t));
}

/**
 * From one product's raw offers, pick the product group (same normalized
 * title) that best matches the query — the group with the most matching
 * tokens, tie-broken by most sellers then cheapest price. Returns the best
 * per-store unit price for that product.
 */
export function bestUnitPricesPerStore(name: string, offers: StoreOfferIn[]):
  { unitPrices: ItemCompare['unitPrices']; foundTitle: string | null } {
  const want = queryTokens(name);
  const groups = new Map<string, StoreOfferIn[]>();
  for (const o of offers) {
    const key = groceryProductKey(o.title);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(o);
  }
  let bestKey: string | null = null;
  let bestScore = -1;
  const scored: { key: string; match: number; sellers: number; min: number }[] = [];
  for (const [key, rows] of groups) {
    const words = new Set(key.split(' '));
    const match = want.filter((t) => words.has(t)).length;
    if (match === 0 && want.length > 0) continue;   // not the searched product
    const sellers = new Set(rows.map((r) => r.seller)).size;
    const min = Math.min(...rows.filter((r) => r.price > 0).map((r) => r.price), Infinity);
    scored.push({ key, match, sellers, min });
  }
  if (scored.length) {
    scored.sort((a, b) => (b.match - a.match) || (b.sellers - a.sellers) || ((a.min === Infinity ? 1e12 : a.min) - (b.min === Infinity ? 1e12 : b.min)));
    bestKey = scored[0].key;
    bestScore = scored[0].match;
  }
  if (!bestKey) return { unitPrices: [], foundTitle: null };
  // Per store: cheapest offer of that product on that store.
  const perStore = new Map<string, { price: number; title: string; url: string | null }>();
  for (const o of groups.get(bestKey)!) {
    if (!(o.price > 0)) continue;                     // honest: no price, no entry
    const cur = perStore.get(o.seller);
    if (!cur || o.price < cur.price) perStore.set(o.seller, { price: o.price, title: o.title, url: o.url });
  }
  const unitPrices = Array.from(perStore.entries())
    .map(([seller, v]) => ({ seller, price: v.price, title: v.title, url: v.url }))
    .sort((a, b) => a.price - b.price);
  return { unitPrices, foundTitle: bestKey ? (groups.get(bestKey)![0]?.title || null) : null };
}

/**
 * Rank every store by FULL-basket total. Complete stores (carry every item)
 * come first, cheapest-first; partial stores follow honestly with their
 * missing list. best = cheapest complete store; savings vs the dearest
 * complete store. Pure + deterministic.
 */
export function computeStoreTotals(items: ItemCompare[]): BasketComparison {
  const notFound = items.filter((i) => !i.found).map((i) => i.name);
  const storeNames = new Set<string>();
  for (const it of items) for (const u of it.unitPrices) storeNames.add(u.seller);

  const stores: StoreTotal[] = [];
  for (const seller of storeNames) {
    let total = 0; let itemsCovered = 0;
    const missing: string[] = [];
    const itemized: StoreTotal['itemized'] = [];
    for (const it of items) {
      const q = it.qty > 0 ? it.qty : 1;
      const match = it.unitPrices.find((u) => u.seller === seller);
      if (match) {
        total += match.price * q;
        itemsCovered += 1;
        itemized.push({ name: it.name, qty: q, price: match.price * q, unitPrice: match.price, url: match.url });
      } else {
        missing.push(it.name);
      }
    }
    stores.push({ seller, total, itemsCovered, itemsMissing: missing.length, missing, complete: missing.length === 0, itemized });
  }

  const complete = stores.filter((s) => s.complete).sort((a, b) => a.total - b.total);
  const partial = stores.filter((s) => !s.complete).sort((a, b) => b.itemsCovered - a.itemsCovered || a.total - b.total);
  const best = complete[0];
  const worst = complete.length > 1 ? complete[complete.length - 1] : undefined;
  return {
    items,
    stores: [...complete, ...partial],
    best,
    savingsVsWorst: best && worst ? Math.max(0, Math.round((worst.total - best.total) * 100) / 100) : undefined,
    notFound,
  };
}

/**
 * OWNER 24 Nov ("smart cart 10-min grocery mai smart comparison kre mtlb agar maine aloo pyaaz add kiya tho wo
 * bataye cart mai ki sbse sasta blinkit mai hai yaa zepto mai aise"): the store cards already rank the basket, but
 * the shopper had to read four cards and work out the answer. This turns the ranking into ONE sentence both clients
 * print verbatim, so the website and the app can never phrase the same basket differently.
 *
 * Pure + deterministic: every number comes from the comparison, nothing is estimated.
 */
export interface BasketVerdict {
  kind: 'complete' | 'partial' | 'empty';
  /** The store to shop at, or null when no store priced anything. */
  store: string | null;
  total: number | null;
  /** Runner-up complete store, when a second one carries the whole basket. */
  nextStore: string | null;
  nextTotal: number | null;
  /** Rupees the winner saves on the SAME basket versus the runner-up. */
  savesVsNext: number | null;
  headline: string;
  detail: string;
}

const rupees = (n: number) => `\u20B9${Math.round(n).toLocaleString('en-IN')}`;

export function basketVerdict(c: BasketComparison): BasketVerdict {
  const complete = c.stores.filter((s) => s.complete);          // already cheapest-first
  const best = complete[0];
  const items = c.items.length;

  if (best) {
    const next = complete[1] || null;
    const saves = next ? Math.round((next.total - best.total) * 100) / 100 : null;
    return {
      kind: 'complete',
      store: best.seller,
      total: best.total,
      nextStore: next ? next.seller : null,
      nextTotal: next ? next.total : null,
      savesVsNext: saves != null && saves > 0 ? saves : null,
      headline: `Cheapest full basket: ${best.seller} \u2014 ${rupees(best.total)}`,
      detail: next
        ? saves != null && saves > 0
          ? `${rupees(saves)} less than ${next.seller} for the same ${items} item${items > 1 ? 's' : ''}.`
          : `${next.seller} costs the same for this basket.`
        : `The only store carrying all ${items} item${items > 1 ? 's' : ''} right now.`,
    };
  }

  // Nobody carries everything: say who gets closest instead of leaving the shopper to compare cards.
  const priced = c.stores.filter((s) => s.itemsCovered > 0)
    .sort((a, b) => b.itemsCovered - a.itemsCovered || a.total - b.total);
  const closest = priced[0];
  if (!closest) {
    return {
      kind: 'empty', store: null, total: null, nextStore: null, nextTotal: null, savesVsNext: null,
      headline: 'No store returned a price for this basket right now.',
      detail: 'Try a shorter product name (\u201catta\u201d instead of \u201cAashirvaad atta 5 kg\u201d) and compare again.',
    };
  }
  const missing = closest.missing.slice(0, 3).join(', ') + (closest.missing.length > 3 ? '\u2026' : '');
  return {
    kind: 'partial',
    store: closest.seller,
    total: closest.total,
    nextStore: null,
    nextTotal: null,
    savesVsNext: null,
    headline: `No single store has the whole basket. Closest: ${closest.seller} \u2014 ${closest.itemsCovered}/${items} items, ${rupees(closest.total)}`,
    detail: `Still missing there: ${missing}. The totals below show what each store does and does not carry.`,
  };
}
