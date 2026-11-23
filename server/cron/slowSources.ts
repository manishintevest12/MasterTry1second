/**
 * SLOW-SOURCE CACHE WARMER (owner 23 Nov: "jo time le rahe hai unko cache mai rakho hr 15min mai refresh krte rhna").
 *
 * Goibibo and Booking.com cannot be fetched inside a user's search: their edges only answer a real browser session, so
 * the fetch takes 10-30 s. Measured on production, attempting them inline produced a TIMEOUT on every hotels search and
 * the user saw neither partner. Their rows are therefore taken OFF the search's critical path entirely:
 *
 *   - the search pipeline no longer attempts a slow source (see SLOW_SOURCE_IDS in sources/registry.ts);
 *   - this warmer fetches them in the background on a 15-minute clock, with generous timeouts, and writes what it gets
 *     into the CATALOGUE with its own fetched_at, so the next search serves those rows instantly from the catalogue
 *     floor and they age out honestly if the refresh stops.
 *
 * Nothing is invented: a row exists only if the partner's own page was parsed in this cycle, and each cycle keeps the
 * per-source failure class so /api/admin/live-health still tells the truth about a blocked partner.
 */
import { log } from '../common/logger';
import { getStore } from '../common/db';
import { getVerticalWorker } from '../workers/verticalWorker';
import { runTask } from '../workers/verticalWorker';
import { getSource } from '../sources/registry';
import { understandQuery } from '../query/queryUnderstanding';
import { normalizeOffer } from '../pipeline/normalization';
import { validateOffer } from '../pipeline/validation';
import { computeEffectivePrice } from '../pipeline/pricing';
import { computeFreshness, isServable } from '../pipeline/freshness';
import { resolveCanonicalEntity } from '../pipeline/entityMatching';
import { persistOffer, recordPriceSnapshot } from '../catalogue/catalogueService';
import { recordSuccess, recordFailure } from '../sources/health';
import type { VerticalId } from '../types';

/** Slow sources: never attempted inline, always warmed here. */
export const SLOW_SOURCE_IDS = new Set(['w_hotels_goibibo', 'w_hotels_booking', 'w_flights_goibibo']);

/** Cities warmed per cycle per vertical. Kept small so a cycle finishes well inside the 15-minute clock. */
const CITIES_PER_CYCLE = Math.max(1, Number(process.env.T1S_SLOW_WARM_CITIES || 4));

/** The cities worth warming: the ones real users actually searched, then the seed defaults. */
async function citiesFor(vertical: string): Promise<string[]> {
  const out: string[] = [];
  try {
    const rows = await getStore().query<any>(
      `SELECT city, COUNT(*) AS n FROM funnel_events
       WHERE vertical = ? AND city IS NOT NULL AND city <> '' AND created_at >= ?
       GROUP BY city ORDER BY n DESC LIMIT ?`,
      [vertical, new Date(Date.now() - 14 * 24 * 3600_000), CITIES_PER_CYCLE],
    );
    for (const r of rows) if (r.city) out.push(String(r.city));
  } catch { /* no funnel table yet: seeds below */ }
  const seeds = vertical === 'hotels' ? ['Goa', 'Indore', 'Delhi', 'Mumbai'] : ['Indore', 'Delhi', 'Mumbai', 'Pune'];
  for (const s of seeds) if (!out.includes(s)) out.push(s);
  return out.slice(0, CITIES_PER_CYCLE);
}

function queryFor(vertical: string, city: string): string {
  if (vertical === 'hotels') return `hotels in ${city}`;
  if (vertical === 'flights') return `${city} to New Delhi`;
  return city;
}

/**
 * One warming pass. Runs the slow tasks for a few (vertical, city) pairs and persists what parses.
 * Every failure is recorded on the source's health so the breaker and live-health stay honest.
 */
export async function refreshSlowSourcesOnce(): Promise<{ sources: number; rows: number; failed: string[] }> {
  const failed: string[] = [];
  let rowsWritten = 0;
  let sourcesRun = 0;

  for (const vertical of ['hotels', 'flights'] as VerticalId[]) {
    const worker = getVerticalWorker(vertical);
    if (!worker) continue;
    const tasks = worker.tasks.filter((t) => SLOW_SOURCE_IDS.has(t.sourceId));
    if (!tasks.length) continue;
    const cities = await citiesFor(vertical);
    for (const city of cities) {
      const parsed = understandQuery(queryFor(vertical, city), { city });
      for (const task of tasks) {
        const source = getSource(task.sourceId);
        if (!source || !source.enabled) continue;
        sourcesRun += 1;
        const started = Date.now();
        try {
          // Generous budget: this is background work, the user is not waiting on it.
          const result = await runTask(worker, { ...task, timeoutMs: Number(process.env.T1S_SLOW_TASK_MS || 75_000) }, source, parsed);
          if (!result.success || !result.rawItems?.length) {
            failed.push(`${task.sourceId}:${result.failureClass || 'EMPTY_RESPONSE'}`);
            recordFailure(task.sourceId, result.failureClass || 'EMPTY_RESPONSE', result.error || 'no rows');
            continue;
          }
          let kept = 0;
          for (const raw of result.rawItems) {
            try {
              const offer = normalizeOffer(raw, source, (parsed.vertical || 'hotels') as any);
              const parsedLoc = Object.fromEntries(
                Object.entries(parsed.location || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''),
              );
              offer.location = { ...offer.location, ...parsedLoc };
              const breakdown = computeEffectivePrice(offer.prices.fees, offer.prices.currency, { coupon: false, bank: false, cashback: false, giftCard: false });
              offer.prices.mandatoryTotal = breakdown.mandatoryTotal;
              offer.prices.effectivePrice = breakdown.effectivePrice;
              offer.prices.finalPayablePrice = breakdown.finalPayablePrice;
              offer.prices.listPrice = breakdown.listPrice;
              offer.prices.verifiedSavings = breakdown.verifiedSavings;
              const validation = validateOffer(offer, parsed);
              offer.validationStatus = validation.status;
              offer.confidence = validation.confidence;
              if (validation.status === 'INVALID') continue;
              const match = await resolveCanonicalEntity(offer);
              offer.canonicalEntityId = match.canonicalEntityId;
              offer.canonicalVariantId = match.canonicalVariantId;
              offer.matchState = match.matchState;
              offer.matchEvidence = match.matchEvidence;
              offer.freshnessStatus = computeFreshness(offer, { fetchedAt: raw.fetchedAt }, source.freshnessPolicy, true, true);
              if (!isServable(offer.freshnessStatus)) continue;
              if (!source.permittedForRetention) continue;
              const rowId = await persistOffer(offer, raw, source);
              await recordPriceSnapshot(offer, rowId);
              kept += 1;
            } catch { /* one bad row never fails the pass */ }
          }
          rowsWritten += kept;
          recordSuccess(task.sourceId, Date.now() - started);
          log.info('SlowWarm', `${task.sourceId} ${vertical}/${city}`, { rows: kept, ms: Date.now() - started });
        } catch (e: any) {
          failed.push(`${task.sourceId}:${String(e?.message || e).slice(0, 60)}`);
          recordFailure(task.sourceId, 'SERVER_ERROR', String(e?.message || e).slice(0, 160));
        }
      }
    }
  }
  return { sources: sourcesRun, rows: rowsWritten, failed };
}
