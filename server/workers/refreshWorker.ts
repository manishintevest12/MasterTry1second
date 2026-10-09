/**
 * Background workers (Sections 7.2, 14, 21): incremental refresh + retry queue + health sweep.
 * Single-process interval workers — sized for KVM4 (bounded batches, never a refresh storm).
 */
import type { NormalizedOffer, ParsedQuery } from '../types';
import { settings } from '../common/settings';
import { log } from '../common/logger';
import { withLock } from '../common/cache';
import { getStore } from '../common/db';
import { refreshCandidates, updateVolatileFields, recordPriceSnapshot } from '../catalogue/catalogueService';
import { getSources, getSources as srcs } from '../sources/registry';
import { acquireParallel } from '../sources/orchestrator';
import { understandQuery } from '../query/queryUnderstanding';
import { dedupeOffers, normalizeOffer } from '../pipeline/normalization';
import { validateOffer } from '../pipeline/validation';
import { computeEffectivePrice } from '../pipeline/pricing';
import { computeFreshness, isServable } from '../pipeline/freshness';

let timers: NodeJS.Timeout[] = [];
let running = false;

export function startWorkers() {
  if (running) return;
  running = true;

  // Incremental refresh worker (demand-independent, popularity via ORDER BY fetched_at)
  const refreshTimer = setInterval(async () => {
    // Distributed lock prevents duplicate refresh when multiple processes run (KVM4)
    await withLock('refresh-worker', async () => {
      try {
        const candidates = await refreshCandidates({ limit: settings.worker.maxRefreshBatch, minAgeSec: 1800 });
        if (candidates.length === 0) return;
        log.info('Worker', `Refreshing ${candidates.length} catalogue offers (volatile fields only)`);

        // Group by vertical and refresh the most-stale slice through the real pipeline
        const byVertical = new Map<string, typeof candidates>();
        for (const c of candidates) {
          if (!byVertical.has(c.vertical)) byVertical.set(c.vertical, []);
          byVertical.get(c.vertical)!.push(c);
        }
        for (const [vertical, rows] of byVertical) {
          const example = rows[0];
          const parsed: ParsedQuery = understandQuery(example.title, {});
          parsed.vertical = vertical as any;
          const sources = getSources().filter((s) => s.enabled && (s.verticals.length === 0 || s.verticals.includes(vertical as any)));
          if (sources.length === 0) continue;
          const outcome = await acquireParallel(parsed, { maxSources: 3 });
          for (const result of outcome.results) {
            const source = srcs().find((s) => s.id === result.sourceId);
            if (!source) continue;
            const offers = dedupeOffers(result.rawItems.map((raw) => normalizeOffer(raw, source, vertical as any)));
            for (const offer of offers) {
              // Validate + compute prices exactly like the live pipeline (Section 24 rules)
              const breakdown = computeEffectivePrice(offer.prices.fees, offer.prices.currency, {});
              offer.prices.mandatoryTotal = breakdown.mandatoryTotal;
              offer.prices.effectivePrice = breakdown.effectivePrice;
              const validation = validateOffer(offer, parsed);
              offer.validationStatus = validation.status;
              offer.confidence = validation.confidence;
              if (validation.status === 'INVALID') continue;
              offer.freshnessStatus = computeFreshness(offer, { fetchedAt: offer.provenance.fetchedAt }, source.freshnessPolicy, true, validation.status === 'VALID');
              if (!isServable(offer.freshnessStatus)) continue;

              // Refresh rewrites ONLY volatile fields of the matching stored row (Section 7.1)
              const stored = rows.find((r) => r.title && offer.title && r.title.toLowerCase().includes(offer.title.toLowerCase().slice(0, 30)));
              if (stored) {
                await updateVolatileFields(stored.id, {
                  mandatoryTotal: offer.prices.mandatoryTotal,
                  effectivePrice: offer.prices.effectivePrice,
                  availability: offer.availability,
                  freshnessStatus: offer.freshnessStatus,
                  validatedAt: new Date().toISOString(),
                });
                await recordPriceSnapshot(offer as NormalizedOffer, stored.id);
              }
            }
          }
        }
      } catch (e: any) {
        log.error('Worker', 'Refresh cycle failed (old data preserved, not relabeled)', { error: String(e).slice(0, 150) });
      }
    });
  }, settings.worker.refreshIntervalSec * 1000);

  // Dead-letter / retry queue drainer
  const retryTimer = setInterval(async () => {
    try {
      const store = getStore();
      const dead = await store.query<any>(
        `SELECT id FROM source_jobs WHERE status = 'failed' AND attempts < 3 ORDER BY created_at ASC LIMIT 10`,
      );
      for (const job of dead) {
        await store.execute('UPDATE source_jobs SET status = ? WHERE id = ?', ['queued', job.id]);
      }
      if (dead.length > 0) log.info('Worker', `Requeued ${dead.length} recoverable source jobs`);
    } catch { /* best-effort */ }
  }, 60_000);

  refreshTimer.unref?.();
  retryTimer.unref?.();
  timers = [refreshTimer, retryTimer];
  log.info('Worker', `Background workers started (refresh every ${settings.worker.refreshIntervalSec}s)`);
}

export function stopWorkers() {
  timers.forEach((t) => clearInterval(t));
  timers = [];
  running = false;
}
