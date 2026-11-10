import { rescueFetch } from '../server/sources/rescueFetch';
const home = 'https://www.akasaair.com/';
const h = await rescueFetch(home, { timeoutMs: 15000, minHtmlBytes: 2000, maxRungs: 3 });
const scripts = Array.from(h.body.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)).map((m) => m[1])
  .filter((u) => !/gtm|analytics|hotjar|clarity|facebook/.test(u))
  .map((u) => (u.startsWith('http') ? u : new URL(u, home).toString()));
const hosts = new Set<string>();
for (const js of scripts.slice(0, 10)) {
  const r = await rescueFetch(js, { timeoutMs: 15000, minHtmlBytes: 500, maxRungs: 2 });
  const b = r.body;
  for (const m of b.matchAll(/https?:\/\/[a-z0-9.-]*akasaair[a-z0-9.-]*/gi)) hosts.add(m[0]);
  const i = b.indexOf('/api/ibe/availability/v2/search');
  if (i > -1) {
    console.log('FILE', js.split('/').pop(), 'context:');
    console.log(b.slice(Math.max(0, i - 600), i + 900).replace(/\s+/g, ' ').slice(0, 1400));
    break;
  }
}
console.log('HOSTS', Array.from(hosts).slice(0, 8).join(' | '));
