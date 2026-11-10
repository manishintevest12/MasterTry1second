/**
 * OWNER 10 Nov: "jo kahi se nahi hai unka report do, jiss se hum future mai unke partnership direct yaa
 * affiliate se kr ske". This walks the real source code, pulls every merchant domain the engine can
 * exit to, and asks the SAME routing preview the click path uses (affiliateNetworkFor) which network
 * pays for it right now. Mercels with null = the partnership target list.
 *
 * Honest limits: admin affiliate_configs rows live in production MySQL and are not readable here, so a
 * merchant that already has an admin row may still be paid even if this report says none. Everything
 * else (Cuelinks allow-list, Amazon tag, LinkInR sheet, Ekaro key, env template networks) is code/env
 * and therefore exact.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { affiliateNetworkFor } from '../server/affiliate/deeplink';

const SKIP = new Set([
  'google.com','googleapis.com','gstatic.com','w3.org','schema.org','wikipedia.org','wikimedia.org',
  'cloudflare.com','akamai.net','akamaized.net','facebook.com','instagram.com','twitter.com','x.com',
  'youtube.com','linkedin.com','telegram.org','whatsapp.com','example.com','json.org','npmjs.com',
  'github.com','jquery.com','fonts.googleapis.com','fonts.gstatic.com','bing.com','yahoo.com',
  // infrastructure / data providers and our own hosts - not partnership targets
  'deno.land','githubusercontent.com','imagekit.io','overpass-api.de','project-osrm.org','osm.ch',
  'postalpincode.in','searchapi.io','kumi.systems','crane.aero','on.aws','openlibrary.org','imdbws.com',
  'bmscdn.com','kotl.in','bank.in','try1second.com','vcommission.com','cuelinks.com','admitad.com',
]);

const VERTICAL_OF: Record<string, string> = {};
const DOMAIN_VERTICALS = new Map<string, Set<string>>();

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

function registrable(host: string): string {
  const parts = host.replace(/^www\./, '').split('.');
  if (parts.length <= 2) return parts.join('.');
  const twoLevel = ['co.in', 'co.uk', 'com.au', 'co.jp', 'com.br'];
  const tail2 = parts.slice(-2).join('.');
  return twoLevel.includes(tail2) ? parts.slice(-3).join('.') : tail2;
}

const files = [...walk('server/sources'), ...walk('server/workers')];
for (const file of files) {
  const vertical = (file.match(/verticals\/([a-z]+)\.ts$/)?.[1]) || 'other';
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/https?:\/\/([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi)) {
    const domain = registrable(m[1].toLowerCase());
    if (SKIP.has(domain) || /google|adsymptotic|doubleclick|sentry/.test(domain)) continue;
    if (!DOMAIN_VERTICALS.has(domain)) DOMAIN_VERTICALS.set(domain, new Set());
    DOMAIN_VERTICALS.get(domain)!.add(vertical);
    VERTICAL_OF[domain] = vertical;
  }
}

const rows = [...DOMAIN_VERTICALS.entries()]
  .map(([domain, verticals]) => ({
    domain,
    verticals: [...verticals].sort().join(', '),
    network: affiliateNetworkFor(domain),
  }))
  .sort((a, b) => (a.network === b.network ? a.domain.localeCompare(b.domain) : (a.network ? 1 : -1) || a.domain.localeCompare(b.domain)));

const covered = rows.filter((r) => r.network);
const uncovered = rows.filter((r) => !r.network);
const byNetwork: Record<string, number> = {};
for (const r of covered) byNetwork[r.network!] = (byNetwork[r.network!] || 0) + 1;

writeFileSync('artifacts/affiliate-coverage.json', JSON.stringify({ generatedAt: new Date().toISOString(), total: rows.length, covered: covered.length, uncovered: uncovered.length, byNetwork, rows }, null, 2));
console.log(JSON.stringify({ total: rows.length, covered: covered.length, uncovered: uncovered.length, byNetwork }, null, 1));
console.log('--- uncovered (partnership targets) ---');
console.log(uncovered.map((r) => r.domain).join(', '));
