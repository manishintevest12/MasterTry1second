import { runSearch } from '../server/search/searchOrchestrator';

async function test(query: string, vertical: string) {
  console.log(`\n==================================================`);
  console.log(`Searching query="${query}", vertical="${vertical}"`);
  console.log(`==================================================`);
  const res = await runSearch({ query, vertical });
  console.log(`State:`, JSON.stringify(res.state, null, 2));
  console.log(`Total results count: ${res.results.length}`);

  const sellers = new Set<string>();
  const sources = new Set<string>();
  res.results.forEach((r, idx) => {
    sellers.add(r.seller);
    sources.add(r.provenance.sourceId);
    if (idx < 10) {
      console.log(`  Row ${idx+1}: [${r.provenance.sourceId}] Seller: "${r.seller}", Title: "${r.title}", Price: ${r.prices.listPrice || r.prices.effectivePrice || 'N/A'}`);
    }
  });
  console.log(`\nUnique Sellers (${sellers.size}):`, Array.from(sellers));
  console.log(`Unique Sources (${sources.size}):`, Array.from(sources));
}

async function main() {
  await test('personal loan', 'loans');
  await test('health insurance', 'insurance');
  await test('credit card', 'creditcards');
}

main().catch(console.error);
