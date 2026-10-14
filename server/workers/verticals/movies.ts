/**
 * Movies worker (India). A movies search runs ONLY this worker.
 * Real recently-released Indian films (Wikidata, CC0) for browse queries and real
 * movie facts for entity queries. Showtimes/ticket prices are honestly unknown —
 * booking platforms block plain HTTP and we never invent them.
 */
import { registerVerticalWorker, type VerticalWorker } from '../verticalWorker';
import { AcquisitionError } from '../../common/httpClient';
import { getOverride, dynamicScannerEngine } from '../../acquisition/selfHeal';
import { cffiFetch } from '../../common/curlCffiFetch';
import {cityFromMovieQuery,  resolveBmsRegion, bmsDiscoverUrl, bmsDiscoverHeaders, parseMovieCards, normCity, extractMovieQuery, matchesQuery } from '../parsers/bookmyshow';
import { ticketnewCityKeys, parseTicketNewMoviesPage, parseTicketNewMovies, TICKETNEW_BASE } from '../parsers/ticketnew';
import { parseCinepolisPage, parseCinepolisMovies, CINEPOLIS_MOVIE_LIST_URL } from '../parsers/cinepolis';
import { parseDistrictMovies, parseDistrictOffers, districtPriceBands, DISTRICT_MOVIES_URL } from '../parsers/district';
import { gwCitySlug, gwCityMovieAggregates, gwCritique, gwMatch, extractTrailerUrl, type GwMovieAgg } from '../parsers/districtGw';
import { imdbRatingFor } from '../parsers/imdbRatings';
import { createHash } from 'node:crypto';


/** BookMyShow now-showing discovery (mandatory source #1 for movies).
 * Akamai fingerprints TLS, so the request rides the curl_cffi bridge (still browserless);
 * region comes from the public CDN regions.json; prices are honestly absent until the
 * quickbook showtimes contract is recovered (never fabricated). */
async function fetchJsonNode(url: string): Promise<any> {
  const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new AcquisitionError('SERVER_ERROR', `regions fetch ${r.status}`);
  return r.json();
}


/** Match an offer title against gw aggregates (all tokens present). Returns the best hit. */
function matchAgg(aggs: Map<string, GwMovieAgg> | null, title: string): GwMovieAgg | null {
  if (!aggs || aggs.size === 0) return null;
  const toks = title.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 1);
  let best: GwMovieAgg | null = null;
  let bestScore = 0;
  for (const agg of aggs.values()) {
    const hay = agg.title.toLowerCase();
    const score = toks.filter((x) => hay.includes(x)).length;
    if (score === toks.length && score > bestScore) { best = agg; bestScore = score; }
  }
  return best;
}

/** Attach gw real seat prices / theatres / shows + IMDb rating to an offer. Best-effort, honest skip. */
async function enrichWithGw(
  o: any,
  aggs: Map<string, GwMovieAgg> | null,
  gwHost: 'district' | 'ticketnew',
  forSite?: string,
): Promise<void> {
  const agg = matchAgg(aggs, String(o.title || ''));
  if (agg) {
    o.price = agg.minPrice; // REAL area-level seat price observed in live sessions
    o.attributes = o.attributes || {};
    o.attributes['price_band'] = agg.minPrice < agg.maxPrice ? `₹${agg.minPrice}–₹${agg.maxPrice}` : `₹${agg.minPrice}`;
    o.attributes['theatres'] = agg.theatres.slice(0, 6).join(' | ');
    o.attributes['theatre_count'] = agg.theatres.length;
    o.attributes['shows_today'] = agg.showCount;
    o.attributes['data_note'] = forSite
      ? `Seat prices (₹${agg.minPrice}–₹${agg.maxPrice}) observed in live ${gwHost === 'district' ? 'District' : 'TicketNew'} sessions across ${agg.theatres.length} theatres for this movie in this city. Exact fare on ${forSite} is shown at seat selection.`
      : `Real area-level seat prices (₹${agg.minPrice}–₹${agg.maxPrice}) observed in live sessions across ${agg.theatres.length} theatres via District/TicketNew's public sessions gateway`;
    (o.evidence as any).extractedFields = [...((o.evidence as any).extractedFields || []), 'price_min', 'price_max', 'theatres', 'shows_today'];
    const crit = agg.contentId ? await gwCritique(gwHost, agg.contentId).catch(() => null) : null;
    if (crit) {
      if (crit.ratings.length) {
        o.attributes['critic_rating'] = crit.ratings.map((r) => `${r.value} (${r.ratedBy})`).slice(0, 3).join(' | ');
        (o.evidence as any).extractedFields = [...((o.evidence as any).extractedFields || []), 'critic_rating'];
      }
      if (crit.reviews.length) {
        const r0 = crit.reviews[0];
        o.attributes['critic_review'] = `${r0.source ? `[${r0.source}] ` : ''}${r0.text}`;
        (o.evidence as any).extractedFields = [...((o.evidence as any).extractedFields || []), 'critic_review'];
      }
    }
  }
  const imdb = await imdbRatingFor(String(o.title || '')).catch(() => null);
  if (imdb) {
    o.attributes = o.attributes || {};
    o.attributes['imdb_rating'] = `${imdb.rating.toFixed(1)} (${imdb.votes.toLocaleString('en-IN')} votes)`;
    o.attributes['imdb_id'] = imdb.tt;
    (o.evidence as any).extractedFields = [...((o.evidence as any).extractedFields || []), 'imdb_rating'];
  }
}

/** city|title -> last observed seat price (24h), so a gateway blip never blanks BMS prices. */
const bmsLastPrice = new Map<string, { at: number; price: number; band?: string; note?: string }>();

export const moviesWorker: VerticalWorker = {
  vertical: 'movies',
  tasks: [
    {
      sourceId: 'w_movies_bookmyshow',
      name: 'Movies worker: BookMyShow now-showing discovery (posters + deeplinks, city-aware)',
      priority: 1,
      maxPerMinute: 6,
      timeoutMs: 60_000,
      run: async (ctx) => {
        const raw = String(ctx.query.rawQuery || '').trim();
        const entity = String(ctx.query.entityName || '').trim();
        const typedCity = await cityFromMovieQuery(String(ctx.query.rawQuery || ''), ctx.query.location?.city, fetchJsonNode);
        const region = await resolveBmsRegion(typedCity, fetchJsonNode);
        const healedBase = await getOverride('w_movies_bookmyshow', 'explore_api_path').then(async (pth) => { const host = await getOverride('w_movies_bookmyshow', 'api_host'); return pth && host ? `${host}${pth}/v1/discover` : null; }).catch(() => null);
        let res = await cffiFetch(bmsDiscoverUrl(region, healedBase), { headers: bmsDiscoverHeaders(region), timeoutMs: 25_000 });
        if ((res.status === 404 || res.status === 410) && !healedBase) {
          // SOURCE_DRIFT: endpoint moved. Re-scan public bundles, retry once with the healed base.
          const rep = await dynamicScannerEngine.heal('w_movies_bookmyshow').catch(() => null);
          const fresh = rep?.healed ? await getOverride('w_movies_bookmyshow', 'explore_api_path').then(async (pth) => { const host = await getOverride('w_movies_bookmyshow', 'api_host'); return pth && host ? `${host}${pth}/v1/discover` : null; }).catch(() => null) : null;
          if (fresh) res = await cffiFetch(bmsDiscoverUrl(region, fresh), { headers: bmsDiscoverHeaders(region), timeoutMs: 25_000 });
        }
        if (res.status === 403 || res.status === 429) {
          throw new AcquisitionError(res.status === 403 ? 'FORBIDDEN' : 'RATE_LIMITED', `BMS blocked: ${res.status}`, res.status);
        }
        if (res.status !== 200) throw new AcquisitionError('SERVER_ERROR', `BMS discovery ${res.status}`, res.status);
        const payload = JSON.parse(res.body);
        // Strip generic + location tokens so strict title matching compares the movie
        // name only ("jailer 2 movie tickets bengaluru" -> "jailer 2").
        const stripTokens = (normCity(region.regionName) + ' ' + normCity(String(ctx.query.location?.city || ''))).split(' ').filter(Boolean);
        const queryTerm = entity ? extractMovieQuery(entity, stripTokens) : '';
        const fingerprint = createHash('sha256').update(res.body).digest('hex').slice(0, 16);
        const cards = parseMovieCards(payload, ctx.source, region, queryTerm, fingerprint);
        // BMS' own quickbook/session API is edge-blocked, so its cards had NO price. The same
        // movie in the same city is sold in the same theatres on District/TicketNew, whose public
        // sessions gateway exposes live seat prices. Attach that observed band to BMS cards
        // (labelled with its true origin). The gateway walk is time-boxed to 25s so the cards
        // themselves are never lost, and a 24h last-known price covers a gateway blip.
        // Honest skip when neither exists.
        const gwCity = gwCitySlug(typedCity || region.regionName || '');
        const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
          Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
        let aggs: Map<string, GwMovieAgg> | null = null;
        let host: 'district' | 'ticketnew' = 'district';
        if (gwCity) {
          aggs = await withTimeout(gwCityMovieAggregates('district', gwCity, 8).catch(() => null), 25_000);
          if (!aggs || aggs.size === 0) {
            host = 'ticketnew';
            aggs = await withTimeout(gwCityMovieAggregates('ticketnew', gwCity, 6).catch(() => null), 15_000);
          }
        }
        const keyOf = (o: any) => `${normCity(region.regionName)}|${String(o.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;
        for (const o of cards.slice(0, 14)) {
          try {
            const agg = matchAgg(aggs, String(o.title || ''));
            if (agg) {
              o.price = agg.minPrice;
              o.attributes = o.attributes || {};
              o.attributes['price_band'] = agg.minPrice < agg.maxPrice ? `₹${agg.minPrice}–₹${agg.maxPrice}` : `₹${agg.minPrice}`;
              o.attributes['theatres'] = agg.theatres.slice(0, 6).join(' | ');
              o.attributes['theatre_count'] = String(agg.theatres.length);
              o.attributes['shows_today'] = String(agg.showCount);
              o.attributes['data_note'] = `Seat prices (₹${agg.minPrice}–₹${agg.maxPrice}) observed in live ${host === 'district' ? 'District' : 'TicketNew'} sessions across ${agg.theatres.length} theatres for this movie in this city. Exact fare on BookMyShow is shown at seat selection.`;
              (o.evidence as any).extractedFields = [...((o.evidence as any).extractedFields || []), 'price_min', 'price_max', 'theatres', 'shows_today'];
              bmsLastPrice.set(keyOf(o), { at: Date.now(), price: agg.minPrice, band: o.attributes['price_band'], note: o.attributes['data_note'] });
            } else {
              const last = bmsLastPrice.get(keyOf(o));
              if (last && Date.now() - last.at < 24 * 3600_000) {
                o.price = last.price;
                o.attributes = o.attributes || {};
                o.attributes['price_band'] = last.band || '';
                o.attributes['data_note'] = `${last.note || 'Seat price observed earlier'} (last observed ${Math.round((Date.now() - last.at) / 60000)} min ago)`;
              }
            }
          } catch { /* a single card never fails the source */ }
        }
        return cards;
      },
    },
    {
      sourceId: 'w_movies_ticketnew',
      name: 'Movies worker: TicketNew now-showing (Next.js __NEXT_DATA__, city-aware)',
      priority: 8,
      maxPerMinute: 6,
      timeoutMs: 45_000,
      run: async (ctx) => {
        const entity = String(ctx.query.entityName || '').trim();
        const city = (await cityFromMovieQuery(String(ctx.query.rawQuery || ''), ctx.query.location?.city, fetchJsonNode)) || '';
        const keys = ticketnewCityKeys(city);
        if (keys.length === 0) return []; // city unknown to TicketNew — honest empty, no substitute
        const queryTerm = entity ? extractMovieQuery(entity, (normCity(city)).split(' ').filter(Boolean)) : '';
        let lastErr: any = null;
        for (const key of keys.slice(0, 2)) {
          try {
            const res = await cffiFetch(`${TICKETNEW_BASE}/movies/${key}`, { timeoutMs: 25_000 });
            if (res.status === 403 || res.status === 429) {
              throw new AcquisitionError(res.status === 403 ? 'FORBIDDEN' : 'RATE_LIMITED', `TicketNew blocked: ${res.status}`, res.status);
            }
            if (res.status !== 200) { lastErr = new Error(`TN listing ${res.status}`); continue; }
            const movies = parseTicketNewMoviesPage(res.body, key);
            if (movies.length === 0) { lastErr = new Error('no movies parsed'); continue; }
            const offers = parseTicketNewMovies(movies, ctx.source, key, queryTerm);
            // REAL SEAT PRICES + THEATRES: TicketNew runs the same District gw mesh.
            // Fetch the city's cinema sessions (guest token) and attach live prices.
            const aggs = await gwCityMovieAggregates('ticketnew', key, 8).catch(() => null);
            for (const o of offers.slice(0, 5)) await enrichWithGw(o, aggs, 'ticketnew');
            return offers;
          } catch (e: any) {
            lastErr = e;
            if (e instanceof AcquisitionError && (e.failureClass === 'FORBIDDEN' || e.failureClass === 'RATE_LIMITED')) throw e;
          }
        }
        if (lastErr instanceof AcquisitionError) throw lastErr;
        return []; // honest empty when the listing pages do not resolve
      },
    },
    {
      sourceId: 'w_movies_cinepolis',
      name: 'Movies worker: Cinepolis India listing (Next.js SSR __NEXT_DATA__, now-showing + coming-soon)',
      priority: 9,
      maxPerMinute: 6,
      timeoutMs: 30_000,
      run: async (ctx) => {
        const entity = String(ctx.query.entityName || '').trim();
        const city = (await cityFromMovieQuery(String(ctx.query.rawQuery || ''), ctx.query.location?.city, fetchJsonNode)) || '';
        const queryTerm = entity ? extractMovieQuery(entity, (normCity(city)).split(' ').filter(Boolean)) : '';
        const res = await cffiFetch(CINEPOLIS_MOVIE_LIST_URL, { timeoutMs: 25_000 });
        if (res.status === 403 || res.status === 429) {
          throw new AcquisitionError(res.status === 403 ? 'FORBIDDEN' : 'RATE_LIMITED', `Cinepolis blocked: ${res.status}`, res.status);
        }
        if (res.status !== 200) throw new AcquisitionError('SERVER_ERROR', `Cinepolis listing ${res.status}`, res.status);
        const data = parseCinepolisPage(res.body);
        if (data.nowPlaying.length === 0 && data.comingSoon.length === 0) {
          throw new AcquisitionError('EMPTY_RESPONSE', 'Cinepolis page carried no parseable movies');
        }
        return parseCinepolisMovies(data, ctx.source, queryTerm);
      },
    },
    {
      sourceId: 'w_movies_district',
      name: 'Movies worker: District by Zomato / Paytm movies (schema.org JSON-LD ItemList, web deeplinks)',
      priority: 8,
      maxPerMinute: 6,
      timeoutMs: 55_000,
      run: async (ctx) => {
        const entity = String(ctx.query.entityName || '').trim();
        const city = (await cityFromMovieQuery(String(ctx.query.rawQuery || ''), ctx.query.location?.city, fetchJsonNode)) || '';
        const queryTerm = entity ? extractMovieQuery(entity, (normCity(city)).split(' ').filter(Boolean)) : '';
        const res = await cffiFetch(DISTRICT_MOVIES_URL, { timeoutMs: 25_000 });
        if (res.status === 403 || res.status === 429) {
          throw new AcquisitionError(res.status === 403 ? 'FORBIDDEN' : 'RATE_LIMITED', `District blocked: ${res.status}`, res.status);
        }
        if (res.status !== 200) throw new AcquisitionError('SERVER_ERROR', `District movies page ${res.status}`, res.status);
        const movies = parseDistrictMovies(res.body);
        if (movies.length === 0) throw new AcquisitionError('EMPTY_RESPONSE', 'District page carried no parseable JSON-LD movies');
        const offers = parseDistrictOffers(movies, ctx.source, queryTerm);
        // REAL SEAT PRICES + THEATRES + CRITICS: District's public gw sessions carry live
        // area-level prices (the same prices the seat-selection flow charges). Aggregate the
        // city's cinema sessions with a guest token, then deep-dive movie pages for trailers.
        const gwCity = gwCitySlug(city);
        const aggs = gwCity ? await gwCityMovieAggregates('district', gwCity, 10).catch(() => null) : null;
        for (const o of offers.slice(0, 5)) {
          await enrichWithGw(o, aggs, 'district');
          // Trailer: the movie's own web page embeds the YouTube trailer (SSR).
          const url = String(o.sellerUrl || '');
          if (!/^https:\/\/www\.district\.in\/movies\//.test(url)) continue;
          try {
            const page = await cffiFetch(url, { timeoutMs: 20_000 });
            if (page.status !== 200) continue;
            const trailer = extractTrailerUrl(page.body);
            if (trailer) {
              o.attributes = o.attributes || {};
              o.attributes['trailer_url'] = trailer;
              (o.evidence as any).extractedFields = [...((o.evidence as any).extractedFields || []), 'trailer_url'];
            }
            // Fallback price source when the gw mesh declined for this city: the session
            // price histogram on the movie page (band-level, still real District data).
            if (o.price == null) {
              const band = districtPriceBands(page.body);
              if (band) {
                o.price = band.from;
                o.attributes = o.attributes || {};
                o.attributes['price_band'] = `₹${band.from}–₹${band.to}`;
                o.attributes['data_note'] = `Ticket prices from District's session price bands (₹${band.from}–₹${band.to} across shows today); exact seat fare appears in the seat-selection flow`;
                (o.evidence as any).extractedFields = [...((o.evidence as any).extractedFields || []), 'price_band_from', 'price_band_to'];
              }
            }
          } catch { /* trailer/page deep-dive is best-effort; the offer stays honest without it */ }
        }
        return offers;
      },
    },
  ],
};
registerVerticalWorker(moviesWorker);
