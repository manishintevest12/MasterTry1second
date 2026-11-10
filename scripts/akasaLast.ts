import { cffiFetch } from '../server/common/curlCffiFetch';
import { rescueFetch } from '../server/sources/rescueFetch';
const api = 'https://prod-bl.qp.akasaair.com/api/ibe/availability/v2/search?origin=DEL&destination=BOM&startDate=2026-11-20&endDate=2026-11-27&numberOfPassengers=1&currencyCode=INR';
const full = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Origin': 'https://www.akasaair.com',
  'Referer': 'https://www.akasaair.com/',
  'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-site',
};
for (const imp of ['safari', 'chrome'] as const) {
  try {
    const r: any = await cffiFetch(api, { impersonate: imp, timeoutMs: 20000, headers: full } as any);
    console.log(`API ${imp} -> ${r.status} ${String(r.body || '').length}b :: ${String(r.body || '').slice(0, 150).replace(/\s+/g, ' ')}`);
  } catch (e: any) { console.log(`API ${imp} -> ERR ${String(e?.message || e).slice(0, 90)}`); }
}
for (const page of ['https://www.akasaair.com/low-fare-calendar', 'https://www.akasaair.com/flights/delhi-to-mumbai']) {
  const r = await rescueFetch(page, { timeoutMs: 20000, minHtmlBytes: 3000, maxRungs: 2 });
  const inr = (r.body.match(/(₹|INR)\s?[0-9][0-9,]{2,}/g) || []).length;
  console.log(`PAGE ${page.split('/').pop()} via=${r.via} ${r.body.length}b inr=${inr}`);
}
