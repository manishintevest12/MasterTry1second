/**
 * IMDb rating enrichment — movies vertical.
 *
 * Two-step, fully public, no API key:
 *  1) Wikidata wbsearchentities -> exact-ish film entity, then wbgetentities for the
 *     P345 (IMDb ID) claim → "tt…".
 *  2) IMDb official datasets file (datasets.imdbws.com/title.ratings.tsv.gz) —
 *     downloaded at most once per week to /tmp and streamed once per process,
 *     giving averageRating + numVotes for the tconst.
 *
 * Every failure returns null and the caller simply omits the rating (honest skip).
 */
import { createGunzip } from 'node:zlib';
import { createWriteStream, existsSync, statSync, createReadStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import readline from 'node:readline';

const RATINGS_URL = 'https://datasets.imdbws.com/title.ratings.tsv.gz';
const RATINGS_FILE = join(tmpdir(), 'imdb-title-ratings.tsv.gz');
const RATINGS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface RatingRow { rating: number; votes: number; at: number }
const ratingCache = new Map<string, RatingRow | null>(); // tconst -> row (null = known-absent)
const titleCache = new Map<string, { tt: string; at: number } | null>(); // normalized title -> tt id
let tconstIndex: Map<string, [number, number, number]> | null = null; // tconst -> [fileOffset?] streamed per lookup
let datasetReady: Promise<boolean> | null = null;

async function fetchWithTimeout(url: string, ms: number, init: RequestInit = {}): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Ensure the ratings dataset exists locally and is fresh. */
async function ensureDataset(): Promise<boolean> {
  try {
    const stale = !existsSync(RATINGS_FILE) || Date.now() - statSync(RATINGS_FILE).mtimeMs > RATINGS_TTL_MS;
    if (!stale) return true;
    const res = await fetchWithTimeout(RATINGS_URL, 60_000);
    if (!res.ok || !res.body) return existsSync(RATINGS_FILE);
    await pipeline(res.body, createWriteStream(RATINGS_FILE));
    tconstIndex = null; // new file invalidates any index
    return true;
  } catch {
    return existsSync(RATINGS_FILE);
  }
}

function datasetPromise(): Promise<boolean> {
  datasetReady ??= ensureDataset().finally(() => { setTimeout(() => { datasetReady = null; }, 60_000).unref?.(); });
  return datasetReady;
}

/** Stream the gzipped TSV once and cache the rows for the wanted tconsts. */
async function lookupTconst(tt: string): Promise<RatingRow | null> {
  if (ratingCache.has(tt)) return ratingCache.get(tt)!;
  if (!(await datasetPromise())) { ratingCache.set(tt, null); return null; }
  const wanted = new Set([tt]);
  for (const k of ratingCache.keys()) if (k) wanted.add(k);
  return new Promise((resolve) => {
    let found: RatingRow | null = null;
    const rl = readline.createInterface({ input: createReadStream(RATINGS_FILE).pipe(createGunzip()) });
    rl.on('line', (line: string) => {
      const tab = line.indexOf('\t');
      if (tab <= 0) return;
      const id = line.slice(0, tab);
      if (!wanted.has(id)) return;
      const rest = line.slice(tab + 1).split('\t');
      const rating = Number(rest[0]);
      const votes = Number(rest[1]);
      if (Number.isFinite(rating) && rating > 0) {
        ratingCache.set(id, { rating, votes: Number.isFinite(votes) ? votes : 0, at: Date.now() });
        if (id === tt) found = ratingCache.get(tt)!;
      }
    });
    rl.on('close', () => {
      if (!ratingCache.has(tt)) ratingCache.set(tt, null);
      resolve(found);
    });
    rl.on('error', () => { ratingCache.set(tt, null); resolve(null); });
  });
}

const normTitle = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Resolve a movie title to its IMDb tconst via Wikidata (P345). Cached 24h. */
export async function imdbTconst(title: string): Promise<string | null> {
  const key = normTitle(title);
  if (!key) return null;
  const hit = titleCache.get(key);
  if (hit !== undefined) {
    if (hit === null) return null;
    return Date.now() - hit.at < CACHE_TTL_MS ? hit.tt : null;
  }
  try {
    const s = await fetchWithTimeout(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&uselang=en&type=item&limit=5&search=${encodeURIComponent(title)}`,
      10_000,
    );
    if (!s.ok) { titleCache.set(key, null); return null; }
    const sj = await s.json() as any;
    const candidates: any[] = sj?.search || [];
    // Prefer a hit that looks like a film entity (description mentions film/movie)
    const filmish = candidates.filter((c) => /film|movie|motion picture/i.test(String(c?.description || '')));
    const pick = (filmish[0] || candidates[0])?.id;
    if (!pick) { titleCache.set(key, null); return null; }
    const e = await fetchWithTimeout(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&ids=${encodeURIComponent(pick)}&props=claims`,
      10_000,
    );
    if (!e.ok) { titleCache.set(key, null); return null; }
    const ej = await e.json() as any;
    const claims = ej?.entities?.[pick]?.claims || {};
    const p345 = claims?.P345?.[0]?.mainsnak?.datavalue?.value;
    const tt = typeof p345 === 'string' && /^tt\d+$/.test(p345) ? p345 : null;
    titleCache.set(key, tt ? { tt, at: Date.now() } : null);
    return tt;
  } catch {
    titleCache.set(key, null);
    return null;
  }
}

export interface ImdbRating { tt: string; rating: number; votes: number }

/** IMDb average rating for a title, or null when unresolvable (never invented). */
export async function imdbRatingFor(title: string): Promise<ImdbRating | null> {
  try {
    const tt = await imdbTconst(title);
    if (!tt) return null;
    const row = await lookupTconst(tt);
    if (!row || Date.now() - row.at > CACHE_TTL_MS) {
      // ratings drift slowly; refresh lazily but serve stale value meanwhile
      if (row) return { tt, rating: row.rating, votes: row.votes };
    }
    if (!row) return null;
    return { tt, rating: row.rating, votes: row.votes };
  } catch {
    return null;
  }
}
