import { rescueFetch } from '../server/sources/rescueFetch';
import { writeFileSync } from 'node:fs';
const home = 'https://www.akasaair.com/';
const h = await rescueFetch(home, { timeoutMs: 15000, minHtmlBytes: 2000, maxRungs: 3 });
const scripts = Array.from(h.body.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)).map((m) => m[1])
  .map((u) => (u.startsWith('http') ? u : new URL(u, home).toString()));
let saved = 0;
for (const js of scripts.slice(0, 6)) {
  const r = await rescueFetch(js, { timeoutMs: 15000, minHtmlBytes: 500, maxRungs: 2 });
  if (/availability\/v2|prod-bl\.qp/.test(r.body)) {
    writeFileSync('/tmp/akasa_app.js', r.body);
    console.log('SAVED', js.split('/').pop(), r.body.length);
    saved++;
    break;
  }
}
if (!saved) console.log('no bundle with api refs');
