import { cffiFetch } from '../server/common/curlCffiFetch';
const base = 'https://prod-bl.qp.akasaair.com';
const common = { impersonate: 'chrome' as const, timeoutMs: 20000, headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: 'https://www.akasaair.com', Referer: 'https://www.akasaair.com/' } };

async function show(label: string, url: string, method: string, body?: unknown) {
  try {
    const r: any = await cffiFetch(url, { ...common, method, ...(body ? { body: JSON.stringify(body) } : {}) } as any);
    const text = String(r.body || '');
    console.log(`${label} -> HTTP ${r.status} ${text.length}b :: ${text.slice(0, 260).replace(/\s+/g, ' ')}`);
  } catch (e: any) {
    console.log(`${label} -> ERR ${String(e?.message || e).slice(0, 120)}`);
  }
}

await show('LOWFARE-POST', `${base}/api/ibe/availability/v2/search/availability/search/lowFare`, 'POST', {
  currencyCode: 'INR', origin: 'DEL', destination: 'BOM',
  startDate: '2026-11-20', endDate: '2026-11-27',
  includeTaxesAndFees: true, numberOfPassengers: 1,
});
await show('LOWFARE-GET', `${base}/api/ibe/availability/v2/search?origin=DEL&destination=BOM&startDate=2026-11-20&endDate=2026-11-27&numberOfPassengers=1&currencyCode=INR`, 'GET');
