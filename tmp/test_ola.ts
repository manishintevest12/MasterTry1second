import { cabWorker } from '../server/workers/verticals/cab';

async function main() {
  const task = cabWorker.tasks.find((t) => t.sourceId === 'w_cab_ola')!;
  const fakeSource: any = { id: 'w_cab_ola', name: 'ola' };
  for (const q of ['delhi to ambience mall gurgaon', 'mumbai to gateway of india']) {
    try {
      const items = await task.run({ query: { rawQuery: q } as any, source: fakeSource, fetch: (async () => { throw new Error('unused'); }) as any });
      console.log('Q:', q);
      for (const it of (items as any[]).slice(0, 8)) console.log('  ->', it.title, '| ₹', it.price);
    } catch (e: any) {
      console.log('Q:', q, '-> HONEST:', String(e.message || e).slice(0, 150));
    }
  }
}
main();
