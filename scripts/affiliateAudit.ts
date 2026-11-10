/**
 * OWNER 10 Nov: "ye v check krna sb affiliate hai ki nahi" - for EVERY merchant this engine can exit to,
 * ask the REAL click path (buildSecureDeeplink, the same function /api/out uses) which network pays, and
 * print the ones that pay nothing so they become the partnership list.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildSecureDeeplink } from '../server/affiliate/deeplink';

const SKIP = new Set(['google.com','googleapis.com','gstatic.com','w3.org','schema.org','wikipedia.org','wikimedia.org','cloudflare.com','akamai.net','akamaized.net','facebook.com','instagram.com','twitter.com','x.com','youtube.com','linkedin.com','telegram.org','whatsapp.com','example.com','json.org','npmjs.com','github.com','jquery.com','bing.com','yahoo.com','deno.land','githubusercontent.com','imagekit.io','overpass-api.de','project-osrm.org','osm.ch','postalpincode.in','searchapi.io','kumi.systems','crane.aero','on.aws','openlibrary.org','imdbws.com','bmscdn.com','kotl.in','bank.in','try1second.com','vcommission.com','cuelinks.com','admitad.com']);
const INFRA = /google|adsymptotic|doubleclick|sentry|cloudfront|fastly|jsdelivr|unpkg|fonts|cdn\.|static\./;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}
function registrable(host: string): string {
  const parts = host.replace(/^www\./, '').split('.');
  if (parts.length <= 2) return parts.join('.');
  const two = ['co.in', 'co.uk', 'com.au', 'co.jp', 'com.br'];
  const tail2 = parts.slice(-2).join('.');
  return two.includes(tail2) ? parts.slice(-3).join('.') : tail2;
}

const verticals = new Map<string, Set<string>>();
for (const file of [...walk('server/sources'), ...walk('server/workers')]) {
  const vertical = file.match(/verticals\/([a-z]+)\.ts$/)?.[1] || 'other';
  for (const m of readFileSync(file, 'utf8').matchAll(/https?:\/\/([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi)) {
    const d = registrable(m[1].toLowerCase());
    if (SKIP.has(d) || INFRA.test(d)) continue;
    if (!verticals.has(d)) verticals.set(d, new Set());
    verticals.get(d)!.add(vertical);
  }
}

const rows: { domain: string; verticals: string; network: string; host: string; deep: boolean }[] = [];
for (const [domain, vs] of [...verticals].sort()) {
  const dest = `https://www.${domain}/`;
  let network = 'direct', host = '', deep = false;
  try {
    const r: any = await buildSecureDeeplink(dest, { vertical: [...vs][0] } as any);
    network = String(r?.network || 'direct');
    const t = String(r?.trackingUrl || '');
    host = t.match(/^https:\/\/([^/]+)/)?.[1] || '';
    deep = t.includes(encodeURIComponent(dest)) || t.includes(dest);
  } catch { network = 'error'; }
  rows.push({ domain, verticals: [...vs].join(','), network, host, deep });
}

const paid = rows.filter((r) => r.network !== 'direct' && r.network !== 'error');
const free = rows.filter((r) => r.network === 'direct' || r.network === 'error');
console.log(`MERCHANTS ${rows.length} | AFFILIATE-TRACKED ${paid.length} | PAYING NOTHING ${free.length}\n`);
const byNetwork = new Map<string, string[]>();
for (const r of paid) { if (!byNetwork.has(r.network)) byNetwork.set(r.network, []); byNetwork.get(r.network)!.push(r.domain); }
console.log('TRACKED BY NETWORK');
for (const [n, ds] of [...byNetwork].sort((a, b) => b[1].length - a[1].length)) {
  console.log(` ${n} (${ds.length}): ${ds.join(', ')}`);
}
console.log('\nPAYING NOTHING (need a partnership)');
const byVertical = new Map<string, string[]>();
for (const r of free) {
  const v = r.verticals.split(',')[0];
  if (!byVertical.has(v)) byVertical.set(v, []);
  byVertical.get(v)!.push(r.domain);
}
for (const [v, ds] of [...byVertical].sort((a, b) => b[1].length - a[1].length)) {
  console.log(` ${v} (${ds.length}): ${ds.join(', ')}`);
}
