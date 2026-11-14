/**
 * A REAL, DISTINCT PHOTO FOR EACH NEARBY CARD (owner 14 Nov: "all are showing same images ... you can use
 * images available on google for these nearby cinemas, stall").
 *
 * The old behaviour was one shared category tile per vertical, so nine cinema cards showed the same seats photo.
 * This module gives each place its own photo without a Google key and without inventing anything:
 *
 *   tier A - evidence carried by the place itself: OSM `image`, `wikimedia_commons`, `wikidata` (P18),
 *            `wikipedia` (page image). That is a photo of THAT place, curated by the OSM/Wikipedia community.
 *   tier B - Wikimedia Commons file search, then a Wikipedia article search, on the place's own name. A hit is
 *            only accepted when the file/article title proves the match (distinctive words plus the right kind
 *            of place), so "R Deccan Multiplex" cannot win a sculpture in the Deccan College museum.
 *   tier C - the business page's own og:image (enrich.ogImage, run by the aggregator).
 *   tier D - a labelled CATEGORY TILE, rotated across several files instead of one, so a street of taxi stands
 *            no longer shows nine identical images.
 *
 * Every route is keyless and public. Google Places photos stay supported and are always preferred when
 * GOOGLE_PLACES_API_KEY is configured (aggregator.googleNearby does that); Google's image URLs may not be
 * hotlinked, which is why their API needs the key and this keyless path exists at all.
 *
 * Attribution: Commons files carry a licence, so the credit is built from `extmetadata` and appended to the
 * card's honesty text. Nothing is described as "this place" unless a tier A/B match actually proved it.
 */
import { log } from '../common/logger';
import { bingImages, proxiedImage, imageFetchOk } from './webImages';

/** Words that identify a category or a building type, never a specific place. Stripped before name matching. */
const GENERIC_TOKENS = new Set([
  'cafe', 'cafes', 'coffee', 'restaurant', 'restaurants', 'restro', 'bar', 'pub', 'bakery', 'dessert', 'food',
  'cinema', 'cinemas', 'talkies', 'multiplex', 'theatre', 'theater', 'movie', 'movies', 'cineplex', 'picture',
  'pictures', 'hotel', 'hotels', 'lodge', 'inn', 'residency', 'suites', 'stay', 'stays', 'guest', 'guesthouse',
  'taxi', 'cab', 'cabs', 'auto', 'rickshaw', 'rikshaw', 'stand', 'stop', 'pick', 'pickup', 'drop', 'parking',
  'store', 'stores', 'shop', 'shops', 'mart', 'supermarket', 'mall', 'market', 'complex', 'centre', 'center',
  'the', 'and', 'for', 'near', 'road', 'marg', 'street', 'lane', 'path', 'chowk', 'chawk', 'square', 'nagar',
  'indian', 'india', 'pune', 'mumbai', 'delhi', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'kolkata',
  'limited', 'ltd', 'pvt', 'private', 'service', 'services', 'point', 'main', 'new', 'old', 'best', 'top',
  // street/plot words: "Central Avenue" or "Lane Number 7" is an address, not a business, so a photo whose
  // title merely repeats the address is not evidence of this card's place.
  'avenue', 'cross', 'bypass', 'extension', 'sector', 'block', 'phase', 'colony', 'society', 'layout',
  'enclave', 'circle', 'junction', 'corner', 'gate', 'bridge', 'hills', 'valley', 'number', 'no',
]);

/**
 * Words that must appear in a Commons/Wikipedia title for a one-word name to count as a match. Without this,
 * the single distinctive word of a place ("Deccan") drags in anything else carrying that word.
 */
const CATEGORY_WORDS: Record<string, string[]> = {
  movies: ['cinema', 'talkie', 'theatre', 'theater', 'multiplex', 'cineplex', 'picture', 'hall'],
  cabs: ['taxi', 'cab', 'auto', 'rickshaw', 'rikshaw', 'stand'],
  stores: ['shop', 'store', 'market', 'mart', 'bazaar', 'bazar', 'mall', 'showroom'],
  cafes: ['cafe', 'coffee', 'bakery', 'restaurant'],
  restaurants: ['restaurant', 'dhaba', 'eatery', 'cafe', 'hotel'],
  hotels: ['hotel', 'lodge', 'residency', 'inn', 'suites', 'guest'],
  stays: ['hotel', 'lodge', 'guest', 'homestay', 'residency', 'hostel', 'apartment', 'inn'],
  all: ['cinema', 'hotel', 'restaurant', 'cafe', 'market', 'shop', 'theatre'],
};

/** Subjects that are never a commercial place's own photo, however well the words line up. */
const NOT_A_PLACE = /museum|sculpture|excavat|archaeolog|manuscript|coin|inscription|temple|fort\b|monument|map of|logo|emblem|coat of arms|diagram|postage|stamp\b|panorama of/i;

/** Files that are maps, diagrams or documents, never a place photo. */
const NOT_A_PHOTO = /\.(svg|pdf|tif|tiff|djvu|xcf|webm|ogv|gif)$/i;
const IS_PHOTO = /\.(jpe?g|png|webp)$/i;

export interface PhotoEvidence {
  /** OSM `wikidata` tag: Q123. */
  wikidata?: string | null;
  /** OSM `wikipedia` tag: "en:Alka Talkies" or a bare title. */
  wikipedia?: string | null;
  /** OSM `image` tag: an image URL. */
  imageTag?: string | null;
  /** OSM `wikimedia_commons` tag: "File:Foo.jpg" or "Category:Foo". */
  commonsTag?: string | null;
}

export interface PhotoHit {
  url: string;
  /** The Commons/Wikipedia title the photo came from, kept as evidence for logs and the admin report. */
  sourceTitle?: string;
  /** Honest one-liner about where the photo came from, appended to the card's honesty text. */
  credit: string;
  tier: 'evidence' | 'commons-name' | 'wikipedia-name' | 'web';
}

const UA = 'Try1Second/1.0 (nearby photos; https://try1second.com)';
const COMMONS_WIDTH = 640;

/** Commons file -> a resizable thumbnail on the Wikimedia CDN. */
function commonsFilePath(file: string): string | null {
  const name = String(file || '').replace(/^File:/i, '').trim();
  if (!name || NOT_A_PHOTO.test(name) || !IS_PHOTO.test(name.replace(/\?.*$/, ''))) return null;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=${COMMONS_WIDTH}`;
}

async function getJson(url: string, timeoutMs: number): Promise<any | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.max(600, timeoutMs));
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': UA, accept: 'application/json' },
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function plain(html: unknown): string {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** "Photo from Wikimedia Commons (CC BY-SA 4.0)". Short enough for a card, honest enough for attribution. */
function commonsCredit(meta: any): string {
  const licence = plain(meta?.LicenseShortName?.value).slice(0, 24);
  return licence ? `Photo from Wikimedia Commons (${licence}).` : 'Photo from Wikimedia Commons.';
}

/** Distinctive words of a place name, lowercased; empty when the name is only category words. */
function nameTokens(name: string): string[] {
  return String(name || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !GENERIC_TOKENS.has(t) && !/^\d+$/.test(t));
}

/**
 * Does this file/article title actually name the place?
 *  - two or more distinctive words matched: yes ("Marz-O-Rin", "Alka Talkies" when "talkies" is in the title),
 *  - one distinctive word: only when the title ALSO carries the right kind of place ("Alankar Cinema"),
 *  - and never for museum/monument/logo subjects, which share names with places by accident.
 */
function titleMatches(title: string, tokens: string[], category: string | null): boolean {
  if (!tokens.length) return false;
  const lower = String(title || '').toLowerCase();
  if (NOT_A_PLACE.test(lower)) return false;
  const hits = tokens.filter((t) => lower.includes(t));
  const strong = hits.filter((t) => t.length >= 4);
  const catHit = (CATEGORY_WORDS[String(category || 'all')] || CATEGORY_WORDS.all).some((w) => lower.includes(w));
  // Every distinctive word of a multi-word name present: "Marz-O-Rin", "Alka Talkies" -> strongest evidence.
  if (tokens.length >= 2 && hits.length === tokens.length) return true;
  if (strong.length >= 2) return true;
  // One distinctive word is only enough together with the right kind of place ("Alankar Cinema").
  if (strong.length >= 1 && catHit) return true;
  return false;
}

/** ~40 km: a photo/article further than this from the place is a different place with the same name. */
const MAX_KM = 40;
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
/** True when the candidate is provably elsewhere. Unknown coordinates are not a rejection. */
function farAway(origin: { lat: number; lng: number } | null, cand: { lat: number; lng: number } | null): boolean {
  if (!origin || !cand) return false;
  return distanceKm(origin, cand) > MAX_KM;
}

/** 12h in-process cache: a hot city must not re-query Commons on every Nearby open. */
const cache = new Map<string, { hit: PhotoHit | null; at: number }>();
const CACHE_TTL_MS = 12 * 60 * 60_000;

function cacheKey(ev: PhotoEvidence, name: string, city: string | null, category: string | null): string {
  return [ev.wikidata || '', ev.wikipedia || '', ev.imageTag || '', ev.commonsTag || '',
    name.toLowerCase(), (city || '').toLowerCase(), String(category || '')].join('|');
}

/** Wikidata entity -> P18 image file name. */
async function wikidataImage(qid: string, timeoutMs: number): Promise<{ url: string; credit: string } | null> {
  const id = String(qid || '').trim().toUpperCase();
  if (!/^Q\d+$/.test(id)) return null;
  const data = await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`, timeoutMs);
  const claims = data?.entities?.[id]?.claims;
  const files: string[] = [];
  for (const c of Array.isArray(claims?.P18) ? claims.P18 : []) {
    const v = c?.mainsnak?.datavalue?.value;
    if (typeof v === 'string') files.push(v);
  }
  for (const file of files) {
    const url = commonsFilePath(file);
    if (url) return { url, credit: 'Photo from Wikimedia Commons for this place.' };
  }
  return null;
}

/** Wikipedia page image (thumb) for the article about the place. */
async function wikipediaImage(tag: string, timeoutMs: number): Promise<{ url: string; credit: string } | null> {
  const raw = String(tag || '').trim();
  if (!raw) return null;
  const m = raw.match(/^([a-z-]{2,3}):(.+)$/i);
  const lang = m ? m[1].toLowerCase() : 'en';
  const title = (m ? m[2] : raw).replace(/_/g, ' ').trim();
  if (!title) return null;
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail`
    + `&pithumbsize=${COMMONS_WIDTH}&titles=${encodeURIComponent(title)}`;
  const data = await getJson(url, timeoutMs);
  for (const p of Object.values<any>(data?.query?.pages || {})) {
    const src = String(p?.thumbnail?.source || '');
    if (/^https:\/\//i.test(src) && !NOT_A_PHOTO.test(src)) {
      return { url: src, credit: 'Photo from the place\'s Wikipedia article.' };
    }
  }
  return null;
}

/** Search queries for one place, most specific first. */
function searchQueries(name: string, city: string | null, tokens: string[]): string[] {
  const q = [
    city ? `${name} ${city}` : name,
    name,
    city ? `${tokens.slice(0, 3).join(' ')} ${city}` : tokens.slice(0, 3).join(' '),
  ];
  return [...new Set(q.map((x) => x.trim()).filter(Boolean))];
}

/** Commons file search on the place's name; the title filter keeps unrelated photos out. */
async function commonsNameImage(
  name: string, city: string | null, tokens: string[], category: string | null,
  origin: { lat: number; lng: number } | null, timeoutMs: number,
): Promise<PhotoHit | null> {
  if (!tokens.length) return null;
  const seen = new Set<string>();
  for (const query of searchQueries(name, city, tokens)) {
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json'
      + `&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=10`
      + `&prop=imageinfo|coordinates&iiprop=url|extmetadata&iiurlwidth=${COMMONS_WIDTH}`;
    const data = await getJson(url, timeoutMs);
    for (const p of Object.values<any>(data?.query?.pages || {})) {
      const title = String(p?.title || '');
      if (!title || seen.has(title) || NOT_A_PHOTO.test(title) || !IS_PHOTO.test(title)) continue;
      seen.add(title);
      if (!titleMatches(title, tokens, category)) continue;
      const co = Array.isArray(p?.coordinates) ? p.coordinates[0] : null;
      if (farAway(origin, co ? { lat: Number(co.lat), lng: Number(co.lon) } : null)) continue;
      const info = Array.isArray(p?.imageinfo) ? p.imageinfo[0] : null;
      const thumb = String(info?.thumburl || info?.url || '').replace(/[?&]utm_[^&]*/g, '').replace(/\?$/, '');
      if (!/^https:\/\/(upload|thumb)\.wikimedia\.org\//i.test(thumb)) continue;
      return {
        url: thumb,
        credit: `${commonsCredit(info?.extmetadata)} Matched on this place's name.`,
        tier: 'commons-name',
        sourceTitle: title,
      };
    }
  }
  return null;
}

/** Last name route: a Wikipedia article about the place, which almost always carries a photo. */
async function wikipediaSearchImage(
  name: string, city: string | null, tokens: string[], category: string | null,
  origin: { lat: number; lng: number } | null, timeoutMs: number,
): Promise<PhotoHit | null> {
  if (!tokens.length) return null;
  for (const query of searchQueries(name, city, tokens)) {
    const url = 'https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search'
      + `&gsrsearch=${encodeURIComponent(query)}&gsrlimit=6&prop=pageimages|coordinates&piprop=thumbnail&pithumbsize=${COMMONS_WIDTH}`;
    const data = await getJson(url, timeoutMs);
    for (const p of Object.values<any>(data?.query?.pages || {})) {
      const title = String(p?.title || '');
      if (!title || !titleMatches(title, tokens, category)) continue;
      // The article must be provably here: "Apollo Theater" exists in Oberlin, Ohio, and a Pune card must
      // never borrow it. An article without coordinates is not used.
      const co = Array.isArray(p?.coordinates) ? p.coordinates[0] : null;
      if (!co || farAway(origin, { lat: Number(co.lat), lng: Number(co.lon) })) continue;
      const src = String(p?.thumbnail?.source || '');
      if (!/^https:\/\//i.test(src) || NOT_A_PHOTO.test(src)) continue;
      return { url: src, credit: 'Photo from this place\'s Wikipedia article.', tier: 'wikipedia-name', sourceTitle: title };
    }
  }
  return null;
}

/**
 * Last real-photo tier: ask Bing Image Search for the place by name and accept only a result whose indexed
 * title, source page or file path carries the place's distinctive words. Returned through the signed same-origin
 * proxy, so a publisher's hotlink protection cannot break the card.
 */
async function webImageForPlace(
  name: string, city: string | null, tokens: string[], category: string | null, timeoutMs: number,
): Promise<PhotoHit | null> {
  if (!tokens.length) return null;
  const deadline = Date.now() + Math.max(1500, timeoutMs);
  const query = city ? `${name} ${city}` : name;
  const candidates = await bingImages(query, { count: 20, timeoutMs });
  // Web results are noisier than Commons, so they get a stricter test: EVERY distinctive word of the place
  // must appear in the indexed title, page or file path. That is what stops "Limaye Natya-Chitra Mandir" from
  // borrowing a photo of the unrelated Bharat Natya Mandir (only "natya"/"mandir" matched there).
  const strong = tokens.filter((t) => t.length >= 4);
  const required = strong.length ? strong : tokens;
  const ranked: { cand: (typeof candidates)[number]; score: number }[] = [];
  for (const cand of candidates) {
    // The title alone is often the publisher's page name, so the URL path is checked too: a photo filed as
    // "r-deccan-theater.jpg" is evidence even when its page title is just an agency name.
    const haystack = `${cand.title} ${cand.page} ${cand.image}`.toLowerCase();
    if (NOT_A_PLACE.test(haystack)) continue;
    if (!required.every((t) => haystack.includes(t))) continue;
    if (!required.some((t) => t.length >= 5)) continue;
    const score = (haystack.includes(String(city || '').toLowerCase()) ? 2 : 0)
      + tokens.filter((t) => haystack.includes(t)).length;
    ranked.push({ cand, score });
  }
  ranked.sort((a, b) => b.score - a.score);
  // Only a photo we have actually fetched and seen as bytes gets onto a card: the remaining budget goes to the
  // best-ranked candidates until one proves itself, and otherwise the row keeps its labelled tile.
  for (const { cand } of ranked.slice(0, 3)) {
    if (Date.now() > deadline) break;
    const url = proxiedImage(cand.image);
    if (!url) continue;
    if (!(await imageFetchOk(cand.image, Math.max(1200, Math.min(4000, deadline - Date.now()))))) continue;
    return {
      url,
      credit: `Photo matched on the web for this place (${cand.host}).`,
      tier: 'web',
      sourceTitle: cand.title || cand.image,
    };
  }
  return null;
}

/**
 * Resolve one honest photo for a place. Returns null when nothing verifies, so the caller keeps a labelled
 * category tile instead of a wrong photo. `timeoutMs` is the remaining budget for this row.
 */
export async function resolvePlacePhoto(input: {
  name: string; city: string | null; category?: string | null; evidence?: PhotoEvidence; timeoutMs?: number;
  lat?: number | null; lng?: number | null;
}): Promise<PhotoHit | null> {
  const ev = input.evidence || {};
  const city = input.city || null;
  const category = input.category || null;
  const key = cacheKey(ev, input.name, city, category);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.hit;

  const deadline = Date.now() + Math.max(800, Number(input.timeoutMs) || 4000);
  const left = () => Math.max(700, deadline - Date.now());
  const tokens = nameTokens(input.name);
  const origin = Number.isFinite(Number(input.lat)) && Number.isFinite(Number(input.lng))
    ? { lat: Number(input.lat), lng: Number(input.lng) }
    : null;

  let found: PhotoHit | null = null;

  // tier A: the place's own evidence, strongest first.
  const direct = String(ev.imageTag || '').trim();
  if (!found && /^https:\/\/.+\.(jpe?g|png|webp)(\?.*)?$/i.test(direct)) {
    found = { url: direct, credit: 'Photo from this place\'s own OpenStreetMap listing.', tier: 'evidence' };
  }
  if (!found && ev.commonsTag) {
    const url = commonsFilePath(ev.commonsTag);
    if (url) found = { url, credit: 'Photo from Wikimedia Commons for this place.', tier: 'evidence' };
  }
  if (!found && ev.wikidata) {
    const wd = await wikidataImage(ev.wikidata, left());
    if (wd) found = { ...wd, tier: 'evidence' };
  }
  if (!found && ev.wikipedia) {
    const wp = await wikipediaImage(ev.wikipedia, left());
    if (wp) found = { ...wp, tier: 'evidence' };
  }
  // tier B: Commons file search, then a Wikipedia article, both title-verified.
  // Cabs, stores and the mixed feed are mostly ADDRESSES ("Central Avenue", "Lane Number 7", "Taxi drop off
  // stop"), where a single distinctive word proves nothing: "Pune Central mall" is not Central Avenue. Those
  // verticals therefore need at least two distinctive words before a name match is trusted at all.
  const addressLike = category === 'cabs' || category === 'stores' || category === 'all';
  if (!found && (!addressLike || tokens.length >= 2)) {
    found = await commonsNameImage(input.name, city, tokens, category, origin, left());
  }
  if (!found && (!addressLike || tokens.length >= 2)) {
    found = await wikipediaSearchImage(input.name, city, tokens, category, origin, left());
  }
  // tier B2: Bing Image Search (owner 14 Nov), same title test, served through our own proxy.
  if (!found && (!addressLike || tokens.length >= 2)) {
    found = await webImageForPlace(input.name, city, tokens, category, left());
  }

  cache.set(key, { hit: found, at: Date.now() });
  if (cache.size > 1200) {
    // Bounded: drop the oldest third rather than grow without limit for the process lifetime.
    const drop = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 400);
    for (const [k] of drop) cache.delete(k);
  }
  if (found) log.info('nearby', `photo resolved (${found.tier}) for "${input.name}"`, { city });
  return found;
}

/**
 * Rotate the labelled category tiles so the fallback is never nine identical images. Files are picked by a
 * stable hash of the place name, so the same shop keeps the same tile between reloads.
 */
export function categoryTile(category: string, seed: string, tiles: Record<string, string[]>): string {
  const list = tiles[category] || tiles.all || ['/nearby-assets/all.jpg'];
  let h = 0;
  const s = String(seed || '');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return list[h % list.length];
}
