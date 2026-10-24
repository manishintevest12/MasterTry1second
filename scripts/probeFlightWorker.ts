/** Standalone worker-level probe: IndiGo / Akasa / Expedia flight tasks with generous budgets. */
import { readFileSync } from 'node:fs';

process.env.T1S_STORE ||= 'file';

async function main() {
  await import('../server/workers/verticals/flights'); // registers tasks
  const { workerTaskIndex } = await import('../server/workers/verticalWorker');
  const { understandQuery } = await import('../server/query/queryUnderstanding');
  const { httpAcquire } = await import('../server/common/httpClient');
  const idx = workerTaskIndex() as Map<string, any>;

  const target = String(process.argv[2] || 'w_flights_indigo');
  const route = String(process.argv[3] || 'indore to delhi');
  const dateIso = String(process.argv[4] || '2026-10-28');

  const entry: any = idx.get(target);
  const task: any = entry?.task ?? entry;
  if (!task?.run) {
    console.log('task not found; flight tasks:', [...idx.keys()].filter((k) => k.includes('flight') || ['w_flights_indigo','w_flights_akasa','w_flights_expedia'].some(x=>k.startsWith(x))).slice(0, 40));
    return;
  }
  const source = { id: task.sourceId, name: task.sourceId, method: 'direct_http', verticals: ['flights'], enabled: true, priority: 10, config: {}, rateLimit: { maxRequestsPerMinute: 60, maxConcurrency: 5 }, freshnessPolicy: { liveVerifiedTtlSec: 300, freshTtlSec: 900, maxStaleSec: 2700 }, adapterVersion: '1', parserVersion: '1', requiresAuthorization: false, permittedForRetention: true };
  const parsed: any = understandQuery(`${route} ${dateIso}`, {});
  parsed.vertical = 'flights';
  parsed.travelDates = { depart: dateIso };

  const t0 = Date.now();
  const ctx = {
    query: parsed,
    source,
    fetch: async (url: string, opts: any = {}) => {
      const r = await httpAcquire(url, { ...opts, source } as any);
      return r;
    },
  } as any;
  try {
    const items = await task.run(ctx);
    console.log(`\n=== ${target} (${route} ${dateIso}) — ${items.length} rows in ${Date.now() - t0}ms ===`);
    for (const it of items.slice(0, 8)) {
      const a = (it as any).attributes || {};
      console.log(JSON.stringify({
        title: (it as any).title,
        price: (it as any).price ?? (it as any).prices?.effectivePrice,
        currency: (it as any).currency,
        flight_number: a.flight_number ?? null,
        departure_time: a.departure_time ?? null,
        arrival_time: a.arrival_time ?? null,
        dateIso: a.dateIso ?? a.departure_date ?? null,
        url: String((it as any).url || '').slice(0, 70),
      }));
    }
    if (!items.length) console.log('(no rows)');
  } catch (e: any) {
    console.log(`\n=== ${target} FAILED in ${Date.now() - t0}ms: ${e?.failureClass || ''} ${String(e?.message || e).slice(0, 300)}`);
  }
  process.exit(0);
}
void main();
