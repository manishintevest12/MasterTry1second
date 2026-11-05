/**
 * Cron cache-warmer (Section 8 + Section 12):
 *   Runs on a schedule (hPanel cron / KVM4 crontab). Reads the most frequent
 *   recent queries from the `searches` table and pre-runs them so the catalogue
 *   and cache tiers (L1 memory / L2 Redis / L3 MySQL) are warm before real
 *   users arrive. New users then hit warm cache instantly; only offers whose
 *   freshness policy demands live prices are re-acquired.
 *
 *   Usage:  node cron.cjs [--limit=20] [--vertical=ecommerce]
 *   hPanel cron (shared hosting, every 30 minutes):
 *     30 * * * * cd /home/uXXXXX/domains/try1second.com/app && node cron.cjs >> cron.log 2>&1
 */
import { getStore, runMigrations } from '../common/db';
import { runSearchPolled } from '../search/searchOrchestrator';
import { log } from '../common/logger';
import { purgeStaleBankingOffers, purgePhotolessHotelOffers } from '../catalogue/catalogueService';
import { backgroundAllowed, resourceSnapshot } from '../common/resourceGuard';
import { settings } from '../common/settings';

/**
 * Seed queries (Section 8): when the searches table has no history yet (fresh
 * install, new vertical), the warmer pre-runs these so the DEFAULT query each
 * vertical's page fires on load returns from warm cache in milliseconds.
 * These mirror the frontend's per-vertical DEFAULT_QUERY set.
 */
// Owner 23 Oct (loader 3-2-1 must end with 100% results): every client (web +
// Flutter APK) ALWAYS sends its location with the default search — city AND
// pincode. Seeds warmed without those fields land on a DIFFERENT cache key
// (key = vertical|q|pin|city), so the client's default request MISSED the warm
// cache and went live every time (3-5s+). Seeds now warm the exact client
// shape: city 'Indore', pincode '452001' — matching defaultQueryFor() and the
// web's targetLoc default.
import { departmentSeedQueries } from '../lens/ecomDepartments';

export const SEED_QUERIES: Array<{ query: string; vertical: string; city?: string; pincode?: string }> = [
  { query: 'mobile phone', vertical: 'ecommerce', city: 'Indore', pincode: '452001' },
  { query: 'milk', vertical: 'grocery', city: 'Indore', pincode: '452001' },
  { query: 'biryani', vertical: 'food', city: 'Indore', pincode: '452001' },
  { query: 'movies', vertical: 'movies', city: 'Indore', pincode: '452001' },
  // OWNER 4 Nov: these must be the EXACT seeds the clients open with (src/lib/verticalSeed.ts,
  // flutter_app/lib/core/verticals.dart) - hotels "Goa", flights "<city> to New Delhi",
  // bus "<city> to Nagpur" - because a seed warmed under a different query is a different cache
  // key, so the user's first tap still went live (the 22 Oct lesson, one seed drift later).
  { query: 'Indore to Nagpur', vertical: 'bus', city: 'Indore', pincode: '452001' },
  { query: 'Rajwada Indore to Airport Indore', vertical: 'cab', city: 'Indore', pincode: '452001' },
  { query: 'Indore to New Delhi', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'Goa', vertical: 'hotels', city: 'Indore', pincode: '452001' },
  { query: 'personal loan', vertical: 'loans', city: 'Indore', pincode: '452001' },
  { query: 'health insurance', vertical: 'insurance', city: 'Indore', pincode: '452001' },
  { query: 'hdfc credit card', vertical: 'creditcards', city: 'Indore', pincode: '452001' },
  { query: 'best credit card', vertical: 'creditcards', city: 'Indore', pincode: '452001' },
  { query: 'pizza', vertical: 'food', city: 'Indore', pincode: '452001' },
  { query: 'delhi to jaipur', vertical: 'bus' },
  { query: 'goa', vertical: 'hotels' },
  { query: 'savings account', vertical: 'banking', city: 'Indore', pincode: '452001' },
  { query: 'demat account', vertical: 'banking', city: 'Indore', pincode: '452001' },
  // Owner 22 Oct: Best-in-Tech section must span laptops/TVs/appliances, not just
  // phones — warm those catalogues so the section always has fresh rows to show.
  { query: 'refrigerator', vertical: 'ecommerce', city: 'Indore', pincode: '452001' },
  { query: 'iphone', vertical: 'ecommerce', city: 'Indore', pincode: '452001' },
  { query: 'laptop', vertical: 'ecommerce', city: 'Indore', pincode: '452001' },
  { query: 'smart tv', vertical: 'ecommerce', city: 'Indore', pincode: '452001' },
  { query: 'washing machine', vertical: 'ecommerce', city: 'Indore', pincode: '452001' },
  // Owner 29 Oct ("tab pr click kr ke smart watch ya kuch v karo, pehle to results nahi
  // aata"): every e-commerce DEPARTMENT is a browse query in its own right, and a tapped
  // tab must open on warm rows like the defaults do - not on a cold, empty page that only
  // fills after the first live scan. Warmed from the department table so the list can
  // never drift from the tabs again.
  ...departmentSeedQueries().map((q) => ({ query: q, vertical: 'ecommerce', city: 'Indore', pincode: '452001' })),
  // Owner 27 Oct ("result fast aane hi chaiye"): the product page compares retail AND
  // 10-minute grocery, so the everyday grocery basket is warmed too — these are the
  // queries that were landing cold and taking the full deadline.
  { query: 'tata salt 1 kg', vertical: 'grocery', city: 'Indore', pincode: '452001' },
  { query: 'amul taaza toned milk 1 l', vertical: 'grocery', city: 'Indore', pincode: '452001' },
  { query: 'amul butter 500 g', vertical: 'grocery', city: 'Indore', pincode: '452001' },
  { query: 'maggi 2 minute noodles 12 pack', vertical: 'grocery', city: 'Indore', pincode: '452001' },
  { query: 'atta 5 kg', vertical: 'grocery', city: 'Indore', pincode: '452001' },
  { query: 'sunflower oil 1 l', vertical: 'grocery', city: 'Indore', pincode: '452001' },
  { query: 'bread', vertical: 'grocery', city: 'Indore', pincode: '452001' },
  { query: 'eggs', vertical: 'grocery', city: 'Indore', pincode: '452001' },
  // Popular retail product lookups (product page first paint reads this catalogue).
  { query: 'iphone 16', vertical: 'ecommerce', city: 'Indore', pincode: '452001' },
  { query: 'samsung galaxy s25', vertical: 'ecommerce', city: 'Indore', pincode: '452001' },
  { query: 'oneplus 12', vertical: 'ecommerce', city: 'Indore', pincode: '452001' },
  { query: 'sony wh-1000xm5', vertical: 'ecommerce', city: 'Indore', pincode: '452001' },
  { query: 'boat earbuds', vertical: 'ecommerce', city: 'Indore', pincode: '452001' },
];

/**
 * FINANCE DAILY REFRESH (owner 23 Oct: "loan, insurance, credit card, bank
 * account ka data change ni hota frequently tho inko save kr ke result fast do
 * aur din me ek baar scrap krwao"). These segments' rate/card/account tables
 * move at most daily, so their search cache TTL is 24h (see searchCacheTtl).
 * Warming them every keep-warm cycle is: a cache HIT the other 47 cycles of
 * the day (free, no source hit), and exactly ONE live scrape per query per
 * day when the 24h TTL expires — the daily scrape the owner asked for, with
 * the segment always serving instantly from cache. Client-shape parity
 * (city 'Indore', pincode '452001') so the warm key equals the default-search
 * key the web + Flutter clients actually send.
 */
/**
 * Slow-moving catalogue verticals (owner 29 Oct: "movies, ecommerce, credit card ye sab har
 * samay change ni hote — din me ek baar peeche se chale aur data real time sab ko mile").
 *
 * These three publish catalogues that move at most once a day (a film's showtimes, a phone's
 * listed price, a bank's card table), yet every user search used to pay for a live scan. With
 * a 24h search TTL they are now a free cache hit all day and the ONE live refresh happens in
 * the background when the day expires — every user, at every hour, still reads the same saved
 * catalogue instantly.
 */
/**
 * Hourly, PER-CITY catalogue refresh (owner 29 Oct; corrected the same day: "sorry din mai ek
 * baar ni hr 1 ghunte mai ek baar kro. hr city ke liye check kr naa").
 *
 * Movies, e-commerce and credit cards keep a 1-hour search TTL, so the keep-warm rotation
 * (every 12 min) re-scrapes each pair as it expires and every user reads a saved catalogue.
 * Those seeds used to name Indore only, so every other city opened on a cold page. The
 * rotation now expands the slow-catalogue queries across the cities people actually search
 * from - top cities from the `searches` table first, then a fixed fallback list - and walks
 * them round-robin, so every city refreshes within the hour without one cycle stampeding
 * dozens of live scans.
 */
export const CATALOGUE_QUERIES: Array<{ query: string; vertical: string }> = [
  // Movies — the city listing plus the two things people type.
  { query: 'movies in', vertical: 'movies' },
  { query: 'movie tickets', vertical: 'movies' },
  // Credit cards — the broad intents (issuer queries live in FINANCE_DAILY_SEEDS).
  { query: 'credit card', vertical: 'creditcards' },
  { query: 'best credit card', vertical: 'creditcards' },
  // E-commerce — one intent per department family (SEED_QUERIES already warms Indore).
  { query: 'mobile phone', vertical: 'ecommerce' },
  { query: 'laptop', vertical: 'ecommerce' },
  { query: 'smart watch', vertical: 'ecommerce' },
];

/** Cities warmed even before any search traffic tells us where users are. */
export const FALLBACK_CITIES: Array<{ city: string; pincode: string }> = [
  { city: 'Indore', pincode: '452001' },
  { city: 'Bhopal', pincode: '462001' },
  { city: 'Mumbai', pincode: '400001' },
  { city: 'Delhi', pincode: '110001' },
  { city: 'Bengaluru', pincode: '560001' },
  { city: 'Hyderabad', pincode: '500001' },
  { city: 'Pune', pincode: '411001' },
  { city: 'Jaipur', pincode: '302001' },
  { city: 'Ahmedabad', pincode: '380001' },
  { city: 'Lucknow', pincode: '226001' },
];

let catalogueCursor = 0;

/**
 * Which cities to warm: real demand first (distinct cities in the last 7 days of searches),
 * topped up from FALLBACK_CITIES so a brand-new install still covers the metros. Never more
 * than `max`, never duplicated.
 */
export async function catalogueCities(max = 10): Promise<Array<{ city: string; pincode: string }>> {
  const out: Array<{ city: string; pincode: string }> = [];
  const seen = new Set<string>();
  try {
    const store = getStore();
    const rows: Array<Record<string, any>> = await store.query(
      `SELECT city, MAX(pincode) AS pincode, COUNT(*) AS n
       FROM searches
       WHERE created_at > (NOW() - INTERVAL 7 DAY) AND city IS NOT NULL AND city <> ''
       GROUP BY city ORDER BY n DESC LIMIT ?`,
      [max],
    ).catch(() => [] as Array<Record<string, any>>);
    for (const r of rows) {
      const city = String(r.city || '').trim();
      const pincode = String(r.pincode || '').trim();
      const key = city.toLowerCase();
      if (!city || seen.has(key)) continue;
      seen.add(key);
      out.push({ city, pincode });
    }
  } catch { /* demand lookup is an optimisation */ }
  for (const c of FALLBACK_CITIES) {
    if (out.length >= max) break;
    const key = c.city.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out.slice(0, max);
}

/**
 * The pairs to warm THIS cycle: query × city walked round-robin from a persistent cursor, so
 * a 12-minute rotation covers every city within the hour instead of re-scanning Indore 10
 * times. Returns at most `perCycle` entries.
 */
export async function hourlyCatalogueSeeds(perCycle = 18): Promise<Array<{ query: string; vertical: string; city: string; pincode: string }>> {
  const cities = await catalogueCities();
  const pairs: Array<{ query: string; vertical: string; city: string; pincode: string }> = [];
  for (const q of CATALOGUE_QUERIES) {
    for (const c of cities) {
      const query = q.query.endsWith(' in') || q.query.endsWith('tickets')
        ? `${q.query} ${c.city}`.replace(/\s+/g, ' ')
        : q.query;
      pairs.push({ query, vertical: q.vertical, city: c.city, pincode: c.pincode });
    }
  }
  if (!pairs.length) return [];
  const take = Math.min(perCycle, pairs.length);
  const slice: typeof pairs = [];
  for (let i = 0; i < take; i += 1) {
    slice.push(pairs[(catalogueCursor + i) % pairs.length]);
  }
  catalogueCursor = (catalogueCursor + take) % pairs.length;
  return slice;
}

export const FINANCE_DAILY_SEEDS: Array<{ query: string; vertical: string; city?: string; pincode?: string }> = [
  // Loans — every BankBazaar loan-type page the worker routes to.
  { query: 'home loan', vertical: 'loans', city: 'Indore', pincode: '452001' },
  { query: 'car loan', vertical: 'loans', city: 'Indore', pincode: '452001' },
  { query: 'education loan', vertical: 'loans', city: 'Indore', pincode: '452001' },
  { query: 'business loan', vertical: 'loans', city: 'Indore', pincode: '452001' },
  // Insurance — term/health/car are the BankBazaar pages the worker serves.
  { query: 'term insurance', vertical: 'insurance', city: 'Indore', pincode: '452001' },
  { query: 'car insurance', vertical: 'insurance', city: 'Indore', pincode: '452001' },
  // Credit cards — issuer queries users actually type.
  { query: 'sbi credit card', vertical: 'creditcards', city: 'Indore', pincode: '452001' },
  { query: 'icici credit card', vertical: 'creditcards', city: 'Indore', pincode: '452001' },
  { query: 'axis credit card', vertical: 'creditcards', city: 'Indore', pincode: '452001' },
  // Bank accounts — the account vertical's most common intents.
  { query: 'current account', vertical: 'banking', city: 'Indore', pincode: '452001' },
  { query: 'zero balance account', vertical: 'banking', city: 'Indore', pincode: '452001' },
];

/**
 * FAMOUS DESTINATIONS WARM (owner 22 Oct: the homepage's Famous Destinations
 * section needs (a) a recorded flight fare naming the city and (b) a hotel row
 * with real art. Users mostly search Indore routes, so without warm coverage
 * the section honestly stays empty (the owner's report). Two entries are
 * re-warmed per keep-warm cycle (one flight route + one hotel city alternating
 * via rotation), so every listed destination refreshes its real fare roughly
 * every ~4 hours (40 entries at 2 per cycle) — same honesty rules as every other warm: real searches,
 * recorded prices, nothing invented.
 */
const DESTINATION_WARM: Array<{ query: string; vertical: string; city?: string; pincode?: string }> = [
  // Owner 23 Oct: the six homepage cities lead the rotation so their recorded
  // fares + hotel art stay the freshest (Jaipur, Manali, Udaipur, Mumbai,
  // Kolkata, Goa).
  { query: 'Indore to Jaipur', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'jaipur', vertical: 'hotels' },
  { query: 'Indore to Manali', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'manali', vertical: 'hotels' },
  { query: 'Indore to Udaipur', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'udaipur', vertical: 'hotels' },
  { query: 'Indore to Mumbai', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'mumbai', vertical: 'hotels' },
  { query: 'Indore to Kolkata', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'kolkata', vertical: 'hotels' },
  { query: 'Indore to Goa', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'goa', vertical: 'hotels' },
  { query: 'Indore to Delhi', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'delhi', vertical: 'hotels' },
  { query: 'goa', vertical: 'hotels' },
  { query: 'Indore to Mumbai', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'mumbai', vertical: 'hotels' },
  { query: 'Indore to Bengaluru', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'bengaluru', vertical: 'hotels' },
  { query: 'Indore to Hyderabad', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'hyderabad', vertical: 'hotels' },
  { query: 'Indore to Srinagar', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'srinagar', vertical: 'hotels' },
  { query: 'Indore to Dubai', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'dubai', vertical: 'hotels' },
  { query: 'Indore to Bangkok', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'bangkok', vertical: 'hotels' },
  { query: 'Indore to Singapore', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'singapore', vertical: 'hotels' },
  { query: 'Indore to Shimla', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'shimla', vertical: 'hotels' },
  // Owner 22 Oct (min 6 destination cards): wider candidate pool — every extra
  // destination still needs its own real fare + real hotel art before a card
  // renders; the rotation just keeps them fresh like the original twelve.
  { query: 'Indore to Ahmedabad', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'ahmedabad', vertical: 'hotels' },
  { query: 'Indore to Pune', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'pune', vertical: 'hotels' },
  { query: 'Indore to Kochi', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'kochi', vertical: 'hotels' },
  { query: 'Indore to Varanasi', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'varanasi', vertical: 'hotels' },
  { query: 'Indore to Amritsar', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'amritsar', vertical: 'hotels' },
  { query: 'Indore to Lucknow', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'lucknow', vertical: 'hotels' },
  { query: 'Indore to Chandigarh', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'chandigarh', vertical: 'hotels' },
  { query: 'Indore to Dehradun', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'dehradun', vertical: 'hotels' },
];

let destWarmCursor = 0;

/**
 * Warm the next four destinations (flight route + hotel city, alternating).
 * Owner 22 Oct (min 6 destination cards): 4 entries per pass covers the whole
 * 20-destination rotation in ~2h (12-min cadence) so every Top Destinations
 * candidate keeps a fresh recorded fare + fresh hotel rows with live art.
 */
/**
 * WARM LEASE (owner 29 Oct — Hostinger switched the whole account into its
 * protective CPU/reCAPTCHA mode because the account was burning too much CPU, and
 * that blocked every mobile request).
 *
 * Warm work is the account's biggest optional CPU user, and with WEB_CONCURRENCY
 * workers plus the fire-and-forget emergency warm, several processes could each
 * start a full pass at the same moment. A MySQL advisory lease (GET_LOCK with a
 * 0s wait, released as soon as the pass ends) means exactly ONE process warms at a
 * time, whichever got there first; everyone else simply returns and stays idle.
 * This is a cooperative lease, not a lifetime lock: a crashed warmer releases it.
 */
let warmLeaseConn: any = null;

async function getWarmLease(): Promise<boolean> {
  if (!settings.mysqlUrl) return true;             // single-instance / file mode
  if (warmLeaseConn) return true;                  // already ours
  try {
    const mysql = (await import('mysql2/promise')).default as any;
    const conn = await mysql.createConnection(settings.mysqlUrl);
    const [rows] = (await conn.query('SELECT COALESCE(GET_LOCK(?, 0), 0) AS got', ['try1second_warm_pass'])) as any[];
    if (Number(rows?.[0]?.got) !== 1) { await conn.end().catch(() => undefined); return false; }
    conn.on('error', () => undefined);
    warmLeaseConn = conn;
    // A pass that wedges must never hold the lease for the rest of the process life.
    setTimeout(() => { void releaseWarmLease(); }, 20 * 60_000).unref?.();
    return true;
  } catch {
    return true;                                   // MySQL hiccup must not stop warming
  }
}

async function releaseWarmLease(): Promise<void> {
  const conn = warmLeaseConn;
  warmLeaseConn = null;
  if (!conn) return;
  try {
    await conn.query('SELECT RELEASE_LOCK(?)', ['try1second_warm_pass']);
    await conn.end();
  } catch { /* holder is gone; the lock died with it */ }
}

/** True when this pass may run: resource governor says yes AND nobody else is warming. */
async function mayWarm(tag: string): Promise<boolean> {
  if (!backgroundAllowed()) {
    log.info(tag, 'Warm pass skipped (resource governor: box under pressure or background disabled)', resourceSnapshot() as any);
    return false;
  }
  if (!(await getWarmLease())) {
    log.info(tag, 'Warm pass skipped (another process holds the warm lease)');
    return false;
  }
  return true;
}

export async function keepWarmDestinations(): Promise<void> {
  if (DESTINATION_WARM.length === 0) return;
  if (!(await mayWarm('DestWarm'))) return;
  const slice: Array<Record<string, any>> = [];
  for (let i = 0; i < 4; i++) {
    slice.push(DESTINATION_WARM[(destWarmCursor + i) % DESTINATION_WARM.length]);
  }
  destWarmCursor = (destWarmCursor + 4) % DESTINATION_WARM.length;
  await warmRows(slice, 'DestWarm');
}

async function warmRows(rows: Array<Record<string, any>>, tag: string): Promise<void> {
  let ok = 0;
  for (const r of rows) {
    try {
      const res = await runSearchPolled({
        query: String(r.raw_query || r.query || ''),
        vertical: r.v || r.vertical ? String(r.v || r.vertical) : undefined,
        pincode: r.pincode ? String(r.pincode) : undefined,
        city: r.city ? String(r.city) : undefined,
      }, 20_000);
      ok += 1;
      log.info(tag, 'Warmed', { query: r.raw_query || r.query, vertical: r.v || r.vertical, results: res.results.length, servedFrom: res.state.servedFrom });
    } catch (e: any) {
      log.warn(tag, 'Warm pass failed (continuing)', { query: r.raw_query || r.query, error: String(e?.message || e).slice(0, 120) });
    }
    // HTTP-PRIORITY YIELD: a full event-loop turn between warm queries keeps the
    // shared-hosting process serving users while the warmer works through its list.
    await new Promise((r) => setImmediate(r));
  }
  log.info(tag, `Warmer finished: ${ok}/${rows.length} queries warmed`);
  // Hand the lease back so the next interval (or another worker) can warm.
  await releaseWarmLease();
}

/**
 * Boot-time warm (server startup): non-blocking, small budget (6 queries) so the
 * shared-hosting process starts listening FIRST and the most popular searches get
 * warm while the site is already usable. Safe to call concurrently with cron.
 */
export async function bootWarm(): Promise<void> {
  try {
    if (!(await mayWarm('BootWarm'))) return;
    // Hygiene (21 Oct): drop stale-shape banking rows from the pre-worker account impl.
    await purgeStaleBankingOffers();
    // Hygiene (22 Oct): drop photo-less stale hotel rows (pre-gallery batches wrote
    // no image_url; warm rotation repopulates them with real property art).
    await purgePhotolessHotelOffers();
    const store = getStore();
    const rows: Array<Record<string, any>> = await store.query(
      `SELECT raw_query, COALESCE(detected_vertical, vertical) AS v, pincode, city
       FROM searches WHERE created_at > (NOW() - INTERVAL 7 DAY)
       GROUP BY raw_query, v, pincode, city
       ORDER BY COUNT(*) DESC LIMIT 6`,
    ).catch(() => []);
    // Instant-on-open (owner request, 13 Oct): warm EVERY vertical's DEFAULT query at
    // boot (SEED_QUERIES mirrors the frontend DEFAULT_QUERY set with the default city
    // Indore), plus the most-searched recent queries. A vertical then never opens empty:
    // its default search is served from warm cache the moment the page loads, and the
    // user can search something else if they want.
    const seen = new Set<string>();
    const targets: Array<Record<string, any>> = [];
    const push = (r: Record<string, any>) => {
      const key = `${String(r.raw_query || r.query || '')}|${String(r.v || r.vertical || '')}`;
      if (!seen.has(key)) { seen.add(key); targets.push(r); }
    };
    (rows.length > 0 ? rows : []).forEach(push);
    SEED_QUERIES.forEach(push);
    log.info('Cron', `Boot-warm starting (${targets.length} queries: all vertical defaults + top searches, background)`);
    void warmRows(targets, 'BootWarm'); // fire-and-forget: never block the listen()
  } catch (e: any) {
    log.warn('Cron', 'Boot-warm skipped', { error: String(e?.message || e).slice(0, 100) });
    await releaseWarmLease();
  }
}

/**
 * Keep-warm (13 Oct): re-runs ALL vertical default queries so their caches never go
 * fully cold while the server is up (travel verticals: 5min fresh + 15min stale-serve;
 * every other vertical: 15min + 45min). Called every ~12 minutes by the refresh
 * worker, so opening any vertical always serves instantly from cache. Stale-serve
 * keeps the acquisition cost low: only genuinely expired queries re-hit sources.
 */
export async function keepWarmDefaults(): Promise<void> {
  if (!(await mayWarm('KeepWarm'))) return;
  // FINANCE_DAILY_SEEDS ride along on every keep-warm cycle: with their 24h
  // search TTL this is a cache hit (free) all day and the ONE live daily scrape
  // when they expire — the owner's "din me ek baar scrap" (23 Oct).
  // Slow-catalogue verticals (movies / e-commerce / credit cards) refresh HOURLY and for
  // EVERY city (owner 29 Oct): a rotating slice of query x city pairs rides each 12-minute
  // cycle, so the whole set is refreshed within the hour without a stampede.
  let catalogue: Array<{ query: string; vertical: string; city?: string; pincode?: string }> = [];
  try {
    catalogue = await hourlyCatalogueSeeds();
  } catch (e: any) {
    log.warn('Cron', 'Hourly catalogue seeds unavailable this cycle', { error: String(e?.message || e).slice(0, 120) });
  }
  await warmRows([...SEED_QUERIES, ...FINANCE_DAILY_SEEDS, ...catalogue], 'KeepWarm');
}

/** One warm pass: fresh top queries from the last 7 days (or seeds). */
async function warmPass(limit: number, verticalFilter: string | undefined, forceSeed: boolean) {
  const store = getStore();
  const rows: Array<Record<string, any>> = await store.query(
    `SELECT raw_query, COALESCE(detected_vertical, vertical) AS v, pincode, city, COUNT(*) AS n
     FROM searches
     WHERE created_at > (NOW() - INTERVAL 7 DAY)
     ${verticalFilter ? 'AND COALESCE(detected_vertical, vertical) = ?' : ''}
     GROUP BY raw_query, v, pincode, city
     ORDER BY n DESC
     LIMIT ?`,
    verticalFilter ? [verticalFilter, limit] : [limit],
  ).catch(() => [] as Array<Record<string, any>>);

  const useSeed = forceSeed || rows.length === 0;
  if (useSeed) {
    log.info('Cron', `Warmer: pre-warming ${SEED_QUERIES.length} seed queries (fresh install / --seed)`);
    await warmRows(SEED_QUERIES, 'Cron');
    return;
  }
  await warmRows(rows, 'Cron');
}

async function main() {
  const args = process.argv.slice(2);
  const limit = Number((args.find((a) => a.startsWith('--limit=')) || '--limit=20').split('=')[1]);
  const verticalFilter = args.find((a) => a.startsWith('--vertical='))?.split('=')[1];
  const forceSeed = args.includes('--seed');
  const intervalArg = Number((args.find((a) => a.startsWith('--interval=')) || '--interval=0').split('=')[1]);
  const intervalMin = intervalArg > 0 ? intervalArg : (process.env.CRON_INTERVAL_MIN ? Number(process.env.CRON_INTERVAL_MIN) : 0);

  await runMigrations();

  if (!intervalMin || !Number.isFinite(intervalMin) || intervalMin <= 0) {
    await warmPass(limit, verticalFilter, forceSeed);
    process.exit(0);
  }

  // Interval mode: stay alive and re-warm every N minutes (e.g. --interval=5).
  log.info('Cron', `Interval mode: warm pass every ${intervalMin} min (no recent queries falls back to seeds)`);
  await warmPass(limit, verticalFilter, forceSeed);
  setInterval(() => {
    warmPass(limit, verticalFilter, forceSeed).catch((e) => {
      log.warn('Cron', 'Interval warm pass failed (will retry next tick)', { error: String(e?.message || e).slice(0, 150) });
    });
  }, intervalMin * 60_000);
}

// CRITICAL (fix, 13 Oct): only run the cron CLI when this file IS the script
// (node cron.cjs / tsx server/cron/warm.ts). The server imports the SAME module
// for bootWarm() — without this guard that import ALSO launched a full 20-query
// warm pass and then process.exit(0), KILLING the freshly booted server (the
// boot→warm→exit→restart loop seen in production logs on 13 Oct 13:19).
const invokedAsScript = /cron/.test(String(process.argv[1] || ''));
if (invokedAsScript) {
  main().catch((e) => { log.error('Cron', 'Warmer crashed', { error: String(e) }); process.exit(1); });
}
