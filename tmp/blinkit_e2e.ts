import { groceryWorker } from '../server/workers/verticals/grocery';
(async () => {
  const task = groceryWorker.tasks.find((t) => t.sourceId === 'w_grocery_blinkit')!;
  for (const [term, city, lat, lng] of [['milk', 'Mumbai', 19.076, 72.8777], [' atta', 'Gurgaon', 28.4595, 77.0266], ['maggi', 'Delhi', 28.6139, 77.209]] as [string, string, number, number][]) {
    try {
      const items = await task.run({
        query: { rawQuery: `blinkit ${term}`, location: { city, lat, lng } } as any,
        source: { id: 'w_grocery_blinkit', name: 'blinkit' } as any,
        fetch: (async () => { throw new Error('unused'); }) as any,
      });
      console.log(`[${city}/${term.trim()}] ${items.length} items`);
      for (const it of (items as any[]).slice(0, 3)) console.log('   ₹' + it.price, '|', String(it.title || '').slice(0, 60), '|', String((it.attributes || {}).pack_size || '').slice(0, 20));
    } catch (e: any) {
      console.log(`[${city}/${term.trim()}] HONEST-FAIL:`, String(e.message || e).slice(0, 120));
    }
  }
  process.exit(0);
})();
