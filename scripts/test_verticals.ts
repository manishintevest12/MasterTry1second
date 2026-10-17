import { loansWorker } from '../server/workers/verticals/loans';
import { insuranceWorker } from '../server/workers/verticals/insurance';
import { creditCardsWorker } from '../server/workers/verticals/creditcards';
import { cffiFetch } from '../server/common/curlCffiFetch';

async function runWorker(worker: any, queryStr: string) {
  console.log(`\n=== Running vertical: ${worker.vertical.toUpperCase()} (query: "${queryStr}") ===`);
  const mockCtx: any = {
    query: { rawQuery: queryStr, entityName: queryStr },
    source: { id: 'test', name: 'Test' },
    fetch: async (url: string, opts: any = {}) => {
      return cffiFetch(url, { impersonate: 'chrome', timeoutMs: 15_000, ...opts });
    }
  };

  for (const task of worker.tasks) {
    const start = Date.now();
    try {
      const items = await task.run(mockCtx);
      console.log(`✅ [${task.sourceId}] ${task.name}: ${items?.length || 0} items returned (${Date.now() - start}ms)`);
      if (items && items.length > 0) {
        console.log(`   Sample item:`, JSON.stringify(items[0]).slice(0, 200));
      }
    } catch (err: any) {
      console.log(`❌ [${task.sourceId}] ${task.name}: Error: [${err.name || err.code}] ${err.message} (${Date.now() - start}ms)`);
    }
  }
}

async function main() {
  await runWorker(loansWorker, 'personal loan');
  await runWorker(insuranceWorker, 'health insurance');
  await runWorker(creditCardsWorker, 'credit card');
}

main().catch(console.error);
