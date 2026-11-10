import { buildIntentHubs, attachIntentHubs } from '../server/search/deepLinkHub';
for (const [v, q, city] of [['hotels', 'hotels in Indore', 'Indore'], ['flights', 'Indore to Delhi', '']] as const) {
  const hubs = buildIntentHubs({ vertical: v, title: q, rows: [], city, travel: { depart: '2026-11-20', return: '2026-11-22' } });
  console.log(`${v}: ${hubs.length} hubs`);
  for (const h of hubs) console.log('  -', h.seller, '->', h.url.slice(0, 96));
}
const out = await attachIntentHubs({ results: [], resultsCount: 0, state: { servedFrom: 'unavailable' } }, { vertical: 'hotels', query: 'hotels in Indore', city: 'Indore', depart: '2026-11-20', returnDate: '2026-11-22' });
console.log('attach: hubs', out.intentHubs.length, 'rows', out.results.length, 'count', out.resultsCount);
