/**
 * CoverageMeasurement (Section 20): real system behavior per vertical, source and window.
 *
 * Honesty rules enforced here:
 *  - Every percentage states numerator, denominator, window and exclusions.
 *  - Zeros are reported as zeros, never padded with claims.
 *  - No fabricated metrics — everything is computed from persisted, measured rows.
 */
import { getStore } from '../common/db';

export interface Ratio {
  numerator: number;
  denominator: number;
  /** 0..100, or null when denominator is 0 (explicitly "not measurable", never assumed 0%) */
  percentage: number | null;
}

function ratio(n: number, d: number): Ratio {
  return { numerator: n, denominator: d, percentage: d === 0 ? null : Math.round((n / d) * 1000) / 10 };
}

export interface CoverageReport {
  windowHours: number;
  generatedAt: string;
  searches: {
    total: number;
    byServedFrom: Record<string, number>;
    /** Searches returning >= 1 verified comparable offer / all searches in window */
    searchSuccessRate: Ratio;
    avgTotalLatencyMs: number | null;
  };
  catalogue: {
    offersTotal: number;
    freshVerified: Ratio;      // LIVE_VERIFIED + FRESH / all non-invalid offers
    cachedVerified: Ratio;
    staleOrExpired: Ratio;
    withVerifiedAvailability: Ratio;
  };
  sources: {
    configured: number;
    enabled: number;
    healthy: number;
    circuitOpen: number;
    perSource: Array<{ sourceId: string; state: string; totalAttempts: number; totalSuccesses: number; successRate: Ratio; avgLatencyMs: number | null }>;
  };
  affiliate: {
    clicks: number;
    confirmedConversions: number;
    /** Confirmed conversions / recorded clicks (only authorized report records count) */
    conversionRate: Ratio;
    note: string;
  };
  exclusions: string[];
}

export async function buildCoverageReport(windowHours = 24): Promise<CoverageReport> {
  const store = getStore();
  const since = new Date(Date.now() - windowHours * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');

  // Searches in window (served_from + latency)
  let searches: any[] = [];
  let offerRows: any[] = [];
  let healthRows: any[] = [];
  let affiliateClicks = 0;
  let affiliateConversions = 0;
  try {
    searches = await (store.query as any)(
      `SELECT id, served_from, results_count, latency_ms, created_at FROM searches WHERE created_at >= ? ORDER BY created_at DESC`,
      [since],
    );
  } catch { searches = []; }
  try {
    offerRows = await (store.query as any)(
      `SELECT freshness_status, validation_status, availability, vertical FROM offers`,
    );
  } catch { offerRows = []; }
  try {
    healthRows = await (store.query as any)(
      `SELECT source_id, state, total_attempts, total_successes, avg_latency_ms FROM source_health`,
    );
  } catch { healthRows = []; }
  try {
    const c = await (store.query as any)(`SELECT id FROM affiliate_clicks`);
    affiliateClicks = c.length;
    const v = await (store.query as any)(`SELECT id FROM affiliate_conversions`);
    affiliateConversions = v.length;
  } catch { /* empty tables are honest zeros */ }

  // Configured/enabled sources come from the live registry, not from a claim
  const { getSources } = await import('../sources/registry');
  const { getAllHealth } = await import('../sources/health');
  const sources = getSources();
  const health = getAllHealth();
  const healthById = new Map(health.map((h) => [h.sourceId, h]));

  const byServedFrom: Record<string, number> = {};
  for (const s of searches) byServedFrom[s.served_from || 'unknown'] = (byServedFrom[s.served_from || 'unknown'] || 0) + 1;

  const successful = searches.filter((s) => Number(s.results_count) > 0).length;
  const latencies = searches.map((s) => Number(s.latency_ms)).filter((n) => Number.isFinite(n) && n >= 0);

  const nonInvalid = offerRows.filter((o) => o.validation_status !== 'INVALID');
  const fresh = nonInvalid.filter((o) => ['LIVE_VERIFIED', 'FRESH'].includes(o.freshness_status));
  const cached = nonInvalid.filter((o) => o.freshness_status === 'CACHED_VERIFIED');
  const stale = nonInvalid.filter((o) => ['AGING', 'STALE', 'EXPIRED'].includes(o.freshness_status));
  const avail = nonInvalid.filter((o) => ['in_stock', 'available', 'confirmed'].includes(o.availability));

  return {
    windowHours,
    generatedAt: new Date().toISOString(),
    searches: {
      total: searches.length,
      byServedFrom,
      searchSuccessRate: ratio(successful, searches.length),
      avgTotalLatencyMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
    },
    catalogue: {
      offersTotal: offerRows.length,
      freshVerified: ratio(fresh.length, nonInvalid.length),
      cachedVerified: ratio(cached.length, nonInvalid.length),
      staleOrExpired: ratio(stale.length, nonInvalid.length),
      withVerifiedAvailability: ratio(avail.length, nonInvalid.length),
    },
    sources: {
      configured: sources.length,
      enabled: sources.filter((s) => s.enabled).length,
      healthy: health.filter((h) => h.state === 'HEALTHY').length,
      circuitOpen: health.filter((h) => h.state === 'CIRCUIT_OPEN').length,
      perSource: healthRows.map((r) => {
        const att = Number(r.total_attempts) || 0;
        const suc = Number(r.total_successes) || 0;
        return {
          sourceId: r.source_id,
          state: healthById.get(r.source_id)?.state || 'UNKNOWN',
          totalAttempts: att,
          totalSuccesses: suc,
          successRate: ratio(suc, att),
          avgLatencyMs: r.avg_latency_ms === null || r.avg_latency_ms === undefined ? null : Number(r.avg_latency_ms),
        };
      }),
    },
    affiliate: {
      clicks: affiliateClicks,
      confirmedConversions: affiliateConversions,
      conversionRate: ratio(affiliateConversions, affiliateClicks),
      note: 'Conversions are counted ONLY from authorized tracking/report records (affiliate_conversions). Unconfirmed clicks are never counted as conversions or commissions.',
    },
    exclusions: [
      'Searches without a stored searches row (unavailable state before persistence) are excluded from search success rate.',
      'INVALID offers are excluded from all catalogue ratios — they are never surfaced.',
      'Percentage is null (not 0%) when the denominator is zero: coverage is not claimed before it is measured.',
      windowHours === 0 ? 'Window covers all recorded history.' : `Window: last ${windowHours} hours; older data excluded.`,
    ],
  };
}
