/**
 * Catalogue retention (owner fix, 21 Oct — "Database size limit reached").
 *
 * Root cause: every accepted offer wrote rows into offers + source_evidence +
 * price_history, plus source_health on every probe, and NOTHING ever deleted
 * them. The catalogue is only eligible for ~1h, so days of dead rows piled up
 * until Hostinger's database size cap was hit. Measured in the dev store:
 * ~13MB written in 5 minutes of warming — the same write volume with no
 * retention fills a capped shared-hosting database.
 *
 * Fix: bounded retention, enforced by the singleton background owner
 * (pruneCatalogue) — dead rows are deleted in small batches so locks stay
 * short, and the tables are compacted once at boot so the disk space actually
 * returns to the host (DELETE alone never shrinks InnoDB files).
 *
 * MySQL-only by design: the dev file store is already row-capped in db.ts.
 */
import { getStore } from '../common/db';
import { log } from '../common/logger';

const BATCH = 2000;
const DAY = 86_400_000;

/** Retention windows — generous vs the 1h catalogue eligibility, tight vs the cap. */
const RETENTION = {
  offersDays: 2,        // catalogue rows older than this can never be served
  evidenceDays: 2,      // mirrors offers
  priceHistoryDays: 2,  // historical snapshots; 2 days is ample for trend display
  sourceHealthDays: 2,  // health probes fire constantly, tiny rows but millions of them
  searchesDays: 8,      // warm seeds read a 7-day window
  orphanEntityDays: 15, // canonical entities with no live offer and no recent use
} as const;

async function batchedDelete(sql: string, params: unknown[]): Promise<number> {
  const store = getStore();
  let total = 0;
  for (let i = 0; i < 60; i++) {
    const res = await store.execute(`${sql} LIMIT ${BATCH}`, params);
    const n = res.affectedRows || 0;
    total += n;
    if (n < BATCH) break;
    // Short pause between batches: keeps InnoDB row locks brief and leaves the
    // shared-hosting CPU free for HTTP in between.
    await new Promise((r) => setTimeout(r, 40));
  }
  return total;
}

const daysAgo = (d: number): Date => new Date(Date.now() - d * DAY);

/**
 * Delete dead catalogue rows. Returns the number of rows removed so the caller
 * can decide whether a compaction (OPTIMIZE) is worthwhile.
 */
export async function pruneCatalogue(): Promise<number> {
  const store = getStore();
  if (store.kind !== 'mysql') return 0; // dev file store is row-capped already

  let removed = 0;
  const steps: Array<[string, string, unknown[]]> = [
    ['offers', 'DELETE FROM offers WHERE fetched_at < ?', [daysAgo(RETENTION.offersDays)]],
    ['source_evidence', 'DELETE FROM source_evidence WHERE fetched_at < ?', [daysAgo(RETENTION.evidenceDays)]],
    ['price_history', 'DELETE FROM price_history WHERE created_at < ?', [daysAgo(RETENTION.priceHistoryDays)]],
    ['source_health', 'DELETE FROM source_health WHERE created_at < ?', [daysAgo(RETENTION.sourceHealthDays)]],
    ['searches', 'DELETE FROM searches WHERE created_at < ?', [daysAgo(RETENTION.searchesDays)]],
    [
      'canonical_entities',
      `DELETE ce FROM canonical_entities ce
        LEFT JOIN offers o ON o.canonical_entity_id = ce.id
        LEFT JOIN offers ov ON ov.canonical_variant_id = ce.id
        WHERE o.id IS NULL AND ov.id IS NULL AND ce.created_at < ?`,
      [daysAgo(RETENTION.orphanEntityDays)],
    ],
  ];

  for (const [name, sql, params] of steps) {
    try {
      const n = await batchedDelete(sql, params);
      removed += n;
      if (n > 0) log.info('Prune', `Deleted ${n} stale rows from ${name}`);
    } catch (e: any) {
      // A missing table or a privilege quirk must never break the workers.
      log.warn('Prune', `${name} prune skipped`, { error: String(e?.message || e).slice(0, 140) });
    }
  }
  if (removed > 0) log.info('Prune', `Catalogue pruned: ${removed} dead rows removed`);
  return removed;
}

/**
 * Reclaim disk space for the pruned tables. DELETE marks rows free inside the
 * InnoDB files; only a rebuild returns the bytes to the host's quota — which is
 * what the "database size limit reached" banner measures. Run once at boot,
 * after pruning, and only when a real amount of data was removed.
 */
export async function compactCatalogue(): Promise<void> {
  const store = getStore();
  if (store.kind !== 'mysql') return;
  for (const table of ['offers', 'source_evidence', 'price_history', 'source_health']) {
    try {
      await store.query(`OPTIMIZE TABLE ${table}`);
      log.info('Prune', `Compacted ${table}`);
    } catch (e: any) {
      log.warn('Prune', `${table} compaction skipped`, { error: String(e?.message || e).slice(0, 140) });
    }
  }
}

/** Boot entry: prune immediately (the DB may already be at the cap), compact, then repeat hourly. */
export async function startCatalogueRetention(): Promise<void> {
  const runOnce = async (compact: boolean) => {
    const removed = await pruneCatalogue();
    if (compact && removed >= 5000) await compactCatalogue();
  };
  await runOnce(true).catch((e: any) => log.warn('Prune', 'Initial prune failed', { error: String(e?.message || e).slice(0, 140) }));
  const timer = setInterval(() => {
    void runOnce(false).catch(() => undefined);
  }, 60 * 60_000);
  if (timer.unref) timer.unref();
  log.info('Prune', 'Catalogue retention armed (hourly, compacted at boot)');
}
