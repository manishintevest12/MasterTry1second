/** Every seller domain the four finance verticals can emit, and whether GroMo takes its exit. */
import { readFileSync } from 'node:fs';
import { affiliateNetworkFor } from '../server/affiliate/deeplink';
import { isFinanceDomain, isAggregatorDomain } from '../server/affiliate/gromo';

const FILES = ['creditcards', 'account', 'insurance', 'loans'];
const seen = new Map<string, Set<string>>();
for (const f of FILES) {
  const src = readFileSync(new URL(`../server/workers/verticals/${f}.ts`, import.meta.url), 'utf8');
  for (const m of src.matchAll(/['"`](?:https?:\/\/)?((?:[a-z0-9-]+\.)+(?:com|in|co\.in|bank\.in|org|net|io|pe|bank))(?:[/'"`\s])/gi)) {
    const d = m[1].toLowerCase().replace(/^www\./, '');
    if (!seen.has(d)) seen.set(d, new Set());
    seen.get(d)!.add(f);
  }
}
const rows = [...seen.entries()].sort().map(([d, vs]) => ({ d, vs: [...vs].join(','), net: affiliateNetworkFor(d) || 'direct' }));
const bad = rows.filter((r) => r.net !== 'gromo' && !isAggregatorDomain(r.d));
for (const r of rows) console.log(r.d.padEnd(34), r.net.padEnd(10), r.vs);
console.log('\nnot-on-gromo:', bad.length, 'of', rows.length, '| aggregators:', rows.filter((r) => isAggregatorDomain(r.d)).length);
