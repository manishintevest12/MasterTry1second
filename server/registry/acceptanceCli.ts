/** CLI: npm run acceptance — Section 16 live source-by-source acceptance sweep. */
import { runAcceptanceTests, persistAcceptance, acceptanceTotals } from './acceptanceRunner';
import { writeFileSync } from 'fs';

async function main() {
  process.stdout.write('Running Section 16 acceptance probes...\n');
  const rows = await runAcceptanceTests();
  await persistAcceptance(rows);
  const totals = acceptanceTotals(rows);
  for (const r of rows.sort((a, b) => a.source_id.localeCompare(b.source_id) || a.capability.localeCompare(b.capability))) {
    console.log(`${r.status.padEnd(24)} ${r.source_id.padEnd(20)} ${r.capability.padEnd(24)} ${(r.http_status ?? '-')} items=${r.items_extracted ?? 0}  ${String(r.evidence || '').slice(0, 80)}`);
  }
  console.log('\nTOTALS:', JSON.stringify(totals, null, 1));
  writeFileSync('docs/acceptance-results.json', JSON.stringify({ ranAt: new Date().toISOString(), totals, rows }, null, 1));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
