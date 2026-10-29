import { runSearch } from '../server/search/searchOrchestrator';
(async () => {
  const res: any = await runSearch({ query: 'iphone 16', vertical: 'ecommerce', city: 'Indore', pincode: '452001', coldDeadlineMs: 20000 } as any);
  console.log('state', JSON.stringify(res.state));
  console.log('rows', res.results?.length);
  const bySeller: Record<string, number> = {};
  for (const r of res.results || []) bySeller[r.seller] = (bySeller[r.seller] || 0) + 1;
  console.log('sellers', bySeller);
  for (const r of (res.results || []).slice(0, 25)) console.log('-', r.provenance?.sourceId, '|', r.seller, '|', String(r.title).slice(0, 60), '|', r.prices?.effectivePrice);
})();
