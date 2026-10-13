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
import { runSearch } from '../search/searchOrchestrator';
import { log } from '../common/logger';

/**
 * Seed queries (Section 8): when the searches table has no history yet (fresh
 * install, new vertical), the warmer pre-runs these so the DEFAULT query each
 * vertical's page fires on load returns from warm cache in milliseconds.
 * These mirror the frontend's per-vertical DEFAULT_QUERY set.
 */
const SEED_QUERIES: Array<{ query: string; vertical: string; city?: string }> = [
  { query: 'mobile phone', vertical: 'ecommerce' },
  { query: 'milk', vertical: 'grocery', city: 'Indore' },
  { query: 'biryani', vertical: 'food', city: 'Indore' },
  { query: 'movies', vertical: 'movies', city: 'Indore' },
  { query: 'Indore to Bhopal', vertical: 'bus', city: 'Indore' },
  { query: 'Indore to Bhopal', vertical: 'cab', city: 'Indore' },
  { query: 'Indore (IDR) to Delhi (DEL)', vertical: 'flights', city: 'Indore' },
  { query: 'Indore', vertical: 'hotels', city: 'Indore' },
  { query: 'personal loan', vertical: 'loans' },
  { query: 'health insurance', vertical: 'insurance' },
  { query: 'iphone', vertical: 'ecommerce' },
  { query: 'pizza', vertical: 'food', city: 'Indore' },
  { query: 'delhi to jaipur', vertical: 'bus' },
  { query: 'goa', vertical: 'hotels' },
];

async function warmRows(rows: Array<Record<string, any>>, tag: string): Promise<void> {
  let ok = 0;
  for (const r of rows) {
    try {
      const res = await runSearch({
        query: String(r.raw_query || r.query || ''),
        vertical: r.v || r.vertical ? String(r.v || r.vertical) : undefined,
        pincode: r.pincode ? String(r.pincode) : undefined,
        city: r.city ? String(r.city) : undefined,
      });
      ok += 1;
      log.info(tag, 'Warmed', { query: r.raw_query || r.query, vertical: r.v || r.vertical, results: res.results.length, servedFrom: res.state.servedFrom });
    } catch (e: any) {
      log.warn(tag, 'Warm pass failed (continuing)', { query: r.raw_query || r.query, error: String(e?.message || e).slice(0, 120) });
    }
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
    const store = getStore();
    const rows: Array<Record<string, any>> = await store.query(
      `SELECT raw_query, COALESCE(detected_vertical, vertical) AS v, pincode, city
       FROM searches WHERE created_at > (NOW() - INTERVAL 7 DAY)
       GROUP BY raw_query, v, pincode, city
       ORDER BY COUNT(*) DESC LIMIT 6`,
    ).catch(() => []);
    const targets = rows.length > 0 ? rows : SEED_QUERIES.slice(0, 6);
    log.info('Cron', `Boot-warm starting (${targets.length} queries, background)`);
    void warmRows(targets, 'BootWarm'); // fire-and-forget: never block the listen()
  } catch (e: any) {
    log.warn('Cron', 'Boot-warm skipped', { error: String(e?.message || e).slice(0, 100) });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limit = Number((args.find((a) => a.startsWith('--limit=')) || '--limit=20').split('=')[1]);
  const verticalFilter = args.find((a) => a.startsWith('--vertical='))?.split('=')[1];

  await runMigrations();
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
  );

  const useSeed = rows.length === 0 || args.includes('--seed');
  if (rows.length === 0 && !useSeed) {
    log.info('Cron', 'Warmer: no recent queries to warm yet');
    process.exit(0);
  }
  if (useSeed) {
    log.info('Cron', `Warmer: pre-warming ${SEED_QUERIES.length} seed queries (fresh install / --seed)`);
    await warmRows(SEED_QUERIES, 'Cron');
    process.exit(0);
  }

  await warmRows(rows, 'Cron');
  process.exit(0);
}

main().catch((e) => { log.error('Cron', 'Warmer crashed', { error: String(e) }); process.exit(1); });
