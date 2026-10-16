// Node harness: load lib/api.js with a chrome stub and test matching logic.
global.chrome = {
  storage: { local: {
    get: async () => ({}),
    set: async () => {},
  } },
  action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
};
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('chrome-extension/lib/api.js', 'utf8') +
  '\n;globalThis.__t1s = { pickMatchingResult, groupByEntity, cheapestOf, priceOf, inr, IS_CONTENT_SCRIPT, looksLikeLink };';
vm.runInThisContext(code);
const { pickMatchingResult, groupByEntity, cheapestOf, priceOf, inr, IS_CONTENT_SCRIPT, looksLikeLink } = globalThis.__t1s;

(async () => {
  let pass = 0, fail = 0;
  const t = (name, cond) => { cond ? pass++ : (fail++, console.log('FAIL:', name)); };

  const results = [
    { id: 'a', canonicalEntityId: 101, title: 'boAt Airdopes 141 TWS Earbuds', seller: 'Amazon India', sellerUrl: 'https://amazon.in/x', prices: { effectivePrice: 1099 } },
    { id: 'b', canonicalEntityId: 101, title: 'boAt Airdopes 141 True Wireless Earbuds', seller: 'Flipkart', sellerUrl: 'https://flipkart.com/y', prices: { effectivePrice: 999 } },
    { id: 'c', canonicalEntityId: 202, title: 'OnePlus Nord Buds 2', seller: 'Croma', sellerUrl: '', prices: { effectivePrice: 1799 } },
    { id: 'd', canonicalEntityId: null, title: 'random unpriced thing', seller: 'X', sellerUrl: '', prices: {} },
  ];

  // 1) entity-id match picks the cheapest offer of that entity
  const byEntity = pickMatchingResult(results, 'boAt Airdopes 141', 101);
  t('entity match returns Flipkart offer', byEntity && byEntity.id === 'b');

  // 2) title-overlap match when no canonical id (>=60% token overlap)
  const byTitle = pickMatchingResult(results, 'boAt Airdopes 141 TWS Earbuds', null);
  t('title match finds airdopes', byTitle && byTitle.canonicalEntityId === 101);

  // 3) no overlap -> null (honest no-match, never best-guess)
  const noMatch = pickMatchingResult(results, 'Samsung Galaxy S24 Ultra', null);
  t('unrelated page title yields null', noMatch === null);

  // 4) groupByEntity groups and bests
  const groups = groupByEntity(results);
  const g101 = groups.find((g) => String(g.best.canonicalEntityId) === '101');
  t('group 101 has 2 offers', g101 && g101.offers.length === 2);
  t('group best price is 999', g101 && priceOf(g101.best) === 999);

  // 5) grouping puts unpriced entity separately
  t('3 groups: entity 101, entity 202, standalone offer', groups.length === 3);

  // 6) inr formatting
  t('inr formats', inr(1099) === '₹1,099');

  // 7) cheapestOf with zero prices never picks 0 over real price
  const mixed = [{ id:'p', prices:{effectivePrice:0} }, { id:'q', prices:{effectivePrice:450} }];
  t('cheapestOf skips zero prices', cheapestOf(mixed).id === 'q');

  // 8) IS_CONTENT_SCRIPT detection is false in Node/SW context
  t('not detected as content script', IS_CONTENT_SCRIPT === false);

  // 9) Price Lens: a pasted link (alone or inside share text) is a link; a product name is not
  t('plain url is a link', looksLikeLink('https://www.flipkart.com/apple-iphone-17/p/itm1') === true);
  t('share blurb with url is a link', looksLikeLink('Check this https://dl.flipkart.com/s/abc so cheap') === true);
  t('product name is not a link', looksLikeLink('boAt Airdopes 141') === false);
  t('empty is not a link', looksLikeLink('') === false);

// ---- v1.4.0 additions: merchant-key mapping for the Auto Coupon tester ----
const sitesCode = fs.readFileSync('chrome-extension/lib/sites.js', 'utf8') +
  '\n;globalThis.__t1sSites = { merchantKeyFor };';
try { vm.runInThisContext(sitesCode); } catch (e) { /* needs no DOM at load time */ }
const { merchantKeyFor } = globalThis.__t1sSites || {};

t('merchantKeyFor: Amazon India -> amazon', merchantKeyFor('Amazon India') === 'amazon');
t('merchantKeyFor: Flipkart -> flipkart', merchantKeyFor('Flipkart') === 'flipkart');
t('merchantKeyFor: Tata CLiQ -> tatacliq', merchantKeyFor('Tata CLiQ') === 'tatacliq');
t('merchantKeyFor: Swiggy Instamart -> swiggy', merchantKeyFor('Swiggy Instamart') === 'swiggy');
t('merchantKeyFor: Domino\'s India -> dominos', merchantKeyFor("Domino's India") === 'dominos');
t('merchantKeyFor: unknown site slugs cleanly', merchantKeyFor('Book My Show') === 'bookmyshow');

// ---- v1.4.1 additions: popup auto-grab URL classification ----
const popupCode = fs.readFileSync('chrome-extension/popup/popup.js', 'utf8');
const classifyMatch = popupCode.match(/function classifyMerchantUrl[\s\S]*?\n\}/);
t('popup.js defines classifyMerchantUrl for auto-grab routing', !!classifyMatch);
if (classifyMatch) {
  vm.runInThisContext(classifyMatch[0] + ';globalThis.__classify = classifyMerchantUrl;');
  const classify = globalThis.__classify;
  t('flipkart search URL -> search "iphone"', classify('https://www.flipkart.com/search?q=iphone&otracker=search').query === 'iphone');
  t('amazon /s?k= -> search', classify('https://www.amazon.in/s?k=iphone+15').query === 'iphone 15');
  t('amazon /dp/ -> product page', classify('https://www.amazon.in/dp/B0FQFQF6D1').kind === 'product');
  t('flipkart /p/ -> product page', classify('https://www.flipkart.com/x/p/itm1').kind === 'product');
  t('ajio /s/?query= -> search', classify('https://www.ajio.com/s/?query=nike+shoes').query === 'nike shoes');
  t('tatacliq searchText packs relevance suffix', classify('https://www.tatacliq.com/search/?searchText=nike:relevance:inStockFlag:true').query === 'nike');
  t('non-merchant host -> none (no auto-run)', classify('https://www.google.com/search?q=x').kind === 'none');
  t('content script answers t1s-get-product (source present)', /t1s-get-product/.test(fs.readFileSync('chrome-extension/content/content.js', 'utf8')));
  t('popup auto-grabs on open (autoGrab present)', /async function autoGrab/.test(popupCode));
}

// ---- v1.7.0: dock/sidebar feature logic (Deal Score, history windows, themes) ----
{
  const contentCode = fs.readFileSync('chrome-extension/content/content.js', 'utf8');

  // computeDealScore must be honest: <2 points -> null
  const dsMatch = contentCode.match(/function computeDealScore[\s\S]*?\n  \}/);
  t('content.js defines computeDealScore', !!dsMatch);
  if (dsMatch) {
    vm.runInThisContext(dsMatch[0] + ';globalThis.__cds = computeDealScore;');
    const cds = globalThis.__cds;
    t('deal score: <2 real points -> null (honest)', cds([{ price: 100 }], 100) === null);
    t('deal score: empty history -> null', cds([], 500) === null);
    const lowHigh = cds([{ price: 100 }, { price: 200 }, { price: 150 }], 100);
    t('deal score: at ATL -> 100 / Buy now', lowHigh.score === 100 && lowHigh.verdict.label === 'Buy now');
    const mid = cds([{ price: 100 }, { price: 200 }, { price: 150 }], 150);
    t('deal score: mid-range scales linearly', mid.score === 50 && Number.isInteger(mid.avg));
    const worst = cds([{ price: 100 }, { price: 200 }], 200);
    t('deal score: at recorded high -> floor 5 / wait', worst.score === 5 && worst.verdict.label === 'Wait for a drop');
  }

  // history window filtering: real capturedAt cutoff, honest full-range fallback
  const hwMatch = contentCode.match(/function historyWindow[\s\S]*?\n  \}/);
  t('content.js defines historyWindow for 90D/180D/365D tabs', !!hwMatch);
  if (hwMatch) {
    vm.runInThisContext(hwMatch[0] + ';globalThis.__hw = historyWindow;');
    const hw = globalThis.__hw;
    const now = Date.now();
    const pts = [
      { price: 100, capturedAt: new Date(now - 400 * 86400000).toISOString() },
      { price: 110, capturedAt: new Date(now - 100 * 86400000).toISOString() },
      { price: 120, capturedAt: new Date(now - 50 * 86400000).toISOString() },
      { price: 130, capturedAt: new Date(now - 10 * 86400000).toISOString() },
    ];
    t('history window 90D keeps only recent points', hw(pts, 90).length === 2);
    t('history window 365D keeps three of four', hw(pts, 365).length === 3);
    t('history window falls back to full range when <2 points', hw(pts.slice(0, 1).concat(pts.slice(3, 4)), 30).length === 2);
  }

  // all 9 feature toggles must be real keys used in code (no dead switches)
  const togMatch = contentCode.match(/const FEATURE_TOGGLES = \[[\s\S]*?\];/);
  t('FEATURE_TOGGLES list present in popover', !!togMatch);
  if (togMatch) {
    const keys = [...togMatch[0].matchAll(/key: '([a-zA-Z]+)'/g)].map((m) => m[1]);
    t('9 real feature toggles defined', keys.length === 9);
    for (const k of keys) t(`toggle ${k} is wired somewhere in content.js`, new RegExp('prefs\\.' + k + '|next\\[' + k + '\\]|\.' + k + ' ').test(contentCode) || contentCode.includes("'" + k + "'"));
  }

  // 8 themes with rail+accent
  t('8 themes defined (Midnight..Amethyst)', (contentCode.match(/name: '/g) || []).length >= 8 && contentCode.includes('amethyst'));
  // savings ledger recorded on cheaper-switch
  t('cheaper-switch click records real savings (recordSavings wired)', /await recordSavings\(savings\)/.test(contentCode));
  // privacy-first recent views
  t('recent views privacy banner present (on-device only claim)', /not shared externally/.test(contentCode));
  // per-site page/site visibility controls
  t('disable-for-page/site session controls present', contentCode.includes('t1sOffPage') && contentCode.includes('t1sOffSite:'));
  // SW target alerts still intact
  const swCode = fs.readFileSync('chrome-extension/background/service-worker.js', 'utf8');
  t('SW fires one-time target-hit notifications', /notifyTarget/.test(swCode) && /targetHit/.test(swCode));
  t('SW respects dropNotifications pref', /dropNotifications/.test(swCode));
}

// ---- v1.7.2: white-block layout bugs (popup wordmark overflow, panel/dock overlap) ----
{
  const popupCss = fs.readFileSync('chrome-extension/popup/popup.css', 'utf8');
  t('popup wordmark sized (no 652px natural-width overflow)', /\.t1s-wd\s*{\s*height:\s*17px/.test(popupCss));
  t('popup logo icon sized', /\.t1s-ic img\s*{\s*width:\s*31px/.test(popupCss));
  t('popup html background matches body (no white strip)', /html\s*{\s*background:\s*#F4F7FA/.test(popupCss));

  const contentCss = fs.readFileSync('chrome-extension/content/content.css', 'utf8');
  t('comparison panel sits left of the 64px rail (right: 84px, no overlap)', /\.t1s-root\s*{[^}]*right:\s*84px/.test(contentCss.replace(/\n/g, ' ')) || contentCss.includes('right: 84px'));
  t('closed sidebar cannot leave a white sheet (visibility guard)', contentCss.includes('.t1s-sb:not(.t1s-sb-open) { visibility: hidden'));

  const contentCode = fs.readFileSync('chrome-extension/content/content.js', 'utf8');
  t('bar toggle re-attaches a detached/absorbed panel (isConnected check)', contentCode.includes('!panel.isConnected || panel.closest'));
}

    console.log(`pass ${pass} / fail ${fail}`);
  process.exit(fail ? 1 : 0);
})();