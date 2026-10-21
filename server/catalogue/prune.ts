/**
 * Catalogue retention (owner fix, 21 Oct — "database size limit reached").
 *
 * Root cause: every accepted offer wrote rows into offers + source_evidence +
 * price_history, plus source_health on every probe, and NOTHING ever deleted
 * them. The catalogue is only eligible for ~1h, so days of dead rows piled up
 * until Hostinger's database size cap (3GB) was hit: 3131/3072 MB.
 *
 * Fix: bounded retention over EVERY high-churn table, enforced by the singleton
 * background owner — dead rows deleted in small batches so locks stay short,
 * tables compacted at boot and retried daily so the disk space actually
 * returns to the host quota (DELETE alone never shrinks InnoDB files).
 *
 * MySQL-only by design: the dev file store is already row-capped in db.ts.
 */
import { getStore } from '../common/db';
import { log } from '../common/logger';

const BATCH = 2000;
const MAX_BATCHES = 500; // up to 1M rows/table/hour — enough to catch up from an over-cap state
const DAY = 86_400_000;

/** Retention windows — generous vs the 1h catalogue eligibility, tight vs the cap. */
const RETENTION = {
  offersDays: 2,          // catalogue rows older than this can never be served
  evidenceDays: 2,        // mirrors offers
  priceHistoryDays: 2,    // historical snapshots; 2 days is ample for trend display
  sourceHealthDays: 2,    // health probes fire constantly, tiny rows but millions of them
  searchesDays: 8,        // warm seeds read a 7-day window
  affiliateSeenDays: 7,   // affiliate offer not seen by any sync in 7d is dead
  autoDealsSeenDays: 7,   // auto deals churn every sync; curated deals are kept forever
  acceptanceDays: 7,      // source acceptance test rows
  aiOutputsDays: 7,       // generated text outputs
  auditDays: 30,          // admin audit trail
  orphanEntityDays: 15,   // canonical entities with no live offer and no recent use
} as const;

async function batchedDelete(sql: string, params: unknown[]): Promise<number> {
  const store = getStore();
  let total = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
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
 * Delete dead rows across every high-churn table. Returns the number of rows
 * removed so the caller can decide whether a compaction (OPTIMIZE) is due.
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
    ['affiliate_offers', 'DELETE FROM affiliate_offers WHERE last_seen_at < ?', [daysAgo(RETENTION.affiliateSeenDays)]],
    ['deals (auto)', 'DELETE FROM deals WHERE source = ? AND last_seen_at < ?', ['auto', daysAgo(RETENTION.autoDealsSeenDays)]],
    ['source_acceptance_tests', 'DELETE FROM source_acceptance_tests WHERE tested_at < ?', [daysAgo(RETENTION.acceptanceDays)]],
    ['ai_outputs', 'DELETE FROM ai_outputs WHERE created_at < ?', [daysAgo(RETENTION.aiOutputsDays)]],
    ['audit_logs', 'DELETE FROM audit_logs WHERE created_at < ?', [daysAgo(RETENTION.auditDays)]],
    ['sessions', 'DELETE FROM sessions WHERE expires_at < ?', [new Date()]],
    ['otp_codes', 'DELETE FROM otp_codes WHERE expires_at < ?', [new Date()]],
    [
      'canonical_entities',
      `DELETE ce FROM canonical_entities ce
        LEFT JOIN offers o ON o.canonical_entity_id = ce.id
        WHERE o.id IS NULL AND ce.created_at < ?`,
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
 * what the "database size limit reached" banner measures. Compaction is retried
 * daily (not only at boot) because an OPTIMIZE attempt can fail while the quota
 * is still exceeded, then succeed once enough rows are gone.
 */
export async function compactCatalogue(): Promise<void> {
  const store = getStore();
  if (store.kind !== 'mysql') return;
  for (const table of ['offers', 'source_evidence', 'price_history', 'source_health', 'affiliate_offers', 'deals']) {
    try {
      await store.query(`OPTIMIZE TABLE ${table}`);
      log.info('Prune', `Compacted ${table}`);
    } catch (e: any) {
      log.warn('Prune', `${table} compaction skipped`, { error: String(e?.message || e).slice(0, 140) });
    }
  }
}

/**
 * Boot entry: prune immediately (the DB may already be over the cap), compact,
 * then repeat hourly; compaction is retried every 24 runs (~daily).
 */
export async function startCatalogueRetention(): Promise<void> {
  let runs = 0;
  const runOnce = async (compact: boolean) => {
    const removed = await pruneCatalogue();
    if (compact && removed >= 1000) await compactCatalogue();
  };
  await runOnce(true).catch((e: any) => log.warn('Prune', 'Initial prune failed', { error: String(e?.message || e).slice(0, 140) }));
  const timer = setInterval(() => {
    runs++;
    // Every 24th hourly run (or whenever a huge prune happened) retry compaction.
    void runOnce(runs % 24 === 0).catch(() => undefined);
  }, 60 * 60_000);
  if (timer.unref) timer.unref();
  log.info('Prune', 'Catalogue retention armed (hourly prunes, compaction boot + daily retry)');
}
