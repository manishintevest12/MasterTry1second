import { buildIntentHubs } from '../server/search/deepLinkHub';
for (const [v, q, city] of [['hotels', 'hotels in Indore', 'Indore'], ['flights', 'Indore to Delhi', ''], ['cab', 'Rajwada Indore to Airport', 'Indore'], ['bus', 'Indore to Ujjain', 'Indore']] as const) {
  const hubs = buildIntentHubs({ vertical: v, title: q, rows: [], city, travel: { depart: '2026-11-20', return: '2026-11-22' } });
  console.log(`\n${v}: ${hubs.length} hubs`);
  for (const h of hubs) console.log('  -', h.seller.padEnd(20), h.url.slice(0, 92));
}
// a live row must still suppress its own hub
const withLive = buildIntentHubs({ vertical: 'hotels', title: 'hotels in Indore', rows: [{ seller: 'Expedia', primaryPrice: 4200 }], city: 'Indore' });
console.log('\nexpedia hub suppressed when expedia has a row:', withLive.every((h) => h.seller !== 'Expedia'));
