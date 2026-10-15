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

    console.log(`pass ${pass} / fail ${fail}`);
  process.exit(fail ? 1 : 0);
})();