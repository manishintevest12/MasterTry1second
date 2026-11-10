import { rescueFetch } from '../server/sources/rescueFetch';
const targets: [string, string][] = [
  ['akasa', 'https://www.akasaair.com/'],
  ['indigo', 'https://www.goindigo.in/'],
  ['cleartrip-flights', 'https://www.cleartrip.com/flights'],
];
for (const [name, url] of targets) {
  const r = await rescueFetch(url, { timeoutMs: 15000, minHtmlBytes: 3000, maxRungs: 3 });
  const inr = (r.body.match(/(₹|INR)\s?[0-9][0-9,]{2,}/g) || []).length;
  const fareKeys = (r.body.match(/"(fare|totalFare|baseFare|price|amount)"\s*:/g) || []).length;
  const apiHints = (r.body.match(/https?:\/\/[a-z0-9.-]*(api|graphql|search)[a-z0-9./-]*/gi) || []).slice(0, 3);
  console.log(`${name.padEnd(18)} via=${r.via} bytes=${r.body.length} inr=${inr} fareKeys=${fareKeys}`);
  if (apiHints.length) console.log('    api hints:', apiHints.join(' ').slice(0, 160));
}
