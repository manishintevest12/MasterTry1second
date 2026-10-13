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
  '\n;globalThis.__t1s = { pickMatchingResult, groupByEntity, cheapestOf, priceOf, inr, IS_CONTENT_SCRIPT };';
vm.runInThisContext(code);
const { pickMatchingResult, groupByEntity, cheapestOf, priceOf, inr, IS_CONTENT_SCRIPT } = globalThis.__t1s;

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

  console.log(`pass ${pass} / fail ${fail}`);
  process.exit(fail ? 1 : 0);
})();
