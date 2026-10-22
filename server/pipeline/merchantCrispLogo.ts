/**
 * Merchant crisp-logo resolver (owner 22 Oct: "logo yaha clearly visible ni hai
 * jaise acer, ajio gram"). Coupon/showcase cards were showing whatever tiny
 * icon the affiliate registry shipped (often a 16px favicon upscaled to 72px —
 * blocky and blurred) or a white-on-white monogram that vanished on the card.
 *
 * Resolution order (highest quality first, all cached to data/merchant-logos.json
 * so shared hosting pays each lookup once):
 *   1. Admin-uploaded logo (merchant_logos registry) — owner-controlled override.
 *   2. Wikidata P154 "logo image" rendered as a 256px Commons PNG — crisp
 *      official brand art (Acer, Ajio, Nykaa, Jockey, Air India, Bewakoof...).
 *   3. Caller's fallback chain (registry icon -> DuckDuckGo -> favicon).
 *
 * Nothing is invented: when Wikidata has no suitable logo the resolver returns
 * null and the caller's fallback stays in place.
 */
import fs from 'node:fs';
import path from 'node:path';

const UA = 'Try1Second/1.0 (contact: standardpetro.in@gmail.com)';
const CACHE_FILE = path.join(process.cwd(), 'data', 'merchant-crisp-logos.json');
const MISS_TTL_MS = 7 * 86_400_000;       // retry an unresolved merchant weekly
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

/** Registry marketing names -> the brand Wikidata knows. */
const MERCHANT_ALIAS: Record<string, string> = {
  'ajio gram': 'Ajio', 'ajio': 'Ajio', 'nykaa fashion': 'Nykaa', 'air india': 'Air India',
  'reliance digital': 'Reliance Retail', 'jiomart': 'JioMart', 'tata cliq': 'Tata CLiQ',
  'tatacliq': 'Tata CLiQ', 'bewakoof': 'Bewakoof.com',
  'the trost': 'Trost', 'trunativ': 'Trunativ', 'acer': 'Acer', 'shyaway': 'Shyaway',
  'jockey': 'Jockey International',
};

/** Strip "The", suffixes and promotional words the registry appends. */
function merchantNameFrom(raw: string): string {
  const cleaned = String(raw || '')
    .replace(/\b(the|official|store|shop|online|india|in)\b/gi, ' ')
    .replace(/[|:–—-].*$/, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 60);
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

/** Merchant-ish Wikidata descriptions only — skip people, films and places. */
const MERCHANT_DESC_RX = /(company|retail|brand|fashion|clothing|e-?commerce|marketplace|store|shop|airline|manufacturer|technology|electronic|food|beverage|beauty|wellness|travel|agency|app|platform|conglomerate|internet|restaurant|service)/i;

async function lookup(nameRaw: string): Promise<string | null> {
  const name = MERCHANT_ALIAS[nameRaw.toLowerCase()] || nameRaw;
  const s = await getJson(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&limit=20&search=${encodeURIComponent(name)}`);
  const results: Array<{ id: string; label?: string }> = (s?.search || []).filter((x: any) => x.id);
  if (!results.length) return null;
  const e = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|descriptions&ids=${results.map((x) => x.id).join('|')}`);
  // Homonym guard (live bug: "Air India" matched Airbus' logo): the entity's own
  // label must contain the merchant's name (case-insensitive) before it is trusted.
  const wantedTokens = name.toLowerCase().split(/\W+/).filter((t) => t.length >= 3);
  for (const r of results) {
    const ent = e?.entities?.[r.id];
    const desc = String(ent?.descriptions?.en?.value || '');
    const label = String(r.label || '').toLowerCase();
    if (desc && !MERCHANT_DESC_RX.test(desc)) continue;
    // Word-wise guard: every token of the SHORTER side must appear in the other.
    // ("Air" must not match "Airbus", but "Nykaa Fashion" may match label "Nykaa".)
    if (label) {
      const labelTokens = label.split(/\W+/).filter((t) => t.length >= 3);
      const shortSide = wantedTokens.length <= labelTokens.length ? wantedTokens : labelTokens;
      const longSide = shortSide === wantedTokens ? labelTokens : wantedTokens;
      if (!shortSide.length || shortSide.some((t) => !longSide.includes(t))) continue;
    }
    const file = ent?.claims?.P154?.[0]?.mainsnak?.datavalue?.value;
    if (file) return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(String(file).replace(/ /g, '_'))}?width=256`;
  }
  return null;
}

/** Real crisp logo URL for the merchant, or null. Never throws; cached (hits AND misses). */
export function resolveMerchantCrispLogo(rawName: string): Promise<string | null> {
  // Alias BEFORE word-stripping: "Air India" must never be reduced to "Air"
  // (live bug: the stripped name matched Airbus' logo).
  const name = MERCHANT_ALIAS[String(rawName || '').trim().toLowerCase()] || merchantNameFrom(rawName);
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

/** Test hook. */
export function _merchantCrispCacheSize(): number {
  return Object.keys(load()).length;
}
