import { rescueFetch, describeRescue } from '../server/sources/rescueFetch';
const url = 'https://prod-bl.qp.akasaair.com/api/ibe/availability/v2/search?origin=DEL&destination=BOM&startDate=2026-11-20&endDate=2026-11-27&numberOfPassengers=1&currencyCode=INR';
const r = await rescueFetch(url, { timeoutMs: 25000, minHtmlBytes: 40, maxRungs: 3, validate: (b) => /price|fare|amount/i.test(b) && b.length < 200000 });
console.log('via', r.via, '| status', r.status, '|', r.body.length, 'b');
console.log(describeRescue(r).slice(0, 220));
console.log(r.body.slice(0, 400).replace(/\s+/g, ' '));
