/**
 * BookMyShow parser (browserless reverse engineering, MODULE 3 factory child).
 *
 * Endpoint (reverse-engineered from in.bookmyshow.com production webpack bundles,
 * modules 6161/74318): GET https://in.bookmyshow.com/api/explore/v1/discover/movies-{RegionSlug}
 *   params:  region={RegionCode}&embedded=true
 *   headers: x-app-code: WEB, x-platform-code: DESKTOP-WEB, x-region-code: {RegionCode}, x-bms-id: 1
 *   transport: curl_cffi Safari TLS impersonation (Akamai blocks Node/undici + plain curl with 403).
 * Region code/slug resolve from the public CDN cache in.bmscdn.com/discovery-catalog/response-cache/regions.json.
 *
 * Self-healing hooks (scraper_configs policy): if this endpoint drifts (404/schema),
 * the DynamicScannerEngine re-scans the public JS bundles for the EXPLORE_API_BASE_URL /
 * discovery path constants and updates the config cache — see docs/ + migration 007.
 *
 * Honesty: card payload carries no ticket price (showtimes load only in the booking
 * flow). We emit price-less offers with the real BMS deeplink and real poster; we
 * NEVER invent a price. Strict token matching: when the user searched a movie
 * name, only cards containing every query token survive (owner mandate).
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

const REGIONS_URL = 'https://in.bmscdn.com/discovery-catalog/response-cache/regions.json';
const DISCOVER_BASE = 'https://in.bookmyshow.com/api/explore/v1/discover';
const DEFAULT_REGION = { regionCode: 'BANG', regionSlug: 'bengaluru', regionName: 'Bengaluru' };

export interface BmsRegion {
  regionCode: string;
  regionSlug: string;
  regionName: string;
}

interface RegionsCacheShape {
  at: number;
  regions: BmsRegion[];
  aliases: Map<string, BmsRegion>;
}
let regionsCache: RegionsCacheShape | null = null;

export function normCity(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Resolve a user city to BMS RegionCode + slug from the public CDN region cache (24h TTL). */
export async function resolveBmsRegion(city: string | undefined, fetchJson: (url: string) => Promise<any>): Promise<BmsRegion> {
  const want = normCity(city || '');
  if (!regionsCache || Date.now() - regionsCache.at > 24 * 3600_000) {
    const j = await fetchJson(REGIONS_URL);
    const all: any[] = [...(j?.BookMyShow?.TopCities || []), ...(j?.BookMyShow?.OtherCities || [])];
    const regions: BmsRegion[] = all.map((r) => ({
      regionCode: String(r.RegionCode || ''),
      regionSlug: String(r.RegionSlug || '').toLowerCase(),
      regionName: String(r.RegionName || ''),
    })).filter((r) => r.regionCode && r.regionSlug);
    const aliases = new Map<string, BmsRegion>();
    for (const r of regions) {
      aliases.set(normCity(r.regionName), r);
      const aliasRaw: string[] = Array.isArray(all.find((x) => x.RegionCode === r.regionCode)?.Alias) ? all.find((x) => x.RegionCode === r.regionCode).Alias : [];
      for (const a of aliasRaw) aliases.set(normCity(a), r);
    }
    regionsCache = { at: Date.now(), regions, aliases };
  }
  if (want) {
    const hit = regionsCache.aliases.get(want) || regionsCache.regions.find((r) => normCity(r.regionName).startsWith(want));
    if (hit) return hit;
  }
  return { regionCode: DEFAULT_REGION.regionCode, regionSlug: DEFAULT_REGION.regionSlug, regionName: DEFAULT_REGION.regionName };
}

/** Extract the movie-name tokens from a parsed entity, stripping generic/location words.
 *  "jailer 2 movie tickets bengaluru" -> "jailer 2". Returns '' for browse-style queries. */
export function extractMovieQuery(entity: string, cityTokens: string[]): string {
  const clean = entity.toLowerCase().split(/[^a-z0-9]+/).filter((w) =>
    w && !cityTokens.includes(w) &&
    !['movie', 'movies', 'tickets', 'ticket', 'show', 'shows', 'today', 'now', 'showing', 'near', 'in', 'the', 'latest', 'current'].includes(w));
  return clean.join(' ');
}

/** Strict token matching: every query token must appear in the title (owner mandate, no fuzzy substitutes). */
export function matchesQuery(title: string, query: string): boolean {
  const toks = normCity(query).split(' ').filter((t) => t.length > 1 && !['in', 'near', 'movie', 'movies', 'tickets', 'ticket', 'show', 'shows', 'today', 'now', 'showing'].includes(t));
  if (!toks.length) return true;
  const hay = normCity(title);
  return toks.every((t) => hay.includes(t));
}

export function bmsDiscoverUrl(region: BmsRegion, healedBase?: string | null): string {
  // Self-healing: an override re-derived from the site's public JS bundles (DynamicScannerEngine)
  // wins over the code default when present and well-formed.
  const base = healedBase && /^https:\/\/in\.bookmyshow\.com\//.test(healedBase) ? healedBase.replace(/\/$/, '') : DISCOVER_BASE;
  return `${base}/movies-${region.regionSlug}?region=${encodeURIComponent(region.regionCode)}&embedded=true`;
}

export function bmsDiscoverHeaders(region: BmsRegion): Record<string, string> {
  return {
    Accept: 'application/json',
    'x-app-code': 'WEB',
    'x-platform-code': 'DESKTOP-WEB',
    'x-region-code': region.regionCode,
    'x-bms-id': '1',
  };
}

/** Parse discovery listings into offers. Filtered strictly by the movie query when one was typed. */
export function parseMovieCards(payload: any, source: SourceConfig, region: BmsRegion, query: string, fingerprint: string): RawSourceItem[] {
  const listings: any[] = Array.isArray(payload?.listings) ? payload.listings : [];
  const seen = new Set<string>();
  const out: RawSourceItem[] = [];
  for (const L of listings) {
    for (const card of L?.cards || []) {
      const ctaUrl: string = String(card?.ctaUrl || '');
      if (!ctaUrl.startsWith('https://in.bookmyshow.com/movies/')) continue; // promo/venue cards are not movie offers
      const text: any[] = Array.isArray(card?.text) ? card.text : [];
      const title = String(text[0]?.components?.[0]?.text || '').trim();
      if (!title || title.length > 120) continue;
      const eventCode = String(card?.id || '');
      const key = eventCode || ctaUrl;
      if (seen.has(key)) continue;
      if (query && !matchesQuery(title, query)) continue; // strict token boundary — drop, never substitute
      seen.add(key);
      const poster = String(card?.image?.url || '');
      const cert = String(text[1]?.components?.[0]?.text || '');
      const lang = String(text[2]?.components?.[0]?.text || '');
      out.push(newRawItem(source, {
        title: title.slice(0, 200),
        seller: 'BookMyShow',
        sellerUrl: ctaUrl, // the deeplink goes ONLY to the price-owning platform (owner policy)
        availability: 'in_stock', // now-showing in this region per BMS itself
        location: { city: region.regionName },
        attributes: {
          ...(poster ? { image_url: poster } : {}),
          ...(cert ? { certification: cert } : {}),
          ...(lang ? { language: lang } : {}),
          ...(eventCode ? { event_code: eventCode } : {}),
          movie_page_url: ctaUrl,
          platform: 'BookMyShow',
        },
        evidence: {
          sourceUrl: bmsDiscoverUrl(region),
          sourceReference: eventCode || key,
          rawFingerprint: fingerprint,
          extractedFields: ['title', ...(poster ? ['image'] : []), 'deeplink', ...(cert ? ['certification'] : []), ...(lang ? ['language'] : [])],
        },
      }));
    }
  }
  return out.slice(0, 40);
}
