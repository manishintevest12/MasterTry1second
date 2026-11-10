process.env.T1S_STORE ||= 'file';
(async () => {
  await import('../server/workers/verticals/hotels');
  const { workerTaskIndex } = await import('../server/workers/verticalWorker');
  const { understandQuery } = await import('../server/query/queryUnderstanding');
  const { httpAcquire } = await import('../server/common/httpClient');
  const idx: any = workerTaskIndex();
  const t = (idx.get('w_hotels_mmt')?.task ?? idx.get('w_hotels_mmt')) as any;
  const source: any = { id: 'w_hotels_mmt', name: 'mmt', method: 'direct_http', verticals: ['hotels'], enabled: true, priority: 15, config: {}, rateLimit: { maxRequestsPerMinute: 4, maxConcurrency: 1 }, freshnessPolicy: {}, adapterVersion: '1', parserVersion: '1', requiresAuthorization: false, permittedForRetention: true };
  const parsed: any = understandQuery('hotels in Indore', {});
  parsed.vertical = 'hotels'; parsed.travelDates = { depart: '2026-11-21', return: '2026-11-22' }; parsed.entityName = 'Indore'; parsed.city = 'Indore';
  const t0 = Date.now();
  try {
    const items: any[] = await t.run({ query: parsed, source, fetch: (u: string, o: any = {}) => httpAcquire(u, { ...o, source }) });
    console.log(`ROWS ${items.length} dated ${items.filter((i) => String(i.travel?.date || '').startsWith('2026-11-21')).length} ${Date.now() - t0}ms`);
    for (const i of items) console.log('  ', i.title.slice(0, 44).padEnd(46), i.price, '|', i.attributes?.price_basis);
  } catch (e: any) {
    console.log(`FAIL ${e?.code} ${String(e?.message).slice(0, 150)} ${Date.now() - t0}ms`);
  }
})();
