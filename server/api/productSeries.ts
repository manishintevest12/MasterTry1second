/**
 * MODEL SERIES (owner 16 Nov: "maine product page section mai reno 16 dala tho result sirf reno 16 ka aaya
 * jb ki results oppo reno 16 ka pura aana chaiye").
 *
 * A typed model name is almost never one product. "reno 16" is a SERIES: Reno 16, Reno 16 5G, Reno 16c, each of
 * them in 8/128, 8/256, 12/256 and four colours. The comparison column correctly refuses to mix configurations -
 * a 12/256 price is not the price of the 8/256 phone - but that strictness, on its own, answered the query with a
 * single row and hid the rest of the range in "related products".
 *
 * So the page now also carries the SERIES: every distinct model+variant we hold real prices for, grouped so each
 * configuration keeps its own cheapest price and seller list. Nothing is merged that a shopper would not merge, and
 * nothing is invented: a variant with no verified price is not listed.
 */
import { getStore } from '../common/db';
import { log } from '../common/logger';

export interface SeriesSeller { seller: string; price: number; url: string | null }

export interface SeriesVariant {
  key: string;
  /** The model as the shops write it, trimmed before the configuration part. */
  name: string;
  /** "8 GB / 256 GB", "12 GB / 256 GB", or "" when the listing does not state one. */
  config: string;
  cheapest: number;
  high: number;
  sellers: SeriesSeller[];
  sellerCount: number;
  image: string | null;
}

export interface Series {
  label: string;
  variants: SeriesVariant[];
  total: number;
}

/** Words that never identify a model. */
const NOISE = new Set([
  'the', 'and', 'with', 'for', 'from', 'buy', 'best', 'new', 'price', 'prices', 'india', 'online', 'offer',
  'offers', 'sale', 'deal', 'deals', 'free', 'combo', 'bundle', 'launched', 'latest', 'mobile', 'mobiles',
  'phone', 'phones', 'smartphone', 'smartphones', 'cellphone', 'cell', 'gb', 'tb', 'ram', 'rom', 'storage',
  'internal', 'memory', 'inch', 'display', 'camera', 'battery', 'edition', 'series', 'box', 'pack',
]);

/** Colour / finish words: two phones in different colours are the same configuration. */
const COLOUR = /\b(starry|twilight|violet|purple|lavender|white|black|blue|green|gold|silver|grey|gray|red|pink|orange|yellow|brown|titan|titanium|midnight|sierra|coral|mint|cream|aqua|marble|graphite|obsidian|sapphire|pearl|ice|glacier|phantom|mystic|chrome|bronze|copper|cyan|teal|indigo|beige|opal|jade|jazz|spark|shimmer|sunset|dawn|desert|forest|ocean|neon)\b/;

function words(s: string): string[] {
  return String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** The identity words a query is really asking for: "oppo reno 16 5g" -> [oppo, reno, 16]. */
export function queryIdentity(query: string): string[] {
  const out: string[] = [];
  for (const w of words(query)) {
    if (w.length < 2 || NOISE.has(w)) continue;
    // a bare capacity in the query is a configuration, not the model
    if (/^\d+\s*(gb|tb)$/.test(w) || /^(gb|tb)$/.test(w)) continue;
    out.push(w);
    if (out.length >= 4) break;
  }
  return out;
}

/** Capacities stated by a title, normalised ("256 GB" / "256gb" -> "256gb"). */
function capacities(title: string): string[] {
  const out = new Set<string>();
  for (const m of String(title || '').matchAll(/\b(\d{2,4})\s?(gb|tb)\b/gi)) out.add(`${m[1]}${m[2].toLowerCase()}`);
  return [...out];
}

/** The model part of a title, before any configuration: "OPPO Reno16 5G (8GB/256GB, Violet)". */
function modelName(title: string): string {
  // Capacities are stripped WHOLE ("256 GB"), not word by word: the number alone ("Oppo Reno16c 256") would
  // otherwise become part of the model name.
  const head = String(title || '').split(/[,(|–-]/)[0].replace(/\b\d{2,4}\s?(gb|tb)\b/gi, ' ');
  const keep: string[] = [];
  for (const w of words(head)) {
    if (NOISE.has(w) || /^\d{2,4}(gb|tb)$/.test(w)) continue;
    if (COLOUR.test(w)) continue;
    keep.push(w);
  }
  const name = keep.join(' ').trim().replace(/\b5g\b/gi, '5g');
  return name || head.trim().slice(0, 48);
}

/**
 * One variant per model + configuration. Key deliberately drops colour and listing filler, because a violet and a
 * white 8/256 are the same phone at the same price tier.
 */
export function variantOf(title: string): { key: string; name: string; config: string } {
  const name = modelName(title);
  const caps = capacities(title).sort();
  const config = caps.length >= 2 ? `${caps[0].replace('gb', ' GB').replace('tb', ' TB')} / ${caps[1].replace('gb', ' GB').replace('tb', ' TB')}`
    : caps.length === 1 ? caps[0].replace('gb', ' GB').replace('tb', ' TB') : '';
  const pretty = name.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\b5g\b/gi, '5G');
  return { key: `${name}|${caps.join('+')}`, name: pretty, config };
}

/** Title contains every identity word as a whole word (so "16" never matches "160"). */
function hasAllWords(title: string, identity: string[]): boolean {
  const t = String(title || '').toLowerCase();
  return identity.every((w) => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(t));
}

interface RawRow { title: string; seller: string; price: number; url: string | null }

async function rowsFor(identity: string[], limit: number): Promise<RawRow[]> {
  const store = getStore();
  if (store.kind !== 'mysql') return [];
  // The two most selective words carry the LIKE; the rest are verified exactly in JS below.
  const likeWords = identity.filter((w) => w.length >= 3).slice(0, 2);
  if (!likeWords.length) return [];
  let where = "vertical IN ('ecommerce','grocery') AND validation_status != 'INVALID' AND COALESCE(effective_price, mandatory_total) > 0 AND fetched_at > NOW() - INTERVAL 21 DAY";
  const params: unknown[] = [];
  for (const w of likeWords) { where += ' AND title LIKE ?'; params.push(`%${w}%`); }
  params.push(limit);
  return store.query<RawRow>(
    `SELECT title, COALESCE(vendor, seller) AS seller, COALESCE(effective_price, mandatory_total) AS price, seller_url AS url
       FROM offers WHERE ${where} ORDER BY fetched_at DESC LIMIT ?`,
    params,
  );
}

/**
 * Build the series for a typed query. Never throws and never invents: an empty series simply means the catalogue
 * has no priced listings beyond what the comparison already showed.
 */
export async function buildSeries(query: string, opts: { limit?: number } = {}): Promise<Series | null> {
  const identity = queryIdentity(query);
  if (!identity.length) return null;
  try {
    const rows = await rowsFor(identity, opts.limit ?? 800);
    const byKey = new Map<string, SeriesVariant>();
    for (const r of rows) {
      const title = String(r.title || '').trim();
      const price = Number(r.price) || 0;
      const seller = String(r.seller || '').trim();
      if (!title || !seller || price <= 0) continue;
      if (!hasAllWords(title, identity)) continue;
      const v = variantOf(title);
      const existing = byKey.get(v.key);
      if (existing) {
        const prev = existing.sellers.find((s) => s.seller.toLowerCase() === seller.toLowerCase());
        if (!prev) existing.sellers.push({ seller, price, url: r.url || null });
        else if (price < prev.price) { prev.price = price; prev.url = r.url || prev.url; }
        continue;
      }
      byKey.set(v.key, { key: v.key, name: v.name, config: v.config, cheapest: price, high: price, sellers: [{ seller, price, url: r.url || null }], sellerCount: 1, image: null });
    }
    const variants = [...byKey.values()].map((v) => {
      v.sellers.sort((a, b) => a.price - b.price);
      v.cheapest = v.sellers[0].price;
      v.high = v.sellers[v.sellers.length - 1].price;
      v.sellerCount = v.sellers.length;
      return v;
    });
    if (variants.length < 2) return null; // one configuration is not a series: the offers column already says it
    // Deepest first (most sellers), then cheapest: the variants a shopper can actually compare.
    variants.sort((a, b) => (b.sellerCount - a.sellerCount) || (a.cheapest - b.cheapest));
    const label = identity.join(' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return { label, variants: variants.slice(0, 12), total: variants.length };
  } catch (e: any) {
    log.debug('Api', 'series build failed (page keeps the offers column)', { error: String(e?.message || e).slice(0, 100) });
    return null;
  }
}
