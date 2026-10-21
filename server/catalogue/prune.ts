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

const daysAgo = (d: number, scale = 1): Date => new Date(Date.now() - d * DAY * Math.max(scale, 0.25));

/**
 * Delete dead rows across every high-churn table. Returns the number of rows
 * removed so the caller can decide whether a compaction (OPTIMIZE) is due.
 */
/**
 * @param scale retention multiplier — 1 = normal windows; <1 = EMERGENCY (e.g. 0.5
 * halves every TTL). Called with 0.5 by the size watchdog when the on-disk size is
 * dangerously close to the host cap, so the DB shrinks hard BEFORE the banner can re-arm.
 */
export async function pruneCatalogue(scale = 1): Promise<number> {
  const store = getStore();
  if (store.kind !== 'mysql') return 0; // dev file store is row-capped already

  let removed = 0;
  const steps: Array<[string, string, unknown[]]> = [
    ['offers', 'DELETE FROM offers WHERE fetched_at < ?', [daysAgo(RETENTION.offersDays, scale)]],
    ['source_evidence', 'DELETE FROM source_evidence WHERE fetched_at < ?', [daysAgo(RETENTION.evidenceDays, scale)]],
    ['price_history', 'DELETE FROM price_history WHERE created_at < ?', [daysAgo(RETENTION.priceHistoryDays, scale)]],
    ['source_health', 'DELETE FROM source_health WHERE created_at < ?', [daysAgo(RETENTION.sourceHealthDays, scale)]],
    ['searches', 'DELETE FROM searches WHERE created_at < ?', [daysAgo(RETENTION.searchesDays, scale)]],
    ['affiliate_offers', 'DELETE FROM affiliate_offers WHERE last_seen_at < ?', [daysAgo(RETENTION.affiliateSeenDays, scale)]],
    ['deals (auto)', 'DELETE FROM deals WHERE source = ? AND last_seen_at < ?', ['auto', daysAgo(RETENTION.autoDealsSeenDays, scale)]],
    ['source_acceptance_tests', 'DELETE FROM source_acceptance_tests WHERE tested_at < ?', [daysAgo(RETENTION.acceptanceDays, scale)]],
    ['ai_outputs', 'DELETE FROM ai_outputs WHERE created_at < ?', [daysAgo(RETENTION.aiOutputsDays, scale)]],
    ['audit_logs', 'DELETE FROM audit_logs WHERE created_at < ?', [daysAgo(RETENTION.auditDays, scale)]],
    ['sessions', 'DELETE FROM sessions WHERE expires_at < ?', [new Date()]],
    ['otp_codes', 'DELETE FROM otp_codes WHERE expires_at < ?', [new Date()]],
    [
      'canonical_entities',
      `DELETE ce FROM canonical_entities ce
        LEFT JOIN offers o ON o.canonical_entity_id = ce.id
        WHERE o.id IS NULL AND ce.created_at < ?`,
      [daysAgo(RETENTION.orphanEntityDays, scale)],
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
 * SIZE-AWARE SELF-HEALING (owner 21 Oct: "alerts baar baar kyun aa raha hai").
 *
 * The old compaction was gated on ROWS DELETED (>=1000), never on the actual
 * on-disk size — so after one big clean-up the InnoDB files stayed bloated and
 * the Hostinger "database size limit reached" banner re-armed forever. DELETE
 * alone never shrinks the files; only a rebuild does.
 *
 * New loop, armed every hour:
 *  1. Measure the REAL size (information_schema data_length + index_length).
 *  2. size > SOFT cap  -> compact exactly ONE table per hour (the biggest),
 *     so OPTIMIZE never spikes shared-hosting CPU across six tables at once.
 *  3. size > HARD cap   -> also prune with halved retention (emergency shrink).
 *  4. size <= SOFT cap  -> prune only; the DB is healthy, nothing expensive runs.
 * This makes the banner structurally impossible: the DB is shrunk BEFORE it can
 * approach the host cap again, automatically, with no owner intervention.
 */
const SOFT_CAP_MB = 2300; // start compacting (Hostinger cap: 3072 MB)
const HARD_CAP_MB = 2850; // emergency: halve retention too
const COMPACTABLE = ['offers', 'source_evidence', 'price_history', 'source_health', 'affiliate_offers', 'deals'];

/** Actual on-disk size of the app schema in MB (what the host quota measures). */
export async function databaseSizeMb(): Promise<number> {
  const store = getStore();
  if (store.kind !== 'mysql') return 0;
  try {
    const rows: any[] = await store.query(
      `SELECT COALESCE(SUM(data_length + index_length) / 1048576, 0) AS mb
         FROM information_schema.tables WHERE table_schema = DATABASE()` as any
    );
    const first = Array.isArray(rows) ? rows[0] : (rows as any)?.[0];
    return Number(first?.mb ?? 0);
  } catch {
    return 0; // never let a metrics query break retention
  }
}

/** OPTIMIZE the single largest compactable table (cheapest CPU shape on shared hosting). */
async function compactLargestTable(): Promise<string | null> {
  const store = getStore();
  if (store.kind !== 'mysql') return null;
  try {
    const rows: any[] = await store.query(
      `SELECT table_name AS tbl, (data_length + index_length) / 1048576 AS mb
         FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name IN (${COMPACTABLE.map(() => '?').join(',')})
        ORDER BY (data_length + index_length) DESC
        LIMIT 1` as any,
      COMPACTABLE
    );
    const first = Array.isArray(rows) ? rows[0] : (rows as any)?.[0];
    if (!first?.tbl) return null;
    await store.query(`OPTIMIZE TABLE \`${first.tbl}\``);
    log.info('Prune', `Compacted ${first.tbl} (${Number(first.mb ?? 0).toFixed(0)} MB)`);
    return String(first.tbl);
  } catch (e: any) {
    log.warn('Prune', 'size-gated compaction skipped', { error: String(e?.message || e).slice(0, 140) });
    return null;
  }
}

/** Boot entry: the hourly size-aware retention loop (see watchdog block above). */
export async function startCatalogueRetention(): Promise<void> {
  const runOnce = async () => {
    const sizeMb = await databaseSizeMb();
    const emergency = sizeMb > HARD_CAP_MB;
    const removed = await pruneCatalogue(emergency ? 0.5 : 1);
    if (sizeMb > SOFT_CAP_MB || removed >= 100_000) {
      // Over (or near) the cap: rebuild the biggest table this hour. Hourly cadence
      // walks every bloated table within a few hours without a CPU spike.
      const done = await compactLargestTable();
      if (done && sizeMb > HARD_CAP_MB) {
        // Still critical after the emergency prune: compact a second table now —
        // reclaiming overage is worth a brief extra CPU on shared hosting.
        await compactLargestTable();
      }
    }
    if (sizeMb > 0) log.info('Prune', `Retention pass done (DB ${sizeMb.toFixed(0)} MB${emergency ? ' EMERGENCY' : ''}, ${removed} rows removed)`);
  };
  await runOnce().catch((e: any) => log.warn('Prune', 'Initial retention pass failed', { error: String(e?.message || e).slice(0, 140) }));
  const timer = setInterval(() => { void runOnce().catch(() => undefined); }, 60 * 60_000);
  if (timer.unref) timer.unref();
  log.info('Prune', `Size-aware retention armed (SOFT ${SOFT_CAP_MB} MB / HARD ${HARD_CAP_MB} MB, hourly passes, one-table compaction)`);
}
