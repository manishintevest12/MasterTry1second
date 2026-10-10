/** Cron: affiliate offers sync runner.
 *  hPanel:  15 * * * * cd /app-folder && node affiliate-sync.cjs >> cron.log 2>&1
 *  Also runs in-process every 6h when the server boots (startAffiliateScheduler).
 */
import { runMigrations } from '../common/db';
import { syncAllAffiliates } from '../affiliate/aggregator';
import { log } from '../common/logger';

async function main() {
  await runMigrations();
  const outcomes = await syncAllAffiliates();
  const ok = outcomes.filter((o) => o.ok).length;
  log.info('Cron', 'Affiliate sync finished', { ok, total: outcomes.length, outcomes });
  process.exit(0);
}
main().catch((e) => { log.error('Cron', 'Affiliate sync crashed', { error: String(e) }); process.exit(1); });
