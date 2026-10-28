#!/usr/bin/env node
/**
 * One-command proof that a deploy is actually live and that every vertical answers.
 *
 * Owner's recurring problem (28 Oct): a fix was pushed, the site still showed the old behaviour,
 * and there was no way to tell "not deployed" from "still broken". This prints:
 *   1. the bundle the server is serving (compare with a local `npm run build` output),
 *   2. three polls per vertical: rows / sellers / real photos / pending flag,
 *   3. a PASS/FAIL per vertical, plus the first-paint loader markup on an SEO route.
 *
 * Usage: node scripts/verify-live.mjs [baseUrl]
 * Exit code 1 if any vertical answers zero rows on every poll, or the loader markup is missing.
 */
const BASE = (process.argv[2] || 'https://www.try1second.com').replace(/\/$/, '');
const FAVICON = /s2\/favicons|brand-logos/;
const POLLS = 3;
const GAP_MS = 2500;

const QUERIES = [
  ['hotels', 'Indore', { city: 'Indore', pincode: '452001', travelDates: { depart: isoIn(1), return: isoIn(4) }, guests: 2 }],
  ['flights', 'Indore (IDR) to Delhi (DEL)', { city: 'Indore', pincode: '452001', travelDates: { depart: isoIn(1) } }],
  ['bus', 'Indore to Bhopal', { city: 'Indore', pincode: '452001', travelDates: { depart: isoIn(1) } }],
  ['ecommerce', 'mobile phone', { city: 'Indore', pincode: '452001' }],
  ['grocery', 'milk', { city: 'Indore', pincode: '452001' }],
  ['food', 'biryani', { city: 'Indore', pincode: '452001' }],
  ['movies', 'movies', { city: 'Indore', pincode: '452001' }],
];

function isoIn(days) {
  const d = new Date(Date.now() + days * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  return res.json();
}

const stat = (results) => {
  const rows = results.length;
  const sellers = new Set(results.map((r) => r.subtitle || '?')).size;
  const photos = results.filter((r) => r.imageUrl && !FAVICON.test(r.imageUrl)).length;
  return { rows, sellers, photos };
};

let failures = 0;
const version = await fetch(`${BASE}/api/version`, { signal: AbortSignal.timeout(15000) }).then((r) => r.json()).catch(() => null);
console.log('deployed bundle :', version?.bundle ?? 'no /api/version (old build live)');
console.log('server started  :', version?.startedAt ?? '?', `(uptime ${version?.uptimeSec ?? '?'}s)`);
if (!version?.bundle) failures += 1;

for (const [vertical, query, extra] of QUERIES) {
  const line = [];
  let bestRows = 0;
  for (let i = 1; i <= POLLS; i += 1) {
    try {
      const d = await post('/api/scrape/live', { vertical, query, ...extra });
      const s = stat(d.results || []);
      bestRows = Math.max(bestRows, s.rows);
      line.push(`p${i} ${s.rows}r/${s.sellers}s/${s.photos}img${d.pendingRefresh ? '*' : ''}`);
    } catch (e) {
      line.push(`p${i} ERR`);
    }
    if (i < POLLS) await new Promise((r) => setTimeout(r, GAP_MS));
  }
  const verdict = bestRows > 0 ? 'PASS' : 'FAIL';
  if (bestRows === 0) failures += 1;
  console.log(`${verdict} ${vertical.padEnd(10)} ${line.join('  ')}`);
}

const page = await fetch(`${BASE}/hotels`, { signal: AbortSignal.timeout(20000) }).then((r) => r.text()).catch(() => '');
const loader = page.includes('data-t1s-prerender="loader"');
console.log(`${loader ? 'PASS' : 'FAIL'} first paint  loader markup on /hotels ${loader ? 'present' : 'MISSING (text page)'}`);
if (!loader) failures += 1;

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
