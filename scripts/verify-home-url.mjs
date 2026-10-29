/**
 * Verify the Home URL sync in a real browser (owner 29 Oct report):
 *   /ecommerce -> click "Home" in the sub-nav -> address bar must become "/"
 *   then Back -> back on /ecommerce with the vertical tab selected.
 * Also checks the bottom-bar Home and the logo path leave a vertical page.
 *
 * Usage: node scripts/verify-home-url.mjs [baseUrl]
 */
import puppeteer from 'puppeteer-core';

const BASE = (process.argv[2] || 'http://127.0.0.1:4546').replace(/\/$/, '');

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const path = () => page.evaluate(() => window.location.pathname + window.location.hash);

// 1. Land on the E-commerce vertical.
await page.goto(`${BASE}/ecommerce`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise((r) => setTimeout(r, 9000));
check('opens on /ecommerce', (await path()) === '/ecommerce', await path());

// 2. Click the sub-nav Home button (the exact control the owner used).
const clickedNavHome = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const home = btns.find((b) => /\bHome\b/.test(b.textContent || '') && b.closest('.max-w-7xl'));
  if (!home) return false;
  home.click();
  return true;
});
check('sub-nav Home button found', clickedNavHome);
await new Promise((r) => setTimeout(r, 1200));
check('after sub-nav Home the URL is /', (await path()) === '/', await path());

// 3. Back must return to the vertical page.
await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
await new Promise((r) => setTimeout(r, 1200));
check('Back returns to /ecommerce', (await path()) === '/ecommerce', await path());

// 4. Bottom bar Home (mobile-only bar) leaves the vertical too.
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto(`${BASE}/hotels`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise((r) => setTimeout(r, 7000));
const clickedBottom = await page.evaluate(() => {
  const cands = Array.from(document.querySelectorAll('button')).filter(
    (b) => /^\s*Home\s*$/.test(b.textContent || '') && b.getBoundingClientRect().width > 0,
  );
  // the bottom bar sits in the lower part of the viewport
  const home = cands.find((b) => b.getBoundingClientRect().top > window.innerHeight * 0.6);
  if (!home) return false;
  home.click();
  return true;
});
await new Promise((r) => setTimeout(r, 1500));
const bottomPath = await path();
check('bottom bar Home found', clickedBottom);
check('bottom bar Home leaves /hotels', bottomPath === '/', bottomPath);

// 4b. The Try1Second logo also goes Home.
await page.goto(`${BASE}/ecommerce`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise((r) => setTimeout(r, 6000));
const clickedLogo = await page.evaluate(() => {
  // The brand mark is an SVG logo inside the header's first button (no text node).
  const header = document.querySelector('header');
  if (!header) return false;
  const logo = Array.from(header.querySelectorAll('button')).find((b) => b.querySelector('svg') && b.getBoundingClientRect().left < 220);
  if (!logo) return false;
  logo.click();
  return true;
});
await new Promise((r) => setTimeout(r, 1500));
check('logo found', clickedLogo);
check('logo Home leaves /ecommerce', (await path()) === '/', await path());
await page.setViewport({ width: 1440, height: 900 });

// 5. A product page must also return Home cleanly.
await page.goto(`${BASE}/product/boat-airdopes-141`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise((r) => setTimeout(r, 7000));
const prodBefore = await path();
await page.evaluate(() => {
  const home = Array.from(document.querySelectorAll('button')).find((b) => /^\s*Home\s*$/.test(b.textContent || ''));
  if (home) home.click();
});
await new Promise((r) => setTimeout(r, 1500));
const prodAfter = await path();
check('product page loads its own URL', prodBefore.startsWith('/product/'), prodBefore);
check('Home from product page -> /', prodAfter === '/', prodAfter);

// 6. Reloading / must show Home, not a stale vertical.
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise((r) => setTimeout(r, 5000));
check('reload of / stays on /', (await path()) === '/');

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length === 0 ? 'ALL PASS' : `${failed.length} FAILED`} (${results.length} checks)`);
process.exit(failed.length === 0 ? 0 : 1);
