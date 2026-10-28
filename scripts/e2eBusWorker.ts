/** Run one vertical worker task end-to-end against the real web (no server needed). */
import { busWorker } from '../server/workers/verticals/bus';

async function main() {
  const sourceId = process.argv[2] || 'w_bus_makemytrip';
  const task: any = (busWorker as any).tasks.find((t: any) => t.sourceId === sourceId);
  if (!task) throw new Error(`no task ${sourceId}`);
  const depart = process.argv[3] || new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const ctx: any = {
    query: { rawQuery: `${process.argv[4] || 'bus from Indore to Bhopal'} ${depart}`, travelDates: { depart } },
    source: { id: sourceId, method: 'direct_http', vertical: 'bus', name: task.name },
    fetch: fetch,
  };
  const t0 = Date.now();
  try {
    const items = await task.run(ctx);
    console.log(`${sourceId} OK ${items.length} rows in ${Date.now() - t0}ms`);
    for (const it of items.slice(0, 4)) console.log(`  Rs${it.price} ${it.attributes?.operator} ${it.attributes?.departure} ${it.sellerUrl}`);
  } catch (e: any) {
    console.log(`${sourceId} FAILED in ${Date.now() - t0}ms: ${e?.code || e?.name} ${String(e?.message || e).slice(0, 160)}`);
  }
}
main();
