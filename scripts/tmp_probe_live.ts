import { acquireParallel } from '../server/sources/orchestrator';
import { understandQuery } from '../server/query/queryUnderstanding';
(async () => {
  const parsed: any = understandQuery('iphone 16');
  (parsed as any).vertical = 'ecommerce';
  const out: any = await acquireParallel(parsed, { deadlineAt: Date.now() + 25000 });
  console.log('attempted', out.attempted?.length, 'succeeded', out.succeeded?.length, 'failed', out.failed?.length);
  console.log('succeeded', JSON.stringify(out.succeeded));
  console.log('failed', JSON.stringify(out.failed)?.slice(0, 2000));
  const rows = out.results || [];

  for (const env of rows) {
    const items = env.rawItems || [];
    console.log('==', env.sourceId, 'items', items.length);
    for (const it of items.slice(0, 8)) console.log('   *', String(it.title).slice(0, 80), '|', it.price);
  }
  console.log('rows', rows.length);
  const by: Record<string, number> = {};
  for (const r of rows) by[r.seller] = (by[r.seller] || 0) + 1;
  console.log(by);
  for (const r of rows.slice(0, 20)) console.log('-', JSON.stringify({src:r.provenance?.sourceId||r.sourceId, seller:r.seller||r.vendor, title:(r.title||r.name||'').slice(0,70), price:r.prices?.effectivePrice||r.price}));
})();
