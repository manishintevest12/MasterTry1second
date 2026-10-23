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
const SEED_QUERIES: Array<{ query: string; vertical: string; city?: string; pincode?: string }> = [
  { query: 'mobile phone', vertical: 'ecommerce', city: 'Indore', pincode: '452001' },
  { query: 'milk', vertical: 'grocery', city: 'Indore', pincode: '452001' },
  { query: 'biryani', vertical: 'food', city: 'Indore', pincode: '452001' },
  { query: 'movies', vertical: 'movies', city: 'Indore', pincode: '452001' },
  { query: 'Indore to Bhopal', vertical: 'bus', city: 'Indore', pincode: '452001' },
  { query: 'Indore to Bhopal', vertical: 'cab', city: 'Indore', pincode: '452001' },
  { query: 'Indore (IDR) to Delhi (DEL)', vertical: 'flights', city: 'Indore', pincode: '452001' },
  { query: 'Indore', vertical: 'hotels', city: 'Indore', pincode: '452001' },
  { query: 'personal loan', vertical: 'loans', city: 'Indore', pincode: '452001' },
  { query: 'health insurance', vertical: 'insurance', city: 'Indore', pincode: '452001' },
  { query: 'hdfc credit card', vertical: 'creditcards', city: 'Indore', pincode: '452001' },
  { query: 'best credit card', vertical: 'creditcards', city: 'Indore', pincode: '452001' },
  { query: 'iphone', vertical: 'ecommerce', city: 'Indore', pincode: '452001' },
  { query: 'pizza', vertical: 'food', city: 'Indore', pincode: '452001' },
  { query: 'delhi to jaipur', vertical: 'bus' },
  { query: 'goa', vertical: 'hotels' },
  { query: 'savings account', vertical: 'banking', city: 'Indore', pincode: '452001' },
  { query: 'demat account', vertical: 'banking', city: 'Indore', pincode: '452001' },
  // Owner 22 Oct: Best-in-Tech section must span laptops/TVs/appliances, not just
  // phones — warm those catalogues so the section always has fresh rows to show.
  { query: 'laptop', vertical: 'ecommerce', city: 'Indore', pincode: '452001' },
  { query: 'smart tv', vertical: 'ecommerce', city: 'Indore', pincode: '452001' },
  { query: 'refrigerator', vertical: 'ecommerce', city: 'Indore', pincode: '452001' },
  { query: 'washing machine', vertical: 'ecommerce', city: 'Indore', pincode: '452001' },
];

/**
 * FAMOUS DESTINATIONS WARM (owner 22 Oct): the homepage's Famous Destinations
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
export async function keepWarmDestinations(): Promise<void> {
  if (DESTINATION_WARM.length === 0) return;
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
}

/**
 * Boot-time warm (server startup): non-blocking, small budget (6 queries) so the
 * shared-hosting process starts listening FIRST and the most popular searches get
 * warm while the site is already usable. Safe to call concurrently with cron.
 */
export async function bootWarm(): Promise<void> {
  try {
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
  await warmRows(SEED_QUERIES, 'KeepWarm');
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
