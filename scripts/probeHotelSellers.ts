#!/usr/bin/env tsx
/**
 * Worker-level probe for the hotels vertical: run every w_hotels_* task for one city and one date pair and print
 * rows / priced rows / failure class per seller. Production /api/scrape/live hides which seller failed because the
 * sweep caps itself, so this is the only honest way to see the seller gap the owner keeps reporting
 * ("hotels vertical mai goibibo, makemytrip, airbnb ye sb tha abhi kuch websites hi dikh raha hai").
 *
 *   npx tsx scripts/probeHotelSellers.ts "Indore" 2026-11-21 2026-11-22
 */
process.env.T1S_STORE ||= 'file';

async function main() {
  await import('../server/workers/verticals/hotels');
  const { workerTaskIndex } = await import('../server/workers/verticalWorker');
  const { understandQuery } = await import('../server/query/queryUnderstanding');
  const { httpAcquire } = await import('../server/common/httpClient');

  const city = String(process.argv[2] || 'Indore');
  const depart = String(process.argv[3] || '2026-11-21');
  const ret = String(process.argv[4] || '2026-11-22');
  const budget = Number(process.env.PROBE_BUDGET_MS || 45000);

  const idx = workerTaskIndex() as Map<string, any>;
  const targets = [...idx.keys()].filter((k) => k.startsWith('w_hotels_'));
  console.log(`probing ${targets.length} hotel tasks for ${city} ${depart} -> ${ret}\n`);

  const parsed: any = understandQuery(`hotels in ${city}`, {});
  parsed.vertical = 'hotels';
  parsed.travelDates = { depart, return: ret };
  parsed.entityName = city;
  parsed.city = city;

  for (const id of targets) {
    const entry: any = idx.get(id);
    const task = entry?.task ?? entry;
    const source = {
      id: task.sourceId, name: task.sourceId, method: 'direct_http', verticals: ['hotels'], enabled: true,
      priority: 10, config: {}, rateLimit: { maxRequestsPerMinute: 60, maxConcurrency: 5 },
      freshnessPolicy: { liveVerifiedTtlSec: 300, freshTtlSec: 900, maxStaleSec: 2700 },
      adapterVersion: '1', parserVersion: '1', requiresAuthorization: false, permittedForRetention: true,
    };
    const ctx = {
      query: parsed, source,
      fetch: async (url: string, opts: any = {}) => httpAcquire(url, { ...opts, source } as any),
    } as any;
    const t0 = Date.now();
    try {
      const items: any[] = await Promise.race([
        task.run(ctx),
        new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error(`TIMEOUT ${budget}ms`), { code: 'TIMEOUT' })), budget)),
      ]);
      const priced = items.filter((r) => Number(r?.price) > 0).length;
      const dated = items.filter((r) => String(r?.travel?.date || '').slice(0, 10) === depart).length;
      console.log(`${id.padEnd(28)} rows=${String(items.length).padStart(3)} priced=${String(priced).padStart(3)} onDate=${String(dated).padStart(3)} ${Date.now() - t0}ms`);
    } catch (e: any) {
      console.log(`${id.padEnd(28)} FAIL ${String(e?.code || e?.failureClass || e?.name || '')} ${String(e?.message || e).slice(0, 120)} ${Date.now() - t0}ms`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
