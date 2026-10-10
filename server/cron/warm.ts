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

  if (rows.length === 0) {
    log.info('Cron', 'Warmer: no recent queries to warm yet');
    process.exit(0);
  }

  let ok = 0;
  for (const r of rows) {
    try {
      const res = await runSearch({
        query: String(r.raw_query || ''),
        vertical: r.v ? String(r.v) : undefined,
        pincode: r.pincode ? String(r.pincode) : undefined,
        city: r.city ? String(r.city) : undefined,
      });
      ok += 1;
      log.info('Cron', 'Warmed', { query: r.raw_query, vertical: r.v, results: res.results.length, servedFrom: res.state.servedFrom });
    } catch (e: any) {
      log.warn('Cron', 'Warm pass failed (continuing)', { query: r.raw_query, error: String(e?.message || e).slice(0, 120) });
    }
  }
  log.info('Cron', `Warmer finished: ${ok}/${rows.length} queries warmed`);
  process.exit(0);
}

main().catch((e) => { log.error('Cron', 'Warmer crashed', { error: String(e) }); process.exit(1); });
