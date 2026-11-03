/**
 * ENDPOINT RECON (owner 3 Nov: "jiska date ni aa raha uska playwright/puppeteer ka use kr ke
 * endpoints la kr curl_cffi ko do").
 *
 * DEV-TIME ONLY. Production rules stay as they are: the server never drives a browser; a worker
 * must be a plain HTTP call. This script uses headless Chrome for ONE job - to watch what the real
 * page asks its own backend when a specific travel date is picked, so that a date-locked source
 * (Goibibo +30 days, Ixigo today+, Cleartrip client-side) can be turned into a date-accurate
 * curl_cffi call. It prints, for every JSON XHR the page makes:
 *   method, url, request body, the header set the page used, and the JSON paths that carry the
 *   requested date - which is exactly the recipe a worker needs.
 *
 * Usage: node tools/recon-endpoints.mjs <url> <YYYY-MM-DD> [outfile]
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const [url, dateIso, out = '/tmp/recon.json'] = process.argv.slice(2);
if (!url || !dateIso) { console.error('usage: node tools/recon-endpoints.mjs <url> <YYYY-MM-DD> [outfile]'); process.exit(2); }

const dmy = dateIso.split('-').reverse().join('/');
const alt = dateIso.replace(/-/g, '');
const CHROME = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p));

const interesting = (u) => /(search|fare|flight|itin|avail|result|calendar|offer|price|schedule)/i.test(u);
const carriesDate = (s) => {
  const t = String(s || '');
  return t.includes(dateIso) || t.includes(dmy) || t.includes(alt) || t.includes(dateIso.replace(/-/g, '/'));
};

// Proxy support (owner 3 Nov: "plus proxy collection rotational proxy v use kro jo apne paas hai").
// The same hops the server rotates through are handed to Chrome here, so a source that
// rate-limits our datacenter IP (Ixigo answers "Oops...too many requests!" to headless from this
// network) can still be reconnoitred from an exit the pool already validated.
const proxy = process.env.RECON_PROXY || '';
const launchArgs = ['--no-sandbox', '--disable-dev-shm-usage'];
if (proxy) launchArgs.push(`--proxy-server=${proxy}`);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell', args: launchArgs });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
const captured = [];
page.on('request', (r) => {
  const u = r.url();
  if (!interesting(u)) return;
  const post = r.postData() || '';
  captured.push({ url: u, method: r.method(), headers: r.headers(), post, dateInUrl: carriesDate(u), dateInBody: carriesDate(post) });
});
page.on('response', async (res) => {
  const req = res.request();
  const hit = captured.find((c) => c.url === req.url() && !c.status);
  if (!hit || !interesting(res.url())) return;
  hit.status = res.status();
  try {
    const ct = String(res.headers()['content-type'] || '');
    if (!/json/.test(ct)) return;
    const body = await res.text();
    hit.bodyBytes = body.length;
    const bare = body.replace(/\s+/g, '');
    hit.bodyHasDate = bare.includes(dateIso) || bare.includes(dmy.replace(/\//g, '\\/'));
    // sample the first date-looking token so the parser author knows what the API actually says
    const m = bare.match(/"(?:departureDate|depart_date|departDate|DepartDate|date|doj|DepartureDate)"\s*:\s*"?([0-9A-Za-z:\-\/\. ]{6,30})/);
    hit.dateFieldSample = m ? m.slice(0, 2) : null;
    const m2 = bare.match(/"(?:fare|price|amount|totalFare|totalPrice|Price)"\s*:\s*"?([0-9]{2,7})/);
    hit.priceSample = m2 ? Number(m2[1]) : null;
    fs.writeFileSync(out, JSON.stringify({ url, dateIso, captured }, null, 2));
  } catch { /* body already consumed */ }
});

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  // give the SPA time to fire its dated search XHR, then nudge it
  await new Promise((r) => setTimeout(r, 6000));
  for (let i = 0; i < 4; i++) { await page.evaluate(() => window.scrollBy(0, 700)); await new Promise((r) => setTimeout(r, 1200)); }
} catch (e) {
  console.error('nav:', String(e.message).slice(0, 120));
}
await browser.close();

const useful = captured
  .filter((c) => (c.dateInUrl || c.dateInBody || c.bodyHasDate) && (c.bodyBytes || 0) > 500)
  .sort((a, b) => (b.bodyBytes || 0) - (a.bodyBytes || 0));
fs.writeFileSync(out, JSON.stringify({ url, dateIso, total: captured.length, useful }, null, 2));
console.log('captured', captured.length, 'useful', useful.length, proxy ? `via ${proxy}` : '(direct)', '->', out);
for (const c of useful.slice(0, 6)) {
  console.log(`  ${c.status} ${c.method} ${c.url.slice(0, 130)}`);
  console.log(`     dateIn ${c.dateInUrl ? 'url' : 'body'} | ${c.bodyBytes}B | field ${JSON.stringify(c.dateFieldSample)} price ${c.priceSample}`);
  if (c.post) console.log(`     body ${String(c.post).slice(0, 180)}`);
}
