/**
 * Measure the two "important" home sections after the owner's 29 Oct size increase:
 * hero search bar + SUPPORTS row, and the Ask Try1Second AI card.
 * Saves desktop + mobile screenshots and prints element heights so the growth is verifiable.
 */
import puppeteer from 'puppeteer-core';

const BASE = (process.argv[2] || 'http://127.0.0.1:4547').replace(/\/$/, '');
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();

const measure = async (label, w, h, mobile) => {
  await page.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile });
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 6500));
  const data = await page.evaluate(() => {
    const rect = (el) => (el ? el.getBoundingClientRect() : null);
    const input = document.querySelector('input[aria-label="Paste a product link or type a product name"]');
    const heroCard = input?.closest('div.rounded-3xl, div.rounded-2xl');
    const form = input?.closest('form');
    const supportsLabel = Array.from(document.querySelectorAll('span')).find((s) => /^supports$/i.test(s.textContent || ''));
    const supportsRow = supportsLabel?.parentElement;
    const chip = supportsRow?.querySelector('span.w-9, span.w-11');
    const aiHeading = Array.from(document.querySelectorAll('h2')).find((e) => /ask try1second ai/i.test(e.textContent || ''));
    const aiCard = aiHeading?.closest('div.rounded-3xl, div.rounded-2xl');
    const xOf = (el) => (el ? Math.round(el.getBoundingClientRect().left) : null);
    const aiInput = document.querySelector('input[aria-label="Ask the assistant"]');
    const aiForm = aiInput?.closest('form');
    const aiChip = Array.from(document.querySelectorAll('button')).find((b) => /Delhi to Mumbai flight/.test(b.textContent || ''));
    const r = (x) => (x ? Math.round(x.width) + 'x' + Math.round(x.height) : 'n/a');
    return {
      heroCard: r(rect(heroCard)),
      heroForm: r(rect(form)),
      heroInputFont: input ? getComputedStyle(input).fontSize : 'n/a',
      supportsRow: r(rect(supportsRow)),
      supportLogo: r(rect(chip)),
      aiCard: r(rect(aiCard)),
      aiInput: r(rect(aiInput)),
      aiForm: r(rect(aiForm)),
      aiInputFont: aiInput ? getComputedStyle(aiInput).fontSize : 'n/a',
      aiChip: r(rect(aiChip)),
      heroLeft: xOf(heroCard),
      aiLeft: xOf(aiCard),
    };
  });
  console.log(`\n[${label} ${w}x${h}]`);
  for (const [k, v] of Object.entries(data)) console.log(`  ${k}: ${v}`);
  await page.screenshot({ path: `screens/home-sections-${label}.png`, fullPage: false });
  return data;
};

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
const desktop = await measure('desktop', 1440, 900, false);
const mobile = await measure('mobile', 390, 844, true);
await browser.close();

const grows = [
  ['hero card wider than 768px', parseInt(desktop.heroCard) > 768],
  ['hero bar at least 60px tall', parseInt(desktop.heroForm.split('x')[1]) >= 60],
  ['hero input 18px type', desktop.heroInputFont === '18px'],
  ['support logos at least 44px', parseInt(desktop.supportLogo.split('x')[0]) >= 44],
  ['AI card shares the hero card column', desktop.aiLeft === desktop.heroLeft && parseInt(desktop.aiCard.split('x')[0]) === parseInt(desktop.heroCard.split('x')[0])],
  ['AI card wider than the old 832px card', parseInt(desktop.aiCard.split('x')[0]) > 832],
  ['AI bar at least 72px tall', parseInt(desktop.aiForm.split('x')[1]) >= 72],
  ['AI input 18px type', desktop.aiInputFont === '18px'],
  ['mobile AI bar at least 56px tall', parseInt(mobile.aiForm.split('x')[1]) >= 56],
  ['mobile hero bar at least 48px tall', parseInt(mobile.heroForm.split('x')[1]) >= 48],
];
console.log('\nchecks:');
let bad = 0;
for (const [name, ok] of grows) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) bad += 1;
}
process.exit(bad === 0 ? 0 : 1);
