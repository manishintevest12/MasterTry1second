/**
 * API routes: end-to-end backend wiring.
 * Legacy-compatible endpoints (/api/scrape/live, /api/scan/url, /api/catalogue,
 * /api/provenance) now run through the real orchestrator — fabricated deals are gone.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import type { VerticalId } from '../types';
import { normalizeVerticalId } from '../search/verticalAlias';
import { runSearch, type SearchInput } from '../search/searchOrchestrator';
import { bestUnitPricesPerStore, computeStoreTotals, type BasketItemIn, type ItemCompare, type StoreOfferIn } from '../smartcart/basket';
import { sourcesStatusReport } from '../sources/registry';
import { parseRouteQuery, resolveCabQuery } from '../verticals/verticalEngine';
import { geoSearch, geoReverse } from '../common/geoProxy';
import { groupSameProduct } from '../pipeline/productGrouping';
import { getAllHealth } from '../sources/health';
import { authMiddleware, requireAuth, loginUser, registerUser, SESSION_TTL_SEC } from '../auth/authService';
import { requestAdminOtp, verifyAdminOtp } from '../auth/otpService';
import { verifyFirebaseIdTokenDetailed, verifyGoogleIdToken } from '../auth/firebaseAuth';
import crypto from 'crypto';

import {
  claimSpinEligibility, eligibleSpinCount, executeSpin, getSpinResult,
  registerReferral, submitFulfilmentDetails, validPointBalance,
} from '../rewards/rewardsEngine';
import { resolveRedirect, validateDestination } from '../affiliate/affiliateNetwork';
import { addSpendEntry, listSpendEntries, deleteSpendEntry, spendSummary } from '../spend/spendLens';
import { createMaskingPointer, resolveMaskingPointer, buildSecureDeeplink, recordPointerClick } from '../affiliate/deeplink';
import { getCabDeeplinkConfig, saveCabDeeplinkConfig, buildUberBookUrl, buildOlaBookUrl, geocodeCabPlace, numParam } from '../common/cabDeeplink';
import { buildShowcase, fetchAffiliateRows, realMerchantDomain, nameDomainOf } from '../home/showcase';
import { getStore } from '../common/db';
import { runMigrations, resetToFileStore, recoverMysqlWithLocalHost } from '../common/db';
import { initCache, cacheStats } from '../common/cache';
import { assertProductionReadiness, settings } from '../common/settings';
import { loadSourcesFromDb } from '../sources/registry';
import { scrapeLiveUrl } from '../../src/server/realDataAcquisition';
import { resolveProductFromLink, extractUrl, isSafePublicUrl, searchableTitle } from '../lens/productLink';
import { interpretAssistantQuestion } from '../lens/assistantIntent';
import { isSameProduct } from '../lens/sameProduct';
import { analyseDeal } from '../lens/dealScore';
import { createAlert, listAlerts, deleteAlert } from '../lens/priceAlerts';
import { userNotifications, broadcastNotifications, markRead, markAllRead } from '../notifications/notifications';
import { getCatalogueState, recordProvenance, saveItemToCatalogue } from '../../src/server/catalogueStore';
import { log } from '../common/logger';
import { pythonDiagnostics, cffiFetch } from '../common/curlCffiFetch';
import { YATRA_HOTELS_API_KEY } from '../workers/parsers/yatraHotels';
import { parseMmtAutosuggest } from '../workers/parsers/mmtAutosuggest';

export const apiRouter = Router();

// ============ System ============
apiRouter.get('/health', async (_req: Request, res: Response) => {
  const store = getStore();
  const missing = assertProductionReadiness();
  res.json({
    status: 'online',
    engine: 'Try1Second Independent Metasearch Engine v1.0',
    dataSource: store.kind === 'mysql' ? 'mysql' : 'file-fallback (set MYSQL_URL for production)',
    l2Cache: settings.redisUrl ? 'redis' : (settings.redisRestUrl ? 'redis-rest (Upstash HTTPS)' : 'disabled (set REDIS_URL or UPSTASH_REDIS_REST_URL/TOKEN)'),
    searchApi: settings.searchApi.enabled ? 'optional-adapter-enabled' : 'optional-adapter-disabled',
    productionWarnings: missing,
    timestamp: new Date().toISOString(),
  });
});

/** Which Python interpreters the host offers and whether curl_cffi loads in them (shared-hosting diagnostics). */
apiRouter.get('/health/transport', async (_req: Request, res: Response) => {
  try { res.json({ ok: true, ...(await pythonDiagnostics()) }); } catch (e: any) { res.status(500).json({ ok: false, error: String(e?.message || e) }); }
});


// Hotel destination + property-name autocomplete (hotels vertical). Yatra's
// hotel platform (TravelGuru) autosuggest returns LIVE hotel names, cities and
// localities — the same registry their own site uses. Browserless curl_cffi,
// cached in-process 24h. Fixes: hotel search previously suggested AIRPORTS
// ("New Delhi (DEL)" with plane icons) because it shared the flights city pool.
const hotelLocationCache = new Map<string, { at: number; docs: any[] }>();
apiRouter.get('/hotels/locations', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ locations: [] });
  const key = q.toLowerCase();
  const hit = hotelLocationCache.get(key);
  if (hit && Date.now() - hit.at < 24 * 3600 * 1000) return res.json({ locations: hit.docs });
  try {
    // LIVE registries in parallel: TravelGuru (Yatra hotels) + MakeMyTrip mapi
    // autosuggest (t=hotel gives real property ids + star ratings; t=city gives
    // destinations). Both verified browserless; both India-only.
    const [tg, mmtH, mmtC] = await Promise.all([
      cffiFetch(
        `https://cdn.travelguru.com/api/v4/autosuggest?key=${encodeURIComponent(q)}&filter=all&count=12&propertyType=all`,
        { impersonate: 'chrome', timeoutMs: 15_000, headers: { Accept: 'application/json', 'x-api-key': YATRA_HOTELS_API_KEY, Referer: 'https://hotel.yatra.com/', Origin: 'https://hotel.yatra.com' } },
      ).catch(() => null),
      cffiFetch(
        `https://mapi.makemytrip.com/autosuggest/v5/search?t=hotel&q=${encodeURIComponent(q)}`,
        { impersonate: 'chrome', timeoutMs: 15_000, headers: { Accept: 'application/json', Referer: 'https://www.makemytrip.com/' } },
      ).catch(() => null),
      cffiFetch(
        `https://mapi.makemytrip.com/autosuggest/v5/search?t=city&q=${encodeURIComponent(q)}`,
        { impersonate: 'chrome', timeoutMs: 15_000, headers: { Accept: 'application/json', Referer: 'https://www.makemytrip.com/' } },
      ).catch(() => null),
    ]);
    const hotels: any[] = (tg && tg.status === 200) ? ((JSON.parse(tg.body || '{}').hotels) || []) : [];
    const mmtHotels = mmtH && mmtH.status === 200 ? parseMmtAutosuggest(mmtH.body, 'hotel') : [];
    const mmtCities = mmtC && mmtC.status === 200 ? parseMmtAutosuggest(mmtC.body, 'city') : [];
    if (!hotels.length && !mmtHotels.length && !mmtCities.length) {
      const errBits = [`TravelGuru ${tg ? tg.status : 'ERR'}`, `MMT ${mmtH ? mmtH.status : 'ERR'}`];
      return res.json({ locations: [], error: errBits.join(' · ') });
    }
    // Cities/areas first (destinations), then individual properties (hotel names).
    // MMT destination rows carry cityCode; MMT property rows carry hotelId + starRating.
    const cities: any[] = [];
    const props: any[] = [];
    const seenDest = new Set<string>();
    for (const c of mmtCities) {
      const key = c.name.toLowerCase();
      if (!c.name || seenDest.has(key)) continue;
      seenDest.add(key);
      cities.push({ name: c.name, type: 'CITY', cityName: c.cityName, stateName: c.stateName || '', cityCode: c.cityCode || '', registry: 'makemytrip' });
    }
    for (const h of hotels) {
      const cc = String(h?.countryCode || '').toUpperCase();
      if (cc && cc !== 'IND') continue; // India stays only
      const doc = {
        name: String(h?.displayName || ''),
        type: h?.type === 'HOTEL' ? 'HOTEL' : 'CITY',
        cityName: String(h?.cityName || ''),
        stateName: String(h?.stateName || ''),
        propertyType: String(h?.propertyType || ''),
        sourceId: String(h?.sourceID || ''),
        registry: 'yatra',
      };
      if (!doc.name) continue;
      if (doc.type === 'CITY' && seenDest.has(doc.name.toLowerCase())) continue;
      (doc.type === 'HOTEL' ? props : cities).push(doc);
    }
    const seenHotel = new Set<string>();
    for (const p of props) seenHotel.add(`${p.name.toLowerCase()}|${String(p.cityName).toLowerCase()}`);
    for (const mh of mmtHotels) {
      // MMT displayName repeats the city ('The Taj Mahal Palace, Mumbai, Mumbai, Maharashtra') —
      // dedupe comma segments keeping order ('The Taj Mahal Palace, Mumbai').
      const segs = mh.name.split(',').map((x) => x.trim()).filter(Boolean);
      const dedup: string[] = [];
      for (const seg of segs) if (!dedup.some((d) => d.toLowerCase() === seg.toLowerCase())) dedup.push(seg);
      const display = dedup.join(', ');
      const key = `${mh.name.toLowerCase()}|${mh.cityName.toLowerCase()}`;
      if (!mh.name || seenHotel.has(key)) continue;
      seenHotel.add(key);
      props.push({ name: display, type: 'HOTEL', cityName: mh.cityName, stateName: mh.stateName || '', hotelId: mh.hotelId || '', starRating: mh.starRating, lat: mh.lat, lng: mh.lng, registry: 'makemytrip' });
    }
    const locations = [...cities, ...props].slice(0, 14);
    hotelLocationCache.set(key, { at: Date.now(), docs: locations });
    if (hotelLocationCache.size > 500) {
      const oldest = [...hotelLocationCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) hotelLocationCache.delete(oldest[0]);
    }
    return res.json({ locations });
  } catch (e: any) {
    return res.json({ locations: [], error: String(e?.message || e).slice(0, 120) });
  }
});

// Bus deep-location autocomplete: redBus's own Solr registry covers tier-1/2/3
// towns (Harda, etc.) AND area-level boarding points (BpList per city, the same
// "Popular Boarding Points" data the redBus app shows). Cached in-process 24h.
const busLocationCache = new Map<string, { at: number; docs: any[] }>();
apiRouter.get('/bus/locations', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ locations: [] });
  const key = q.toLowerCase();
  const hit = busLocationCache.get(key);
  if (hit && Date.now() - hit.at < 24 * 3600 * 1000) return res.json({ locations: hit.docs });
  try {
    const r = await cffiFetch(`https://www.redbus.in/rpw/api/citySuggestion?search=${encodeURIComponent(q)}&limit=20`, {
      impersonate: 'chrome', timeoutMs: 15_000, headers: { Accept: 'application/json' },
    });
    if (r.status !== 200) return res.json({ locations: [], error: `redBus citySuggestion HTTP ${r.status}` });
    const docs: any[] = (JSON.parse(r.body || '{}').response?.docs) || [];
    const locations = docs
      .filter((d: any) => Number(d?.ID) > 0)
      // India only (owner: tier-1/2/3 towns where buses actually run) — redBus
      // marks country in `cc`; keep unknown-cc rows only if cc is absent.
      .filter((d: any) => !d?.cc || String(d.cc).toUpperCase() === 'IND')
      .sort((a: any, b: any) => Number(b?.rank || 0) - Number(a?.rank || 0))
      .slice(0, 20)
      .map((d: any) => ({
        id: Number(d.ID),
        name: String(d.Name || ''),
        type: String(d.locationType || 'CITY').toUpperCase(), // CITY | AREA (AREA = specific boarding locality)
        region: String(d.region || ''),
        parentName: String(d.parentLocationName || ''),
        // Popular boarding points for this city (redBus's own BpList) — shown in the
        // From dropdown exactly like the reference UI ("Board at" rows).
        boardingPoints: (Array.isArray(d.BpList) ? d.BpList : []).slice(0, 6).map((bp: any) => ({
          id: Number(bp?.ID), name: String(bp?.Name || ''), parentName: String(bp?.parentLocationName || ''),
        })),
      }));
    busLocationCache.set(key, { at: Date.now(), docs: locations });
    if (busLocationCache.size > 500) {
      const oldest = [...busLocationCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) busLocationCache.delete(oldest[0]);
    }
    return res.json({ locations });
  } catch (e: any) {
    return res.json({ locations: [], error: String(e?.message || e).slice(0, 120) });
  }
});

// ---- Open geo proxy for the Uber-style drag-and-drop map pin (Cab & Ride, 17 Oct) ----
// Leaflet + OSM tiles in the browser; the backend proxies Nominatim (UA + 1 req/s
// throttle + 24h cache in common/geoProxy). Open data, no keys, no fabrication.
apiRouter.get('/geo/search', async (req, res) => {
  const q = String(req.query.q || '').slice(0, 120);
  if (q.trim().length < 2) return res.json({ results: [] });
  const results = await geoSearch(q, 6);
  res.json({ results });
});

apiRouter.get('/geo/reverse', async (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: 'lat and lng are required numbers' });
  }
  const place = await geoReverse(lat, lng);
  res.json({ place }); // place: null when Nominatim has no answer — never invented
});

// QUICK APPS (owner 22 Oct): the hub listed only ~29 curated companies and
// opened them DIRECTLY — bypassing /api/out, so no affiliate injection and no
// click tracking. GET returns every live affiliate-registry merchant as extra
// quick-app entries (masked launch). POST mints masking pointers for partner
// webUrls so launches redirect through /api/out. Domains are allow-listed
// (curated partners + live registry merchants) — no open-redirect minting.
const QUICK_APP_ALLOW_DOMAINS = new Set([
  'cred.club', 'groww.in', 'bookmyshow.com', 'agoda.com', 'amazon.in', 'bankbazaar.com',
  'bigbasket.com', 'blinkit.com', 'booking.com', 'cleartrip.com', 'dominos.co.in',
  'easemytrip.com', 'flipkart.com', 'hdfcbank.com', 'makemytrip.com', 'microsoft.com',
  'myntra.com', 'nykaa.com', 'olacabs.com', 'oyorooms.com', 'paisabazaar.com',
  'policybazaar.com', 'redbus.in', 'swiggy.com', 'tataneu.com', 'uber.com',
  'yatra.com', 'zeptonow.com', 'zomato.com',
]);

function domainHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

async function quickAppAllowList(): Promise<Set<string>> {
  const allow = new Set(QUICK_APP_ALLOW_DOMAINS);
  for (const row of await fetchAffiliateRows(600)) {
    const dom = realMerchantDomain([row.original_url, row.affiliate_url]) || nameDomainOf(String(row.merchant_name || ''));
    if (dom) allow.add(dom);
  }
  return allow;
}

// GET /api/quick-apps — every live affiliate-registry merchant as a quick-app entry.
apiRouter.get('/quick-apps', async (_req, res) => {
  try {
    const rows = await fetchAffiliateRows(600);
    const seen = new Set<string>();
    const byName = new Map<string, { domains: Set<string>; category: string }>();
    for (const row of rows) {
      const name = String(row.merchant_name || '').trim();
      if (name.length < 2) continue;
      const dom = realMerchantDomain([row.original_url, row.affiliate_url]) || nameDomainOf(name);
      const bucket = byName.get(name) || { domains: new Set<string>(), category: String(row.categories || '').split(',')[0].trim() };
      if (dom) bucket.domains.add(dom);
      byName.set(name, bucket);
      seen.add(name.toLowerCase());
    }
    const affiliates = Array.from(byName.entries()).map(([name, b]) => {
      const dom = Array.from(b.domains)[0] || nameDomainOf(name) || 'example.com';
      const homepage = `https://${dom}`;
      return {
        id: `qa-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
        name: name.slice(0, 60),
        iconUrl: `https://icons.duckduckgo.com/ip3/${dom}.ico`,
        category: b.category || 'Shopping',
        type: 'CPS',
        deepLink: '',
        webUrl: homepage,
        description: `Live-tracked coupons and cashback offers from ${name} via Try1Second.`,
        payoutRate: 'Affiliate commission on every tracked sale',
        payoutAmount: 0,
        status: 'active',
        rating: 0,
        downloadsOrUsers: '',
        badge: 'Live Coupons',
        bgColor: 'bg-slate-700',
        createdAt: new Date().toISOString().split('T')[0],
        goUrl: createMaskingPointer(homepage, { offerId: `qa-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, trusted: true }), // affiliate registry
      };
    });
    res.json({ success: true, affiliates });
  } catch {
    res.status(500).json({ success: false, error: 'quick_apps_unavailable' });
  }
});

// POST /api/quick-apps/go — masking pointers for allow-listed partner webUrls.
apiRouter.post('/quick-apps/go', async (req: any, res) => {
  try {
    const items: Array<{ id?: string; url?: string }> = Array.isArray(req.body?.items) ? req.body.items.slice(0, 500) : [];
    const allow = await quickAppAllowList();
    const goUrls: Record<string, string> = {};
    for (const it of items) {
      const url = String(it.url || '');
      const id = String(it.id || '');
      const host = domainHost(url);
      if (!id || !/^https:\/\//.test(url) || !allow.has(host)) continue; // unknown domain: direct launch stays client-side
      goUrls[id] = createMaskingPointer(url, { offerId: `qapp-${id}`, trusted: true }); // allow-listed admin partner
    }
    res.json({ success: true, goUrls });
  } catch {
    res.status(400).json({ success: false, error: 'bad_request' });
  }
});

// GET /api/home/showcase — the 8 curated homepage sections (owner spec 21 Oct).
// Real rows only; empty sections are omitted. Cached in-process for 10 min.
apiRouter.get('/home/showcase', async (_req, res) => {
  try {
    const sections = await buildShowcase();
    res.json({ success: true, sections });
  } catch (e: any) {
    res.status(500).json({ success: false, error: 'showcase_unavailable' });
  }
});

apiRouter.get('/status', (_req, res) => {
  res.json({
    success: true,
    sources: sourcesStatusReport(),
    health: getAllHealth(),
    cache: cacheStats(),
  });
});

// ============ Real price history per canonical entity ============
apiRouter.get('/history', async (req, res) => {
  const entity = Number(req.query.entity);
  if (!entity || entity <= 0) return res.status(400).json({ success: false, error: 'entity (canonical id) is required' });
  const limit = Math.min(Math.max(Number(req.query.limit) || 60, 1), 120);
  try {
    const { priceHistoryForEntity } = await import('../catalogue/catalogueService');
    const rows = await priceHistoryForEntity(entity, limit);
    const points = rows
      .map((r: any) => ({ price: Number(r.effective_price), capturedAt: r.captured_at }))
      .filter((p: any) => Number.isFinite(p.price) && p.price > 0);
    res.json({ success: true, points });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'history lookup failed' });
  }
});

// ============ Search pipeline (Section 6) ============
apiRouter.post('/search', async (req, res) => {
  const input: SearchInput = {
    query: String(req.body.query || '').slice(0, 300),
    vertical: normalizeVerticalId(req.body.vertical) as SearchInput['vertical'],
    pincode: req.body.pincode,
    city: req.body.city,
    locality: req.body.locality,
    lat: req.body.lat,
    lng: req.body.lng,
    travelDates: req.body.travelDates && typeof req.body.travelDates === 'object' ? {
      depart: String(req.body.travelDates.depart || '').slice(0, 10) || undefined,
      return: String(req.body.travelDates.return || '').slice(0, 10) || undefined,
    } : undefined,
    guests: Number(req.body.guests) || undefined,
  };
  if (String(input.vertical) === 'cab') input.query = resolveCabQuery(input.query, input.city);
  if (!input.query?.trim()) return res.status(400).json({ success: false, error: 'A search query is required.' });
  const response = await runSearch(input);
  if (process.env.LOG_LEVEL === 'debug') {
    const vc: Record<string, number> = {};
    for (const o of response.results as any[]) vc[String((o as any).vendor || (o as any).seller || '?')] = (vc[String((o as any).vendor || (o as any).seller || '?')] || 0) + 1;
    console.error(JSON.stringify({ dbg: 'runSearch raw', n: response.results.length, vendors: vc, vertical: String(input.vertical || '') }));
  }
  res.json({ success: response.results.length > 0 || response.state.servedFrom !== 'unavailable', ...response });
});


/**
 * Map a verified backend offer to the full ComparisonItem the frontend renders.
 * Every item carries a real seller quote built from the SAME offer. When the source
 * exposes no price (e.g. airline-route data), price is 0 and priceAvailable=false:
 * the UI shows "Price on seller site" instead of an invented fare.
 */

/** Platform label for a hotel acquisition source — used when a stale/persisted offer
 *  carried the hotel's NAME in the seller slot (pre-rule rows or discovery rows). */
const HOTEL_SOURCE_LABEL: Record<string, string> = {
  w_hotels_ixigo: 'Ixigo', w_hotels_agoda: 'Agoda', w_hotels_booking: 'Booking.com', w_hotels_cleartrip: 'Cleartrip',
  w_hotels_airbnb: 'Airbnb', w_hotels_oyo: 'OYO Rooms', w_hotels_yatra: 'Yatra', w_hotels_emt: 'EaseMyTrip',
  w_hotels_saffronstays: 'SaffronStays', w_hotels_goibibo: 'Goibibo', w_hotels_mmt: 'MakeMyTrip',
  w_hotels_expedia: 'Expedia', w_hotels_hotelscom: 'Hotels.com',
  w_hotels_osm: 'OpenStreetMap (ODbL)', w_hotels_wikidata: 'Wikidata (CC0)',
};

/** Owner 17 Oct: the Platforms & Sellers sidebar must never list a hotel's NAME as a
 *  seller. Persisted offers from before the platform-seller rule still carry the hotel
 *  name there; at serve time those fall back to the acquisition source's platform label. */
function hotelSellerLabel(o: any, rawSeller: string): string {
  if (!o || String(o.vertical) !== 'hotels') return rawSeller;
  const t = String(o.title || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const s = rawSeller.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || !s || s.length < 8) return rawSeller;
  const same = s === t || (t.includes(s) || s.includes(t));
  if (!same) return rawSeller;
  const sid = String(o?.provenance?.sourceId || o?.source_id || o?.sourceId || '');
  return HOTEL_SOURCE_LABEL[sid] || hostOfPublic(String(o?.sellerUrl || '')) || 'Verified source';
}

function hostOfPublic(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function offerToComparisonItem(o: any) {
  const price = Number(o.prices?.effectivePrice ?? o.prices?.mandatoryTotal ?? 0) || 0;
  const list = Number(o.prices?.listPrice ?? 0) || 0;
  // Module 4: masking pointer — affiliate tokens are built server-side at click
  // time and NEVER appear in API responses or the page source.
  const rawDest = o.sellerUrl || '';
  const url = rawDest ? createMaskingPointer(rawDest, { offerId: String(o.id || '') }) : '';
  const seller = hotelSellerLabel(o, String(o.seller || o.vendor || 'Verified source'));
  const attrs: Record<string, string> = o.attributes || {};
  const specs: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) specs[k.replace(/_/g, ' ')] = String(v);
  // Owner 17 Oct: flight cards must show the OPERATING AIRLINE name alongside the
  // selling website (Ixigo/Yatra/EMT...). Airline lives on the offer's brand field.
  const brandName = o.brand ? String(o.brand).toLowerCase().trim() : '';
  const sellerNames = [o.seller, o.vendor].map((v) => (v ? String(v).toLowerCase().trim() : '')).filter(Boolean);
  const brandIsSeller = brandName && sellerNames.includes(brandName);
  if (String(o.vertical) === 'flights' && o.brand && !specs['airline'] && !brandIsSeller) {
    specs['airline'] = String(o.brand);
  }
  if (o.travel?.route) specs['Route'] = String(o.travel.route);
  if (o.travel?.date) specs['Date'] = String(o.travel.date);
  const fetchedAt = o.provenance?.fetchedAt;
  // Human-readable description built ONLY from fields the source actually published.
  const parts: string[] = [];
  if (attrs['dish_description']) parts.push(String(attrs['dish_description']));
  if (attrs['brand'] && !String(o.title).toLowerCase().includes(String(attrs['brand']).toLowerCase())) parts.push(String(attrs['brand']));
  if (attrs['rating']) parts.push(`${attrs['rating']}★ rating${attrs['rating_count'] ? ` (${Number(attrs['rating_count']).toLocaleString('en-IN')} ratings)` : ''}`);
  if (attrs['cuisines'] && !attrs['dish_description']) parts.push(attrs['cuisines']);
  if (attrs['eta']) parts.push(`Delivers in ${attrs['eta']}`);
  if (attrs['address']) parts.push(attrs['address']);
  if (o.travel?.route) parts.push(o.travel.route);
  if (attrs['distance']) parts.push(attrs['distance']);
  if (attrs['duration']) parts.push(attrs['duration']);
  if (attrs['operator']) parts.push(String(attrs['operator']));
  if (attrs['departure']) parts.push(`Departs ${attrs['departure']}`);
  if (attrs['prime'] === 'true') parts.push('Prime eligible');
  if (attrs['loan_type']) parts.push(String(attrs['loan_type']));
  // Bank-account rows: the banking block below builds the rate part (avoid a duplicate '2.5–2.5%' here)
  if (!attrs['account_type']) {
    if (attrs['interest_rate_min'] && attrs['interest_rate_max']) parts.push(`${attrs['interest_rate_min']}–${attrs['interest_rate_max']}% p.a.`);
    else if (attrs['interest_rate_min']) parts.push(`from ${attrs['interest_rate_min']}% p.a.`);
  }
  if (attrs['sum_insured']) parts.push(`Cover ${attrs['sum_insured']}`);
  if (attrs['theatre']) parts.push(String(attrs['theatre']));
  if (attrs['showtime']) parts.push(String(attrs['showtime']));
  if (o.location?.city) parts.push(`${o.location.city}`);
  if (attrs['in_stock'] === 'false' || o.availability === 'out_of_stock') parts.push('Currently out of stock');
  // Credit cards: the comparable facts the issuer published (fees, rewards, APR).
  // Bank accounts: the published savings rate / demat AMC / minimum balance.
  if (String(o.vertical) === 'banking') {
    const rMin = attrs['interest_rate_min'] || attrs['interest_rate'];
    const rMax = attrs['interest_rate_max'] || rMin;
    if (rMin) parts.push(`${rMin}${rMax !== rMin ? `–${rMax}` : ''}% p.a. savings`);
    if (attrs['amc']) parts.push(`AMC ${attrs['amc']}`);
    if (attrs['min_balance']) parts.push(`Min balance ₹${Number(String(attrs['min_balance']).replace(/[^\d.]/g, '') || 0).toLocaleString('en-IN')}`);
    if (attrs['account_opening_fee']) parts.push(`Opening ${attrs['account_opening_fee']}`);
    if (attrs['balance_requirement']) parts.push(String(attrs['balance_requirement']));
  }
  if (o.vertical === 'creditcards') {
    if (attrs['joining_fee']) parts.push(`Joining ${attrs['joining_fee']}`);
    if (attrs['annual_fee']) parts.push(`Renewal ${attrs['annual_fee']}`);
    if (attrs['reward_rate']) parts.push(`Rewards ${attrs['reward_rate']}`);
    if (attrs['apr']) parts.push(`APR ${attrs['apr']}`);
    if (attrs['best_for']) parts.push(String(attrs['best_for']));
  }
  if (!parts.length && attrs['data_note']) parts.push(String(attrs['data_note']));
  const description = parts.join(' · ').slice(0, 300);
  const featurePills = [
    ...(attrs['rating'] ? [`${attrs['rating']}★`] : []),
    ...(attrs['interest_rate_min'] ? [`${attrs['interest_rate_min']}–${attrs['interest_rate_max'] || attrs['interest_rate_min']}% p.a.`] : []),
    ...(attrs['loan_type'] ? [String(attrs['loan_type'])] : []),
    ...(attrs['sum_insured'] ? [`Cover ${attrs['sum_insured']}`] : []),
    ...(o.location?.city ? [o.location.city] : []),
    ...(attrs['cuisines'] ? [attrs['cuisines'].split(',')[0]] : []),
    ...(attrs['prime'] === 'true' ? ['Prime'] : []),
    ...(o.travel?.route ? [o.travel.route] : []),
    ...(attrs['distance'] ? [attrs['distance']] : []),
    ...(attrs['operator'] ? [attrs['operator']] : []),
  ].slice(0, 3);
  const sellerLabel = seller === 'Verified source' ? String(o.vendor || seller) : seller;
  const images = attrs['image_urls'] ? String(attrs['image_urls']).split('|').filter((u) => /^https:\/\//.test(u)) : undefined;
  return {
    id: o.id,
    canonicalEntityId: o.canonicalEntityId ?? o.canonical_entity_id ?? null,
    vertical: o.vertical,
    title: o.title,
    subtitle: sellerLabel,
    category: o.vertical,
    provider: o.vendor,
    providerLogo: '',
    images,
    // Hero image fallback chain: image_url -> first gallery shot -> raw image attr.
    // Parsers key their hero shot differently (Agoda: image_url, Ixigo/OYO: image,
    // galleries in image_urls) — without the chain a real photo was lost and the card
    // fell back to the "photo not published" placeholder.
    imageUrl: [/^https:\/\//.test(attrs['image_url'] || '') ? attrs['image_url'] : '', (images || [])[0] || '', /^https:\/\//.test(attrs['image'] || '') ? attrs['image'] : '']
      .find((u) => u) || undefined,
    rating: Number(attrs['rating']) || 0,
    reviewCount: Number(attrs['review_count']) || 0,
    description,
    sentimentSummary: attrs['data_note'] || 'Live data from a verified source',
    criteriaRatings: [],
    primaryPrice: price,
    originalPrice: list > price ? list : 0,
    priceAvailable: price > 0,
    unit: o.vertical === 'creditcards' ? 'per year'
      : String(o.vertical) === 'banking' ? String(attrs['price_unit'] || 'per account')
      : 'per unit',
    currency: o.prices?.currency || 'INR',
    features: featurePills,
    specs,
    reviews: [],
    pricePrediction: {
      advice: 'fair_price',
      headline: price > 0 ? 'Newly tracked' : 'Price not exposed by this source',
      details: 'Only real observations are charted; nothing is generated.',
      historicalLow: price,
      historicalHigh: price,
      priceHistory: [],
    },
    sellerQuotes: [
      {
        id: `sq-${o.id}`,
        sellerName: seller.slice(0, 80),
        price,
        originalPrice: list > price ? list : 0,
        currency: o.prices?.currency || 'INR',
        url,
        badge: price > 0 ? 'Live Verified' : 'Live data',
        deliveryOrEta: attrs['eta'] || attrs['delivery'] || 'Standard delivery',
        isLowest: true,
        isLiveScraped: o.freshnessStatus === 'LIVE_VERIFIED',
        sourceDomain: rawDest ? String(rawDest).replace(/^https?:\/\//, '').split('/')[0] : undefined,
      },
    ],
    sellerUrl: url,
    // Owner 22 Oct: Uber/Ola cab rows get an in-app booking link — the click
    // resolves server-side (/api/cab/book) with coordinates + admin affiliate
    // params and opens the provider's own app with pickup + drop prefilled, so
    // the user sees the REAL provider fare and books directly in the app.
    appBookUrl: String(o.vertical) === 'cab' && attrs['pickup'] && attrs['drop']
      ? (/uber/i.test(String(o.vendor || '')) ? `/api/cab/book?provider=uber&pickup=${encodeURIComponent(attrs['pickup'])}&drop=${encodeURIComponent(attrs['drop'])}&offerId=${encodeURIComponent(String(o.id || ''))}`
        : /(^|\b)ola(\b|$)/i.test(String(o.vendor || '')) ? `/api/cab/book?provider=ola&pickup=${encodeURIComponent(attrs['pickup'])}&drop=${encodeURIComponent(attrs['drop'])}&offerId=${encodeURIComponent(String(o.id || ''))}`
        : undefined)
      : undefined,
    availability: o.availability,
    isLiveScraped: o.freshnessStatus === 'LIVE_VERIFIED',
    scrapedTimestamp: fetchedAt,
    freshnessStatus: o.freshnessStatus,
    matchState: o.matchState,
    evidence: {
      sourceId: o.provenance?.sourceId,
      sourceMethod: o.provenance?.sourceMethod,
      fetchedAt,
    },
  };
}

/** Legacy-compatible endpoint used by the existing frontend. */
apiRouter.post('/scrape/live', async (req, res) => {
  const input: SearchInput = {
    query: String(req.body.query || ''),
    vertical: normalizeVerticalId(req.body.vertical) as SearchInput['vertical'],
    pincode: req.body.pincode,
    city: req.body.city,
    locality: req.body.locality,
    travelDates: req.body.travelDates && typeof req.body.travelDates === 'object' ? {
      depart: String(req.body.travelDates.depart || '').slice(0, 10) || undefined,
      return: String(req.body.travelDates.return || '').slice(0, 10) || undefined,
    } : undefined,
    guests: Number(req.body.guests) || undefined,
    // Exact map pin (MapPinPicker, 17 Oct): the engine gets the precise point, not just the city.
    lat: typeof req.body.coordinates?.lat === 'number' ? req.body.coordinates.lat : undefined,
    lng: typeof req.body.coordinates?.lng === 'number' ? req.body.coordinates.lng : undefined,
  };
  if (!input.query?.trim()) {
    return res.json({ results: [], honestNotice: 'No query provided', latencyMs: 0 });
  }
  // Cab: a bare location ("vijay nagar indore") is resolved to the city's standard outstation route.
  if (String(input.vertical) === 'cab') input.query = resolveCabQuery(input.query, input.city);
  // Same origin and destination is not a trip: refuse instead of showing some other route's fares.
  if (['flights', 'bus', 'cab'].includes(String(input.vertical))) {
    const rt = parseRouteQuery(input.query);
    if (rt) {
      const same = (rt.from.code && rt.from.code === rt.to.code) || rt.from.city === rt.to.city;
      if (same) {
        return res.json({
          results: [],
          honestNotice: 'Origin and destination are the same. Please choose two different places.',
          sourcesAttempted: [], sourcesSucceeded: [], sourcesFailed: [], servedFrom: 'validation',
          resultsCount: 0, latencyMs: 0,
        });
      }
    }
  }
  const response = await runSearch(input);
  // Relevance: a metasearch engine returns what the user searched for. Score each offer
  // by how many query words appear in its title (+ small boosts), drop non-matches when
  // matches exist, and rank priced + relevant first. Nothing is invented or reordered
  // by anything other than the visible title/price evidence.
  const STOP = new Set(['in','near','the','a','an','of','for','to','from','with','and','best','cheap','cheapest','online','buy','price','under','below']);
  const words = input.query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
  const stem = (w: string) => w.replace(/(ies|es|s)$/,'');
  const stems = words.map(stem);
  const scored = (response.results as any[]).map((o) => {
    const t = String(o.title || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    // Regex token boundary: 'milk' must appear as a WHOLE word, so 'buttermilk'
    // does not match 'milk'. Simple plural stemming keeps 'shoes' matching 'shoe'.
    const hit = stems.length ? stems.filter((w) => new RegExp(`\\b${w}`).test(t)).length / stems.length : 1;
    // Finance rows carry their comparable value in attributes when the page publishes
    // a rate/premium schedule rather than one purchasable price — those are valued.
    const financeAttrValued = ['loans', 'insurance', 'creditcards', 'banking'].includes(String((o as any).vertical))
      && (o.attributes?.interest_rate != null || o.attributes?.starting_premium != null || o.attributes?.amc != null || o.attributes?.min_balance != null
        || o.attributes?.annual_fee != null || o.attributes?.sum_insured != null);
    return { o, hit, priced: Number(o.prices?.effectivePrice ?? o.prices?.mandatoryTotal ?? 0) > 0 || financeAttrValued };
  });
  const verticalsNeedingTitleMatch = new Set(['food', 'grocery', 'ecommerce']);
  let kept = scored;
  if (verticalsNeedingTitleMatch.has(String(input.vertical)) && stems.length) {
    // STRICT QUERY-TO-ITEM TOKEN SANITISATION (owner rule): every query word must
    // appear as a whole word in the title. 'amul milk' must contain BOTH 'amul'
    // and 'milk'. Items missing any word are DISCARDED — no random substitutes,
    // no majority fallback. When nothing matches, the user sees an honest
    // 'no exact matches' notice instead of unrelated products.
    const full = scored.filter((x) => x.hit === 1);
    kept = full;
    if (!full.length) {
      res.json({
        results: [],
        honestNotice: `No exact matches for '${input.query}' from live sources right now. Sources returned only loosely related items, which we do not show.`,
        sourcesAttempted: response.state.sourcesAttempted,
        sourcesSucceeded: response.state.sourcesSucceeded,
        sourcesFailed: response.state.sourcesFailed,
        servedFrom: response.state.servedFrom,
        pendingRefresh: !!response.state.pendingRefresh,
        resultsCount: 0,
        latencyMs: response.latencyMs,
      });
      return;
    }
  }
  // Drop price-less rows when priced alternatives exist in the same vertical —
  // EXCEPT movies: a film's card merges every ticket site, and only some sites
  // expose seat-selection prices. And EXCEPT cabs: Uber/Rapido publish app-only
  // fares, so their real presence rows ("Fare on app") must survive alongside
  // Ola's priced rows (owner bug report 17 Oct: only Ola was showing).
  const keepUnpriced = ['movie', 'movies', 'cab', 'banking'].includes(String(input.vertical));
  if (kept.some((x) => x.priced) && !keepUnpriced) kept = kept.filter((x) => x.priced);
  // Bus: once LIVE operator fares exist, the transparent OSRM indicative estimate
  // row is redundant — show only real operator quotes.
  if (String(input.vertical) === 'bus') {
    const live = kept.filter((x) => (x.o.attributes as any)?.fare_type !== 'indicative_estimate');
    if (live.length) kept = live;
  }
  kept.sort((a, b) => b.hit - a.hit || Number(b.priced) - Number(a.priced) || (a.o.prices?.effectivePrice ?? 0) - (b.o.prices?.effectivePrice ?? 0));
  response.results = kept.map((x) => x.o) as any;
  // Map to the legacy shape; honestNotice is surfaced instead of fabricated deals
  const mappedItems = response.results.map((o: any) => {
    const item = offerToComparisonItem(o);
    return req.body.vertical === 'movie' ? { ...item, vertical: 'movie', category: 'movie' }
      : req.body.vertical === 'account' ? { ...item, vertical: 'account', category: 'account' }
      : item;
  });
  // Same product sold by several sellers -> ONE card with every seller's price (conservative matching).
  const brandById = new Map<string, { brand?: string; gtin?: string }>();
  for (const o of response.results as any[]) {
    const ids = o.identifiers || {};
    brandById.set(o.id, { brand: o.brand, gtin: ids.gtin || ids.ean || ids.upc || undefined });
  }
  const grouped = groupSameProduct(mappedItems as any[], (it: any) => brandById.get(it.id) || {});
  res.json({
    results: grouped,
    honestNotice: response.state.honestNotice,
    sourcesAttempted: response.state.sourcesAttempted,
    sourcesSucceeded: response.state.sourcesSucceeded,
    sourcesFailed: response.state.sourcesFailed,
    servedFrom: response.state.servedFrom,
        pendingRefresh: !!response.state.pendingRefresh,
    resultsCount: grouped.length,
    latencyMs: response.latencyMs,
  });
});

/** Legacy single-URL live scan — real HTTP + cheerio only. */
apiRouter.post('/scan/url', async (req, res) => {
  const url = String(req.body.url || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ success: false, error: 'A valid http(s) URL is required.' });
  const scan = await scrapeLiveUrl(url);
  // HONEST DATA POLICY: a page without a readable product title (bot wall, error
  // page, storefront template) is reported as not found — never a fabricated item.
  if (!scan.found || !scan.title) {
    return res.json({ success: true, found: false, message: scan.fetchNote || 'Could not read a product from that page. Nothing is simulated here.' });
  }
  // Competitor quotes come from the REAL live orchestrator, never invented.
  const scanQuery = searchableTitle(scan.title);
  const search = await runSearch({
    query: scanQuery,
    vertical: scan.vertical === 'movie' ? 'movies' : (scan.vertical || 'ecommerce'),
    city: req.body?.city,
    pincode: req.body?.pincode,
  } as SearchInput);
  const priced = (search.results as any[])
    .map((o) => ({ o, price: Number(o.prices?.effectivePrice ?? o.prices?.mandatoryTotal ?? 0) || 0 }))
    .filter((x) => x.price > 0);
  const relevant = scan.vertical === 'ecommerce' || !scan.vertical
    ? priced.filter((x) => isSameProduct(scanQuery, String(x.o.title || '')))
    : priced;
  const cheapestFirst = relevant.sort((a, b) => a.price - b.price).slice(0, 8);
  const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const sellerQuotes: any[] = cheapestFirst.map((x, i) => ({
    id: `sq-${x.o.id || i}`,
    sellerName: hotelSellerLabel(x.o, String(x.o.seller || x.o.vendor || hostOf(String(x.o.sellerUrl || '')) || 'Verified source')),
    price: x.price,
    currency: '₹',
    url: String(x.o.sellerUrl || '') ? createMaskingPointer(String(x.o.sellerUrl), { offerId: String(x.o.id || '') }) : '',
    isLowest: i === 0,
    isLiveScraped: true,
    sourceDomain: hostOf(String(x.o.sellerUrl || '')),
    deliveryOrEta: x.o.attributes?.eta ? `Delivers in ${x.o.attributes.eta}` : undefined,
  }));
  // The scanned page itself is a real quote only when it published a real price.
  if (scan.extractedPrice > 0) {
    sellerQuotes.unshift({
      id: `sq-page-${Date.now()}`,
      sellerName: scan.sourceDomain,
      price: scan.extractedPrice,
      currency: '₹',
      url,
      isLowest: false,
      isLiveScraped: true,
      sourceDomain: scan.sourceDomain,
    });
  }
  const primaryPrice = scan.extractedPrice > 0 ? scan.extractedPrice : (cheapestFirst[0]?.price ?? 0);
  if (!sellerQuotes.length) {
    return res.json({ success: true, found: false, message: 'The page was read, but no live competitor prices were found for that product right now. Nothing is simulated here.' });
  }
  const catalogueItem = {
    id: `scan-${Date.now()}`,
    vertical: scan.vertical,
    title: scan.title,
    category: scan.category,
    provider: scan.sourceDomain,
    primaryPrice,
    sellerQuotes,
    isLiveScraped: true,
    scrapedTimestamp: new Date().toISOString(),
    scrapedLatencyMs: scan.latencyMs,
  };
  saveItemToCatalogue(catalogueItem as any);
  res.json({ success: true, found: true, item: catalogueItem, rawScan: scan });
});

// ============ Price Lens: paste any product link -> cheapest across sites ============
apiRouter.post('/lens', async (req, res) => {
  const input = String(req.body?.input || req.body?.url || '').trim().slice(0, 2000);
  const url = extractUrl(input);
  if (!url) return res.status(400).json({ success: false, error: 'Paste a product link (https://...) to compare.' });
  const safe = isSafePublicUrl(url);
  if (!safe.ok) return res.status(400).json({ success: false, error: safe.reason || 'That link cannot be used.' });

  const product = await resolveProductFromLink(url);
  if (!product.title) {
    return res.json({
      success: true, found: false, product,
      message: product.fetchStatus === 'blocked'
        ? `${product.merchant || 'That site'} blocks automated reads and the link has no readable product name. Try typing the product name instead.`
        : 'Could not read a product name from that link. Try typing the product name instead.',
      results: [],
    });
  }
  const lensQuery = searchableTitle(product.title);
  const response = await runSearch({ query: lensQuery, vertical: 'ecommerce', city: req.body?.city, pincode: req.body?.pincode } as SearchInput);
  const priced = response.results
    .map((o: any) => ({ o, price: Number(o.prices?.effectivePrice ?? o.prices?.mandatoryTotal ?? 0) || 0 }))
    .filter((x) => x.price > 0 && isSameProduct(lensQuery, String(x.o.title || '')));
  const results = priced
    .sort((a, b) => a.price - b.price)
    .slice(0, 30)
    .map(({ o, price }) => ({
      id: o.id,
      title: o.title,
      seller: String(o.seller || o.vendor || ''),
      price,
      listPrice: Number(o.prices?.listPrice ?? 0) || 0,
      image: o.image || o.images?.[0] || null,
      availability: o.availability || 'unknown',
      goUrl: o.sellerUrl ? createMaskingPointer(o.sellerUrl, { offerId: String(o.id || '') }) : '',
    }));
  res.json({
    success: true,
    found: true,
    product,
    searchedAs: lensQuery,
    cheapest: results[0] || null,
    pageVsCheapest: product.pagePrice && results[0] ? { pagePrice: product.pagePrice, cheapest: results[0].price, saving: Math.max(0, product.pagePrice - results[0].price) } : null,
    servedFrom: response.state?.servedFrom,
    message: results.length ? undefined : 'No verified listing of this exact product was found on our sources right now.',
    results,
  });
});

// ============ In-site product page (BuyHatke-style): one call returns everything ============
// Same-product offers across sites + REAL recorded price history + honest deal score + related products.
apiRouter.post('/product-page', async (req, res) => {
  const input = String(req.body?.input || req.body?.url || '').trim().slice(0, 2000);
  const textQuery = String(req.body?.query || '').trim().slice(0, 200);
  // Seed offers come from the exact card the user clicked "Compare" on. The engine's
  // fresh search can flake per-attempt (a source circuit may be in backoff right now),
  // so the sellers that were ALREADY found for this product stay visible on the
  // comparison page. Each seed url must be one of our own masking pointers.
  const seedRaw = Array.isArray(req.body?.seed) ? req.body.seed.slice(0, 12) : [];
  const seed = seedRaw
    .map((x: any) => ({
      seller: String(x?.seller || '').trim().slice(0, 60),
      title: String(x?.title || '').trim().slice(0, 120),
      price: Number(x?.price) || 0,
      listPrice: Number(x?.listPrice) || 0,
      image: String(x?.image || '').startsWith('https://') ? String(x.image).slice(0, 500) : null,
      url: String(x?.url || '').startsWith('/api/out') ? String(x.url).slice(0, 2000) : '',
    }))
    .filter((x: any) => x.seller && x.price > 0 && x.url);
  const url = extractUrl(input);
  let product: any = null;
  let lensQuery = '';
  if (url) {
    const safe = isSafePublicUrl(url);
    if (!safe.ok) return res.status(400).json({ success: false, error: safe.reason || 'That link cannot be used.' });
    product = await resolveProductFromLink(url);
    if (!product.title) {
      return res.json({ success: true, found: false, product, message: product.fetchStatus === 'blocked'
        ? `${product.merchant || 'That site'} blocks automated reads and the link has no readable product name. Try typing the product name.`
        : 'Could not read a product name from that link. Try typing the product name.' });
    }
    lensQuery = searchableTitle(product.title);
  } else if (textQuery.length >= 2) {
    lensQuery = searchableTitle(textQuery);
    product = { title: textQuery, titleSource: 'typed', merchant: '', domain: '', pagePrice: null, image: null, fetchStatus: 'skipped' };
  } else {
    return res.status(400).json({ success: false, error: 'Paste a product link or type a product name.' });
  }

  // Resilience (extension deep-link fix): one exact-title search can flake per attempt
  // (a source circuit in backoff, or a stale cache entry from a transient failure), so a
  // second, broader query (brand + model, capacities dropped) runs in parallel. Each hits
  // its own cache/acquisition path; the union maximises the sellers found. isSameProduct
  // still decides what counts as this product, so a broader query never adds false rows.
  const broadQuery = (() => {
    const caps = new Set((lensQuery.match(/\b\d+\s?(gb|tb)\b/gi) || []).map((m: string) => m.toLowerCase().replace(/\s/g, '')));
    const toks = lensQuery.split(/\s+/).filter(Boolean);
    const keep = toks.filter((t: string) => !caps.has(t.toLowerCase().replace(/\s/g, ''))).slice(0, 4).join(' ');
    return keep && keep !== lensQuery ? keep : '';
  })();
  const searches: Array<Promise<any>> = [
    runSearch({ query: lensQuery, vertical: 'ecommerce', city: req.body?.city, pincode: req.body?.pincode } as SearchInput),
  ];
  if (broadQuery) searches.push(runSearch({ query: broadQuery, vertical: 'ecommerce', city: req.body?.city, pincode: req.body?.pincode } as SearchInput));
  const responses = await Promise.all(searches);
  const seenIds = new Set<string>();
  const priceOf = (o: any) => Number(o.prices?.effectivePrice ?? o.prices?.mandatoryTotal ?? 0) || 0;
  const all = responses.flatMap((r: any) => r.results || [])
    .filter((o: any) => !seenIds.has(String(o.id)) && seenIds.add(String(o.id)))
    .map((o: any) => ({ o, price: priceOf(o) }))
    .filter((x) => x.price > 0);
  const same = all.filter((x) => isSameProduct(lensQuery, String(x.o.title || ''))).sort((a, b) => a.price - b.price);
  const toRow = ({ o, price }: any) => {
    const attrs = o.attributes || {};
    const imgs = Array.from(new Set([
      String(attrs.image_url || o.image || o.images?.[0] || ''),
      ...String(attrs.image_urls || '').split('|'),
    ].filter((u: string) => u.startsWith('https://'))));
    return {
      id: o.id, title: o.title, seller: String(o.seller || o.vendor || ''), price,
      listPrice: Number(o.prices?.listPrice ?? 0) || 0,
      image: imgs[0] || null, images: imgs.slice(0, 8),
      availability: o.availability || 'unknown',
      rating: Number(attrs.rating) || null, reviews: Number(attrs.rating_count ?? attrs.review_count) || null,
      canonicalEntityId: o.canonicalEntityId ?? null,
      goUrl: o.sellerUrl ? createMaskingPointer(o.sellerUrl, { offerId: String(o.id || '') }) : '',
    };
  };
  // One row per SELLER (their cheapest listing of this product). Colour/variant duplicates from the
  // same seller collapse into `variantCount` so the list shows Amazon / Reliance / Flipkart / Myntra side by side.
  const sellerKey = (o: any) => String(o.seller || o.vendor || '').toLowerCase().trim();
  const bySeller = new Map<string, { row: any; count: number }>();
  for (const x of same) {
    const k = sellerKey(x.o) || String(x.o.id);
    const hit = bySeller.get(k);
    if (!hit) bySeller.set(k, { row: x, count: 1 });
    else hit.count += 1; // `same` is price-ascending, so the first row per seller is its cheapest
  }
  const offers = [...bySeller.values()]
    .sort((a, b) => a.row.price - b.row.price)
    .slice(0, 30)
    .map(({ row, count }) => ({ ...toRow(row), variantCount: count }));
  // Seed rows from the clicked card: sellers the fresh search did not return this
  // attempt. Their urls are already masking pointers (built when the card's quotes
  // were acquired), so they redirect through /api/out exactly like search rows.
  const offerSellers = new Set(offers.map((o: any) => String(o.seller).toLowerCase().trim()));
  for (const sd of seed) {
    const k = sd.seller.toLowerCase().trim();
    if (offerSellers.has(k)) continue;
    offers.push({
      id: `seed-${k}`, title: sd.title, seller: sd.seller, price: sd.price,
      listPrice: sd.listPrice || 0, image: sd.image, images: sd.image ? [sd.image] : [],
      availability: 'unknown', rating: null, reviews: null, canonicalEntityId: null,
      goUrl: sd.url, variantCount: 0,
    });
  }
  offers.sort((a: any, b: any) => a.price - b.price);
  const cheapest = offers[0] || null;

  // Related: other priced ecommerce results that are NOT this product (de-duplicated by title).
  const seen = new Set<string>(offers.map((r) => r.title.toLowerCase()));
  const related = all
    .filter((x) => !isSameProduct(lensQuery, String(x.o.title || '')))
    .map(toRow)
    .filter((r) => r.title && !seen.has(r.title.toLowerCase()) && seen.add(r.title.toLowerCase()))
    .slice(0, 10);

  // Real history: first same-product offer that carries a canonical entity id with recorded points.
  let history: Array<{ price: number; capturedAt: string }> = [];
  let historyEntity: number | null = null;
  try {
    const { priceHistoryForEntity } = await import('../catalogue/catalogueService');
    for (const r of offers) {
      const eid = Number(r.canonicalEntityId);
      if (!eid) continue;
      const rows = await priceHistoryForEntity(eid, 120);
      const pts = rows.map((x: any) => ({ price: Number(x.effective_price), capturedAt: x.captured_at })).filter((p: any) => p.price > 0);
      if (pts.length) { history = pts.reverse(); historyEntity = eid; break; }
    }
  } catch { /* history is optional; absence is reported honestly */ }

  const currentPrice = cheapest?.price ?? product.pagePrice ?? 0;
  const deal = analyseDeal(currentPrice, history, cheapest?.price ?? null);
  const pageVsCheapest = product.pagePrice && cheapest
    ? { pagePrice: product.pagePrice, cheapest: cheapest.price, saving: Math.max(0, product.pagePrice - cheapest.price) } : null;
  const images = Array.from(new Set([product.image, cheapest?.image, ...(cheapest?.images || []), ...offers.map((o) => o.image)].filter((u: any) => typeof u === 'string' && u.startsWith('https://')))).slice(0, 8);

  res.json({
    success: true, found: true, product, searchedAs: lensQuery, images,
    cheapest, offers, related, history, historyEntity, deal, pageVsCheapest,
    servedFrom: responses[0]?.state?.servedFrom,
    message: offers.length ? undefined : 'No verified listing of this exact product was found on our sources right now.',
  });
});

// ============ Price alerts (signed-in users; e-mail when a verified price hits the target) ============
apiRouter.get('/alerts', authMiddleware, requireAuth, async (req, res) => {
  const user = (req as any).user;
  res.json({ success: true, alerts: await listAlerts(Number(user.id)) });
});
apiRouter.post('/alerts', authMiddleware, requireAuth, async (req, res) => {
  const user = (req as any).user;
  const b = req.body || {};
  const r = await createAlert({
    userId: Number(user.id), email: String(user.email || b.email || ''),
    productTitle: String(b.productTitle || ''), searchQuery: String(b.searchQuery || ''),
    sourceUrl: b.sourceUrl ? String(b.sourceUrl) : null, image: b.image ? String(b.image) : null,
    targetPrice: Number(b.targetPrice), priceAtSet: b.priceAtSet ? Number(b.priceAtSet) : null,
  });
  if (!r.ok) return res.status(400).json({ success: false, error: r.error });
  res.json({ success: true, id: r.id });
});
apiRouter.delete('/alerts/:id', authMiddleware, requireAuth, async (req, res) => {
  const user = (req as any).user;
  const ok = await deleteAlert(Number(user.id), Number(req.params.id));
  res.status(ok ? 200 : 404).json({ success: ok });
});

// ============ Spend Lens: which website did you spend how much on ============
// Only user-confirmed purchases (typed in or confirmed from a redirect prefill).
// Clicks are NEVER counted as spend — that would be fabricated data.
apiRouter.get('/spend', authMiddleware, requireAuth, async (req, res) => {
  const user = (req as any).user;
  res.json({ success: true, ...(await spendSummary(Number(user.id))) });
});

apiRouter.post('/spend', authMiddleware, requireAuth, async (req, res) => {
  const user = (req as any).user;
  const b = req.body || {};
  const r = await addSpendEntry({
    userId: Number(user.id),
    merchant: String(b.merchant || ''),
    amount: Number(b.amount),
    itemTitle: b.itemTitle ? String(b.itemTitle) : null,
    vertical: b.vertical ? String(b.vertical) : null,
    entryDate: String(b.entryDate || ''),
    source: b.source === 'redirect' ? 'redirect' : 'manual',
  });
  if (!r.ok) return res.status(400).json({ success: false, error: r.error });
  res.json({ success: true, id: r.id, ...(await spendSummary(Number(user.id))) });
});

apiRouter.delete('/spend/:id', authMiddleware, requireAuth, async (req, res) => {
  const user = (req as any).user;
  const ok = await deleteSpendEntry(Number(user.id), Number(req.params.id));
  if (!ok) return res.status(404).json({ success: false });
  res.json({ success: true, ...(await spendSummary(Number(user.id))) });
});

// ============ Notifications hub (auto price drops + admin broadcasts) ============
// Anonymous visitors see admin broadcasts; signed-in users additionally get their
// own auto price-drop notifications with per-user read state.
apiRouter.get('/notifications', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user) {
      const { items, unread } = await userNotifications(Number(user.id));
      return res.json({ success: true, signedIn: true, items, unread });
    }
    res.json({ success: true, signedIn: false, items: await broadcastNotifications(), unread: 0 });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Could not load notifications' });
  }
});

apiRouter.post('/notifications/read', authMiddleware, requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const id = Number(req.body?.id);
    if (Number.isFinite(id) && id > 0) {
      await markRead(Number(user.id), id);
    } else {
      await markAllRead(Number(user.id));
    }
    const { items, unread } = await userNotifications(Number(user.id));
    res.json({ success: true, items, unread });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Could not mark read' });
  }
});

// ============ Home AI assistant: question (typed or spoken) -> vertical + query ============
apiRouter.post('/assist/intent', (req, res) => {
  const text = String(req.body?.text || '').slice(0, 300);
  res.json({ success: true, ...interpretAssistantQuestion(text) });
});

// ============ Catalogue & provenance ============
apiRouter.get('/catalogue', async (_req, res) => {
  try {
    const rows = await getStore().query<any>(
      `SELECT id, vertical, title, vendor, seller, seller_url, source_url, location_city, mandatory_total, effective_price, currency, availability,
              freshness_status, validation_status, fetched_at, source_id, attributes
       FROM offers ORDER BY fetched_at DESC LIMIT 200`,
    );
    res.json({ success: true, total: rows.length, items: rows, lastSavedAt: new Date().toISOString() });
  } catch {
    const legacy = getCatalogueState();
    res.json({ success: true, total: legacy.items.length, items: legacy.items, lastSavedAt: legacy.lastSavedAt });
  }
});

apiRouter.get('/picks', async (req, res) => {
  // Public: active admin-curated top picks for a vertical. Empty array = none configured (honest).
  try {
    const { listTopPicks } = await import('../marketing/placements');
    const picks = await listTopPicks(String(req.query.vertical || '') || undefined, false);
    res.json({ success: true, picks });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Could not load picks' });
  }
});

// GET /api/rewards/top-picks -> one best pick per vertical for the Rewards Top Picks section.
// Admin-curated picks (marketing placements) take precedence; verticals without one get an
// AUTO pick derived from the live offers catalogue (real rows only, never fabricated).
// Every destination is served as a masking pointer (/api/out) so affiliate tracking is
// injected server-side (owner rule: ALL rewards/ads redirect through /api/out).
apiRouter.get('/rewards/top-picks', async (_req, res) => {
  try {
    const { listTopPicks } = await import('../marketing/placements');
    const { itemFromOffer, imageFromAttributes, fetchVerticalOffers, pickTopOfferRow, ageDays, logoAnswers, realMerchantDomain, nameDomainOf } = await import('../home/showcase');

    const VERTICALS = ['ecommerce', 'grocery', 'food', 'flights', 'hotels', 'bus', 'cab', 'movie',
      'loans', 'insurance', 'creditcards', 'account'];

    const adminPicks = await listTopPicks(undefined, false);
    const picks: any[] = [];
    const covered = new Set<string>();

    for (const p of adminPicks || []) {
      const v = String(p.vertical || '').toLowerCase();
      covered.add(v);
      const dest = String(p.destination_url || '').trim();
      if (!dest) continue; // honest: a pick with no destination cannot redirect, so it is skipped
      picks.push({
        vertical: v,
        source: 'admin',
        partnerName: p.partner_name || '',
        headline: p.headline || '',
        offerText: p.offer_text || null,
        priceBadge: p.price_badge || null,
        badgeText: p.badge_text || null,
        rating: p.rating ?? null,
        image: p.image_url || null,
        ctaText: p.cta_text || 'Grab Deal',
        url: dest.startsWith('/api/out') ? dest : createMaskingPointer(dest, { offerId: `pick-${p.id}`, trusted: true }), // admin-curated pick
      });
    }

    // Auto picks from the live catalogue for verticals the admin has not curated.
    // Store-agnostic (owner 22 Oct): the pool fetch keeps SQL to shapes both the
    // MySQL and the file store parse; all selection math runs in JS.
    for (const v of VERTICALS) {
      if (covered.has(v)) continue;
      const rows = await fetchVerticalOffers(v, 300);
      const row = pickTopOfferRow(rows);
      if (!row) continue;
      const item = itemFromOffer(row);
      if (!item) continue;
      // Owner 22 Oct ("image ki jagah text aa raha hai"): never ship card art
      // that cannot load — the browser would render initials text in the slot.
      // A dead source image falls back to the merchant's own logo tile.
      if (item.image && !(await logoAnswers(item.image))) {
        const dom = realMerchantDomain([row.seller_url]) || nameDomainOf(item.merchant);
        item.image = dom ? `https://icons.duckduckgo.com/ip3/${dom}.ico` : item.image;
      }
      picks.push({
        vertical: v,
        source: 'live',
        partnerName: item.merchant,
        headline: String(row.title || '').slice(0, 90),
        offerText: item.badge,
        priceBadge: item.price != null ? `Rs ${Math.round(item.price)}` : null,
        badgeText: item.discountPct ? `${item.discountPct}% OFF` : null,
        rating: item.rating,
        image: item.image,
        ctaText: 'View Deal',
        url: item.url,
      });
    }

    res.json({ success: true, picks });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Could not load top picks' });
  }
});

apiRouter.get('/ads', async (req, res) => {
  // Public: active ad slot config (AdSense ids or custom HTML). Nothing configured -> active: false.
  try {
    const { getAdSlot } = await import('../marketing/placements');
    const slot = await getAdSlot(String(req.query.slot || ''));
    res.json({ success: true, active: Boolean(slot), slot });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Could not load ad slot' });
  }
});

// ============ Deals (public) ============
// GET /api/deals?merchant=flipkart&kind=coupon&vertical=ecommerce&hasImage=1  -> live, unexpired deals (affiliate-free pointers) + counts
apiRouter.get('/deals', async (req, res) => {
  try {
    const { getDealsWithCounts } = await import('../marketing/deals');
    const { deals, counts } = await getDealsWithCounts({
      merchant: req.query.merchant as string | undefined,
      kind: req.query.kind as string | undefined,
      vertical: req.query.vertical as string | undefined,
      hasImage: req.query.hasImage as string | undefined,
      limit: Number(req.query.limit) || 100,
    });
    res.json({ success: true, deals, counts });
  } catch { res.json({ success: true, deals: [], counts: {} }); }
});

// POST /api/smart-cart/compare — Smart Cart (owner rule): total the basket at
// every store and rank by FULL-basket cost; 'Shop at <store>' exits route
// through /api/out like every other deal link.
apiRouter.post('/smart-cart/compare', async (req, res) => {
  try {
    const rawItems = Array.isArray((req.body || {}).items) ? (req.body as any).items : [];
    const items: BasketItemIn[] = rawItems
      .slice(0, 12) // shared-hosting budget: 12 parallel grocery searches
      .map((x: any) => ({ name: String(x?.name || '').slice(0, 120).trim(), qty: Math.min(Math.max(Number(x?.qty) || 1, 1), 20) }))
      .filter((x: BasketItemIn) => x.name);
    if (!items.length) return res.status(400).json({ success: false, error: 'Add at least one product to the Smart Cart.' });

    const searches = await Promise.all(items.map(async (it) => {
      try {
        const response = await runSearch({ query: it.name, vertical: 'grocery', pincode: (req.body as any).pincode, city: (req.body as any).city, locality: (req.body as any).locality } as SearchInput);
        const offers: StoreOfferIn[] = (response.results as any[])
          .filter((o: any) => Number(o?.prices?.price) > 0 && o?.seller)
          .map((o: any) => ({
            seller: String(o.seller).slice(0, 80),
            price: Number(o.prices.price),
            title: String(o.title || it.name),
            url: o.sellerUrl ? createMaskingPointer(String(o.sellerUrl), { offerId: String(o.id || '') }) : null,
          }));
        const { unitPrices } = bestUnitPricesPerStore(it.name, offers);
        return { name: it.name, qty: it.qty, unitPrices, found: unitPrices.length > 0 } as ItemCompare;
      } catch { return { name: it.name, qty: it.qty, unitPrices: [], found: false } as ItemCompare; }
    }));

    const comparison = computeStoreTotals(searches);
    // Exits always route through /api/out for server-side affiliate injection.
    res.json({ success: true, comparison });
  } catch (e: any) {
    res.status(500).json({ success: false, error: String(e?.message || e).slice(0, 160) });
  }
});

// GET /api/partners -> approved partner directory (admin-approved inquiries)
apiRouter.get('/partners', async (_req, res) => {
  try {
    const { listPartners } = await import('../marketing/partners');
    res.json({ success: true, partners: await listPartners(true) });
  } catch { res.json({ success: true, partners: [] }); }
});

// GET /api/deals/for-seller?seller=Flipkart -> the seller's best offers + coupons for the redirect page
apiRouter.get('/deals/for-seller', async (req, res) => {
  try {
    const { forSellerWithBest } = await import('../marketing/deals');
    const result = await forSellerWithBest(String(req.query.seller || ''), Number(req.query.limit) || 6);
    res.json({ success: true, deals: result.deals, best: result.best });
  } catch { res.json({ success: true, deals: [], best: { offer: null, coupon: null } }); }
});

// ============ Leads (public write, owner 21 Oct: real server-side persistence) ============
// Simple in-memory rate cap per IP: 20 submissions/minute (shared-hosting friendly).
const leadHits = new Map<string, { n: number; reset: number }>();
function leadRateOk(ip: string): boolean {
  const now = Date.now();
  const h = leadHits.get(ip);
  if (!h || now > h.reset) { leadHits.set(ip, { n: 1, reset: now + 60_000 }); return true; }
  if (h.n >= 20) return false;
  h.n += 1;
  return true;
}

// POST /api/leads -> save a finance-vertical enquiry (Loans/Insurance/Credit Cards/Accounts),
// then hand back a /api/out masking pointer so the affiliate injection stays server-side.
apiRouter.post('/leads', async (req, res) => {
  try {
    if (!leadRateOk(String(req.ip || req.socket?.remoteAddress || 'anon'))) {
      return res.status(429).json({ success: false, error: 'Too many submissions. Please try again in a minute.' });
    }
    const { saveLead, validateLead } = await import('../marketing/leads');
    const v = validateLead(req.body || {});
    if (!v.ok) return res.status(400).json({ success: false, error: v.error });
    const id = await saveLead(req.body || {});
    const destUrl = String((req.body || {}).destUrl || '').trim();
    let redirectUrl: string | null = null;
    if (destUrl && /^https:\/\//.test(destUrl)) redirectUrl = createMaskingPointer(destUrl, { offerId: `lead-${id}` });
    res.json({ success: true, id, redirectUrl });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Could not save your enquiry' });
  }
});

// POST /api/partner-inquiry -> footer "become a partner" form (E2E: now persists server-side).
apiRouter.post('/partner-inquiry', async (req, res) => {
  try {
    if (!leadRateOk(String(req.ip || req.socket?.remoteAddress || 'anon'))) {
      return res.status(429).json({ success: false, error: 'Too many submissions. Please try again in a minute.' });
    }
    const { saveLead } = await import('../marketing/leads');
    const id = await saveLead({ ...(req.body || {}), source: 'partner_inquiry' });
    res.json({ success: true, id });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Could not save your inquiry' });
  }
});

// GET /api/merchant/leads?vendorId=&category= -> finance leads for the merchant portal.
apiRouter.get('/merchant/leads', async (req, res) => {
  try {
    const vendorId = String(req.query.vendorId || '').trim();
    if (!vendorId) return res.status(400).json({ success: false, error: 'vendorId required' });
    const { listLeads } = await import('../marketing/leads');
    // Finance verticals only — merchant dashboards never see travel/ecom leads.
    const all = await listLeads({ limit: 300 });
    const finance = all.filter((l) => ['loans', 'insurance', 'creditcards', 'account'].includes(String(l.vertical || '')));
    res.json({ success: true, leads: finance });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Could not load leads' });
  }
});

// ============ Merchant logos (owner 21 Oct: admin-uploaded brand logos) ============
// GET /api/merchant-logos -> { logos: { key: dataUrl } } for the whole site (cached client-side).
// GET /api/logos/:key — admin-uploaded merchant logo served as a real HTTP image
// (stable absolute URL usable by web <img>, Flutter Image.network and email clients).
apiRouter.get('/logos/:key', async (req, res) => {
  try {
    const { getMerchantLogo, decodeLogoDataUrl } = await import('../marketing/merchantLogos');
    const row = await getMerchantLogo(String(req.params.key || ''));
    const dec = row ? decodeLogoDataUrl(row.logo) : null;
    if (!dec) return res.status(404).type('image/png').end();
    res.set('Cache-Control', 'public, max-age=300');
    res.type(dec.mime).send(dec.bytes);
  } catch {
    res.status(404).end();
  }
});

apiRouter.get('/merchant-logos', async (_req, res) => {
  try {
    const { merchantLogoMap } = await import('../marketing/merchantLogos');
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ success: true, logos: await merchantLogoMap() });
  } catch { res.json({ success: true, logos: {} }); }
});

apiRouter.get('/app-links', async (_req, res) => {
  // Public: admin-configured download links (Chrome extension / Android / iOS). Unset -> null.
  try {
    const { getPublicAppLinks } = await import('../marketing/appLinks');
    res.json({ success: true, links: await getPublicAppLinks() });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Could not load app links' });
  }
});

apiRouter.get('/quick-apps', async (_req, res) => {
  // Public: curated partner-app catalogue shown in "Quick Apps". Customer-safe fields only:
  // payout rates / amounts are internal commercial data and are never exposed.
  try {
    const { INITIAL_QUICK_APP_PARTNERS } = await import('../../src/data/quickAppsData');
    const apps = INITIAL_QUICK_APP_PARTNERS.filter((p) => p.status === 'active').map((p) => ({
      id: p.id, name: p.name, iconUrl: p.iconUrl, category: p.category, description: p.description,
      webUrl: p.webUrl, rating: p.rating, downloadsOrUsers: p.downloadsOrUsers || null, badge: p.badge || null,
    }));
    res.json({ success: true, apps });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Could not load quick apps' });
  }
});

apiRouter.get('/provenance', async (_req, res) => {
  try {
    const rows = await getStore().query<any>(
      `SELECT offer_id, source_id, source_method, source_url, fetched_at, extracted_fields, evidence_hash
       FROM source_evidence ORDER BY id DESC LIMIT 200`,
    );
    res.json({ success: true, totalLogs: rows.length, logs: rows });
  } catch {
    const legacy = getCatalogueState();
    res.json({ success: true, totalLogs: legacy.provenanceLogs.length, logs: legacy.provenanceLogs });
  }
});

// ============ Affiliate redirect endpoint (Section 15) ============
apiRouter.get('/go', async (req, res) => {
  const dest = String(req.query.url || '');
  if (!dest) return res.status(400).json({ success: false, error: 'Missing destination' });
  const decision = await resolveRedirect(dest, { offerId: req.query.offerId as string | undefined });
  if (!decision.allowed) return res.status(400).json({ success: false, error: `Refused: ${decision.reason}` });
  res.json({ success: true, clickId: decision.clickId, redirectUrl: decision.destination, viaNetwork: decision.viaNetwork });
});

// ============ Masking-pointer redirect (Module 4) ============
// GET /api/out?t=<signed pointer> -> validate -> build affiliate deeplink
// server-side -> record click -> 302. Tokens never live in the browser.
// ============ Cab in-app booking (owner 22 Oct) ============
// Uber/Ola rows link here; we resolve coordinates (caller-supplied first, else
// the cached Nominatim geo proxy), apply the ADMIN-configured affiliate params,
// then route through /api/out so server-side click tracking still applies.
apiRouter.get('/cab/book', async (req, res) => {
  const provider = String(req.query.provider || '').toLowerCase() === 'ola' ? 'ola' : 'uber';
  const pickupName = String(req.query.pickup || '').trim();
  const dropName = String(req.query.drop || '').trim();
  if (!dropName) return res.status(400).send('Missing drop location.');
  const cfg = await getCabDeeplinkConfig();
  const pLat = numParam(req.query.pLat); const pLng = numParam(req.query.pLng);
  const dLat = numParam(req.query.dLat); const dLng = numParam(req.query.dLng);
  const pickup = (pLat != null && pLng != null)
    ? { lat: pLat, lng: pLng, name: pickupName || 'Current location' }
    : (pickupName ? await geocodeCabPlace(pickupName) : null);
  const drop = (dLat != null && dLng != null)
    ? { lat: dLat, lng: dLng, name: dropName }
    : await geocodeCabPlace(dropName);
  const honestRefuse = (msg: string) => res.status(422).send(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Booking link unavailable</title></head>` +
    `<body style="font-family:system-ui,sans-serif;text-align:center;padding-top:12vh;color:#0f172a">` +
    `<h2 style="font-weight:700">${provider === 'uber' ? 'Uber' : 'Ola'} app booking isn't available for this trip</h2>` +
    `<p style="color:#475569">${msg}</p><p><a href="/" style="color:#e11d48;font-weight:700">Back to Try1Second</a></p></body></html>`);
  if (!drop) return honestRefuse('We could not resolve the drop location to coordinates, and nothing is simulated here. Please open the provider app directly.');
  const url = provider === 'uber'
    ? buildUberBookUrl({ cfg, pickup, drop })
    : (pickup ? buildOlaBookUrl({ cfg, pickup, drop }) : null);
  if (!url) return honestRefuse(
    provider === 'uber' && !pickup
      ? 'We could not resolve your pickup location. Please open the app directly.'
      : 'In-app booking for this provider is currently disabled by the admin. Please try again later.');
  const pointer = createMaskingPointer(url, { offerId: String(req.query.offerId || '') });
  res.redirect(302, `/api/out?t=${encodeURIComponent(pointer)}`);
});

apiRouter.get('/out', async (req, res) => {
  const resolved = resolveMaskingPointer(String(req.query.t || ''));
  if (!resolved) return res.status(410).send('This link has expired. Please search again for a fresh link.');
  // Registry-fed / admin-partner destinations carry trusted provenance (pointer
  // stamped at creation) — their merchant bridge pages may embed a url= param.
  const check = validateDestination(resolved.destination, { allowEmbeddedRedirect: resolved.trusted === true });
  if (!check.valid) {
    log.warn('Api', 'Out pointer refused', { reason: check.reason });
    return res.status(400).send(
      `<!doctype html><html><head><meta charset="utf-8"><title>Link not verified</title></head>` +
      `<body style="font-family:system-ui,sans-serif;text-align:center;padding-top:15vh;color:#0f172a">` +
      `<h2 style="font-weight:700">This link couldn't be verified</h2>` +
      `<p style="color:#475569">For your safety we didn't open it (${check.reason}).</p>` +
      `<p><a href="/" style="color:#e11d48;font-weight:700">Search again on Try1Second</a></p></body></html>`);
  }
  const dl = await buildSecureDeeplink(resolved.destination);
  await recordPointerClick(resolved.destination, resolved.offerId, dl.network);
  res.redirect(302, dl.trackingUrl);
});

// ============ Auth ============
apiRouter.post('/auth/register', async (req, res) => {
  const r = await registerUser(String(req.body.email || ''), String(req.body.password || ''), req.body.displayName);
  if (!r.ok) return res.status(400).json({ success: false, error: r.error });
  res.json({ success: true, userId: r.userId });
});

apiRouter.post('/auth/login', async (req, res) => {
  const r = await loginUser(String(req.body.email || ''), String(req.body.password || ''));
  if (!r.ok) return res.status(401).json({ success: false, error: r.error });
  res.json({ success: true, token: r.token, user: r.user });
});

// Find-or-create a passwordless (Google) user and open a session. Shared by web + mobile Google sign-in.
async function signInGoogleUser(claims: { email: string; uid: string; displayName?: string }) {
  const store = getStore();
  let rows = await store.query<any>('SELECT id, email, display_name, role FROM users WHERE email = ?', [claims.email]);
  if (rows.length === 0) {
    await store.execute('INSERT INTO users (email, password_hash, display_name, role, firebase_uid) VALUES (?, NULL, ?, ?, ?)', [
      claims.email, claims.displayName || null, 'user', claims.uid,
    ]);
    rows = await store.query<any>('SELECT id, email, display_name, role FROM users WHERE email = ?', [claims.email]);
  }
  const row = rows[0];
  const token = crypto.randomBytes(32).toString('hex');
  await store.execute('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)', [
    token, Number(row.id), new Date(Date.now() + SESSION_TTL_SEC * 1000).toISOString().slice(0, 19).replace('T', ' '),
  ]);
  return { token, row };
}

// ============ Firebase Google sign-in (main-site users) ============
apiRouter.post('/auth/firebase', async (req, res) => {
  if (!settings.firebaseProjectId) {
    return res.status(503).json({ success: false, error: 'Google sign-in is not configured (set FIREBASE_PROJECT_ID)' });
  }
  const idToken = String(req.body?.idToken || '');
  if (!idToken) return res.status(400).json({ success: false, error: 'Missing Google ID token' });

  const result = await verifyFirebaseIdTokenDetailed(idToken);
  if (!result.claims) {
    const { reason, detail } = result;
    log.warn('FirebaseAuth', `Google sign-in rejected (${reason}${detail ? `: ${detail}` : ''})`);
    const messages: Record<string, [number, string]> = {
      server_not_configured: [503, 'Google sign-in is not configured on the server (FIREBASE_PROJECT_ID)'],
      audience_mismatch: [401, 'Google sign-in rejected: the token belongs to a different Firebase project than the server expects. Check FIREBASE_PROJECT_ID.'],
      issuer_mismatch: [401, 'Google sign-in rejected: token issuer is not Firebase for this project.'],
      expired: [401, 'Google session expired. Please sign in again.'],
      clock_skew: [500, 'Server clock is out of sync with Google. Please retry in a minute.'],
      certs_unreachable: [502, 'Could not download Google verification certificates from the server. Please retry.'],
      unknown_signing_key: [401, 'Google signing key not recognized (certificates may have rotated). Please retry.'],
      bad_signature: [401, 'Google token signature failed verification.'],
      malformed: [400, 'Google sign-in token was malformed.'],
      bad_claims: [401, 'Google sign-in token is missing required claims.'],
    };
    const [status, error] = messages[reason] ?? [401, 'Google sign-in could not be verified'];
    return res.status(status).json({ success: false, error, reason });
  }
  const claims = result.claims;

  try {
    const { token, row } = await signInGoogleUser(claims);
    res.json({ success: true, token, user: { id: Number(row.id), email: row.email, role: row.role, displayName: row.display_name || claims.displayName || undefined } });
  } catch (err) {
    log.error('FirebaseAuth', `Account provisioning failed: ${(err as Error).message}`);
    res.status(500).json({ success: false, error: 'Google sign-in verified, but creating your account failed on the server. Please try again shortly.', reason: 'account_provisioning_failed' });
  }
});

// Who am I? — restores a session after page reload
// ============ Google sign-in for the mobile app (Google ID token, no Firebase SDK) ============
apiRouter.post('/auth/google-mobile', async (req, res) => {
  if (!settings.googleOauthClientIds.length) {
    return res.status(503).json({ success: false, error: 'Mobile Google sign-in is not configured (set GOOGLE_OAUTH_CLIENT_IDS)' });
  }
  const idToken = String(req.body?.idToken || '');
  if (!idToken) return res.status(400).json({ success: false, error: 'Missing Google ID token' });
  const claims = await verifyGoogleIdToken(idToken);
  if (!claims) return res.status(401).json({ success: false, error: 'Google sign-in could not be verified' });

  try {
    const { token, row } = await signInGoogleUser(claims);
    res.json({ success: true, token, user: { id: Number(row.id), email: row.email, role: row.role, displayName: row.display_name || claims.displayName || undefined, picture: claims.picture } });
  } catch (err) {
    log.error('GoogleAuth', `Account provisioning failed: ${(err as Error).message}`);
    res.status(500).json({ success: false, error: 'Google sign-in verified, but creating your account failed on the server. Please try again shortly.', reason: 'account_provisioning_failed' });
  }
});

apiRouter.get('/auth/me', authMiddleware, requireAuth, async (req, res) => {
  const user = (req as any).user;
  res.json({ success: true, user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName || undefined } });
});

// ============ Admin email-OTP login (Resend) ============
apiRouter.post('/auth/otp/request', async (req, res) => {
  const r = await requestAdminOtp(String(req.body.email || ''));
  if (!r.ok) return res.status(429).json({ success: false, error: r.error });
  // Generic success (enumeration-safe); delivery problems are surfaced only as a generic retry message.
  res.json({ success: true, message: 'If the address is an admin account, a login code has been sent.' });
});

apiRouter.post('/auth/otp/verify', async (req, res) => {
  const r = await verifyAdminOtp(String(req.body.email || ''), String(req.body.code || ''));
  if (!r.ok) return res.status(401).json({ success: false, error: r.error });
  const email = r.email!;
  const store = getStore();
  let rows = await store.query<any>('SELECT id, email, display_name, role FROM users WHERE email = ?', [email]);
  // Bootstrap: the configured ADMIN_EMAIL becomes the admin account on first OTP login.
  if (rows.length === 0 && settings.adminEmails.includes(email)) {
    await store.execute('INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)', [
      email, `otp-only$${crypto.randomBytes(16).toString('hex')}`, 'Owner Admin', 'admin',
    ]);
    rows = await store.query<any>('SELECT id, email, display_name, role FROM users WHERE email = ?', [email]);
  }
  if (rows.length === 0 || rows[0].role !== 'admin') return res.status(403).json({ success: false, error: 'Not an admin account' });
  const u = rows[0];
  const token = crypto.randomBytes(32).toString('hex');
  await store.execute('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)', [
    token, Number(u.id), new Date(Date.now() + SESSION_TTL_SEC * 1000).toISOString().slice(0, 19).replace('T', ' '),
  ]);
  res.json({ success: true, token, user: { id: Number(u.id), email: u.email, role: u.role, displayName: u.display_name || undefined } });
});

// ============ Rewards: referrals & spins (Section 18) ============
apiRouter.use(authMiddleware);

apiRouter.get('/rewards/me', requireAuth, async (req, res) => {
  const user = (req as any).user;
  res.json({
    success: true,
    validPoints: await validPointBalance(user.id),
    availableEligibilities: await eligibleSpinCount(user.id),
    pointsPerSpinEligibility: 100,
    rules: {
      oneValidReferral: 'exactly one point',
      eligibility: '100 valid points grant one spin eligibility',
      resultVisibility: 'spin results are visible only to you',
      noCashbackWallet: true,
      noCashbackWithdrawal: true,
      noPointsToCash: true,
    },
  });
});

apiRouter.post('/rewards/referral', requireAuth, async (req, res) => {
  const user = (req as any).user;
  const refereeId = Number(req.body.refereeId || 0);
  if (!refereeId) return res.status(400).json({ success: false, error: 'refereeId is required' });
  const r = await registerReferral(user.id, refereeId);
  if (!r.ok) return res.status(400).json({ success: false, error: r.error });
  res.json({ success: true, awarded: r.awarded });
});

apiRouter.post('/rewards/eligibility/claim', requireAuth, async (req, res) => {
  const user = (req as any).user;
  const r = await claimSpinEligibility(user.id);
  if (!r.ok) return res.status(400).json({ success: false, error: r.error });
  res.json({ success: true, eligibilityId: r.eligibilityId });
});

apiRouter.post('/rewards/spin', requireAuth, async (req, res) => {
  const user = (req as any).user;
  const outcome = await executeSpin(user.id, req.body.idempotencyKey || undefined);
  if (outcome.status === 'NO_ELIGIBILITY') {
    return res.status(400).json({ success: false, error: 'No spin eligibility available (100 valid points required per spin)' });
  }
  if (outcome.status === 'NO_PRIZES') {
    return res.status(503).json({ success: false, error: 'No prizes currently configured with inventory. Your eligibility is preserved.' });
  }
  if (outcome.status === 'ERROR') {
    return res.status(500).json({ success: false, error: 'Spin failed — eligibility preserved, safe to retry' });
  }
  res.json({ success: true, status: outcome.status, spinId: outcome.spinId, prize: outcome.prize });
});

apiRouter.get('/rewards/spin/:spinId', requireAuth, async (req, res) => {
  const user = (req as any).user;
  const r = await getSpinResult(user.id, Number(req.params.spinId));
  if (r.status === 'FORBIDDEN') return res.status(403).json({ success: false, error: 'This spin belongs to another user' });
  if (r.status === 'NOT_FOUND') return res.status(404).json({ success: false, error: 'Spin not found' });
  res.json({ success: true, prize: r.prize });
});

apiRouter.post('/rewards/fulfilment', requireAuth, async (req, res) => {
  const user = (req as any).user;
  const r = await submitFulfilmentDetails(user.id, Number(req.body.spinId || 0), {
    name: String(req.body.name || ''),
    phone: String(req.body.phone || ''),
    location: String(req.body.location || ''),
  });
  if (!r.ok) return res.status(400).json({ success: false, error: r.error });
  res.json({ success: true, message: 'Fulfilment details submitted (visible only to prize fulfilment admins)' });
});

// ============ Bootstrap for the server entrypoint ============
export async function bootstrapBackend(): Promise<void> {
  try {
    const migrations = await runMigrations();
    if (migrations.applied.length > 0) log.info('Bootstrap', `Applied migrations: ${migrations.applied.join(', ')}`);
    // FILE → MYSQL AUTO-IMPORT (self-healing, 21 Oct): production history that
    // accumulated in the file-fallback store (leads, logos, admin users) is
    // imported into MySQL on the first durable boot. Background — never blocks
    // HTTP serving; resumes after a crash (INSERT IGNORE is idempotent).
    import('../common/fileImport').then(({ importFileStoreIntoMysql }) => importFileStoreIntoMysql()).catch((e: any) =>
      log.error('Bootstrap', `file-store import failed: ${e && e.message}`));
  } catch (err: any) {
    // Bad credentials / DB down must not 503 the whole site: degrade to the file store.
    log.error('Bootstrap', `MySQL migrations failed: ${err.code || ''} ${err.message}`);
    // SELF-HEAL (owner 21 Oct, ER_ACCESS_DENIED_ERROR): a co-located Hostinger app
    // is usually granted localhost access only; hPanel's shown hostname/IP in DB_HOST
    // gets denied. Retry with localhost / 127.0.0.1 before giving up on durability.
    if (String(err.code || '').includes('ER_ACCESS_DENIED') || /access denied/i.test(String(err.message || ''))) {
      const recovered = await recoverMysqlWithLocalHost().catch(() => false);
      if (recovered) {
        try {
          const retry = await runMigrations();
          if (retry.applied.length > 0) log.info('Bootstrap', `Applied migrations after localhost self-heal: ${retry.applied.join(', ')}`);
          log.info('Bootstrap', 'MySQL recovered — durable source of truth restored');
          const loaded = await loadSourcesFromDb();
          log.info('Bootstrap', `Sources loaded (db: ${loaded.dbKind}, overlay rows: ${loaded.loaded})`);
          return;
        } catch (e2: any) {
          log.error('Bootstrap', `MySQL still failing after localhost self-heal: ${e2.code || ''} ${e2.message}`);
        }
      }
      // Honest checklist for the owner — exact hPanel steps, no guessing.
      log.warn('Bootstrap', 'MySQL ACCESS DENIED checklist: 1) hPanel > Databases > your DB > check the user is ASSIGNED to this database with ALL PRIVILEGES; 2) re-enter the DB_PASSWORD in the Node.js app env (DB_USER/DB_PASSWORD must match the DB user, not the hPanel login); 3) set DB_HOST=localhost — the app runs on the same server as MySQL; 4) after fixing, restart the Node.js app.');
    }
    log.error('Bootstrap', 'Falling back to file store until DB env vars are fixed and the app is restarted.');
    resetToFileStore();
  }
  const loaded = await loadSourcesFromDb();
  log.info('Bootstrap', `Sources loaded (db: ${loaded.dbKind}, overlay rows: ${loaded.loaded})`);
  await initCache();
}
