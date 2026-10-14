/**
 * Lender / issuer / insurer logo resolver. A loan, insurance or credit-card offer must show the logo
 * of the INSTITUTION it is for (Axis Bank, Union Bank of India...), never the comparison website that
 * listed it (BankBazaar...). Real logos only: Wikidata property P154 ("logo image") -> Wikimedia Commons
 * file, rendered as a PNG thumbnail through Commons' own Special:FilePath. Nothing is invented: when
 * Wikidata has no logo for the institution the caller falls back to the institution's own site icon
 * (brandImage.ts) and finally to the UI's initials badge.
 *
 * Results (including honest misses) are cached in memory and persisted to a JSON file so shared hosting
 * pays the lookup once per institution, never per search.
 */
import fs from 'node:fs';
import path from 'node:path';

const UA = 'Try1Second/1.0 (contact: standardpetro.in@gmail.com)';
const CACHE_FILE = path.join(process.cwd(), 'data', 'lender-logos.json');
const MISS_TTL_MS = 7 * 86_400_000;       // retry an unresolved institution weekly
const FETCH_TIMEOUT_MS = 4_000;

type Entry = { url: string | null; at: number };
let cache: Record<string, Entry> | null = null;
const inflight = new Map<string, Promise<string | null>>();

function load(): Record<string, Entry> {
  if (cache) return cache;
  try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { cache = {}; }
  return cache!;
}
let saveTimer: NodeJS.Timeout | null = null;
function persist() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try { fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true }); fs.writeFileSync(CACHE_FILE, JSON.stringify(cache || {})); } catch { /* read-only FS: memory cache only */ }
  }, 1500);
}

/** Canonical institution name from an offer title: "Axis Bank Personal Loan" -> "Axis Bank". */
export function lenderNameFrom(raw: string): string {
  return String(raw || '')
    .replace(/\b(personal|home|car|auto|business|gold|education|two[- ]wheeler|bike|used car|property|credit card|loan|loans|insurance|health|term|life|motor|travel|plan|policy|emi|interest rates?|rates?)\b/gi, ' ')
    .replace(/[|:–—-].*$/, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

async function getJson(url: string): Promise<any> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

// Short market names -> full legal entity names so Wikidata finds the right institution.
const LENDER_ALIAS: Record<string, string> = {
  sbi: 'State Bank of India', pnb: 'Punjab National Bank', bob: 'Bank of Baroda',
  hdfc: 'HDFC Bank', hdfcl: 'HDFC Bank', icici: 'ICICI Bank', idbi: 'IDBI Bank',
  idfc: 'IDFC First Bank', 'idfc first': 'IDFC First Bank', hdbfs: 'HDB Financial Services',
  'hdb financial': 'HDB Financial Services', kotak: 'Kotak Mahindra Bank', iob: 'Indian Overseas Bank',
  ubi: 'Union Bank of India', lic: 'Life Insurance Corporation', canara: 'Canara Bank',
  union: 'Union Bank of India', axis: 'Axis Bank', 'yes bank': 'Yes Bank',
};

async function lookup(nameRaw: string): Promise<string | null> {
  const name = LENDER_ALIAS[nameRaw.toLowerCase()] || nameRaw;
  // Prefer a banking / insurance / finance entity: search a few candidates, take the first with a logo (P154).
  const s = await getJson(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&limit=5&search=${encodeURIComponent(name)}`);
  const ids: string[] = (s?.search || []).map((x: any) => x.id).filter(Boolean);
  if (!ids.length) return null;
  const e = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|descriptions&ids=${ids.join('|')}`);
  for (const id of ids) {
    const ent = e?.entities?.[id];
    const desc = String(ent?.descriptions?.en?.value || '').toLowerCase();
    // Skip homonyms that are clearly not a financial institution (films, people, places...)
    if (desc && !/(bank|insur|financ|lender|nbfc|credit|loan|capital|assurance|fintech|company|corporation|holding)/.test(desc)) continue;
    const file = ent?.claims?.P154?.[0]?.mainsnak?.datavalue?.value;
    if (file) return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(String(file).replace(/ /g, '_'))}?width=256`;
  }
  return null;
}

/** Real logo URL for the institution, or null. Never throws, never blocks longer than the fetch timeout. */
export function resolveLenderLogo(rawName: string): Promise<string | null> {
  const name = lenderNameFrom(rawName);
  if (name.length < 3) return Promise.resolve(null);
  const key = name.toLowerCase();
  const c = load();
  const hit = c[key];
  if (hit && (hit.url || Date.now() - hit.at < MISS_TTL_MS)) return Promise.resolve(hit.url);
  const running = inflight.get(key);
  if (running) return running;
  const p = lookup(name)
    .catch(() => null)
    .then((url) => { c[key] = { url, at: Date.now() }; persist(); return url; })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
