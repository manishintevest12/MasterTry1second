import { rescueFetch } from '../server/sources/rescueFetch';

type Case = { name: string; url: string; ok: RegExp };
const cases: Case[] = [
  { name: 'indigo(Akamai)', url: 'https://www.goindigo.in/', ok: /indigo/i },
  { name: 'cleartrip', url: 'https://www.cleartrip.com/flights', ok: /cleartrip/i },
  { name: 'akasa', url: 'https://www.akasaair.com/', ok: /akasa/i },
  { name: 'spicejet', url: 'https://www.spicejet.com/', ok: /spicejet/i },
  { name: 'redbus', url: 'https://www.redbus.in/', ok: /redbus/i },
  { name: 'makemytrip', url: 'https://www.makemytrip.com/', ok: /makemytrip/i },
];

for (const c of cases) {
  const r = await rescueFetch(c.url, { timeoutMs: 12000, minHtmlBytes: 3000, maxRungs: 4, validate: (b) => c.ok.test(b) });
  const pass = c.ok.test(r.body) && r.status === 200;
  console.log(`${c.name.padEnd(16)} ${pass ? 'OK ' : 'FAIL'} via=${String(r.via).padEnd(11)} status=${r.status} bytes=${r.body.length} | ${r.attempts.map(a => `${a.via}:${a.ok ? 'ok' : (a.reason || 'fail')}`).join('; ').slice(0, 150)}`);
}
