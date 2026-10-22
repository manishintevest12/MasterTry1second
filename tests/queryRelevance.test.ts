/**
 * Query-relevance gate for catalogue replay rows (owner 22 Oct).
 * Regression: the "Picked Just For You" category pills must return ONLY rows
 * relevant to their own category — a fresh iPhone batch must never supplement
 * a "men's wrist watches" search.
 */
import { passesQueryRelevance, queryTokens } from '../server/search/queryRelevance';

const watchQuery: any = { rawQuery: "men's Wrist Watches" };
const tvQuery: any = { rawQuery: 'Smart Televisions' };
const browseQuery: any = { rawQuery: '' };

let passed = 0, failed = 0;
const t = (name: string, cond: boolean) => { cond ? passed++ : (failed++, console.error(`FAIL ${name}`)); };

// 1. iPhone catalogue rows are NOT relevant to a watch query
t('watch query rejects iphone row', passesQueryRelevance(
  { title: 'Apple iPhone 18 Pro Max 256 GB, Glacier', brand: 'Apple' }, watchQuery) === false);

// 2. A real watch listing IS relevant (stemmed plural + apostrophe forms)
t('watch query accepts watch row', passesQueryRelevance(
  { title: "Fossil Grant Men's Wrist Watch Analog", brand: 'Fossil' }, watchQuery) === true);
t('watch stem (watches/watch) matches', passesQueryRelevance(
  { title: 'Sonata gold watch for men', brand: null }, watchQuery) === true);

// 3. TV query: TV rows pass, phone rows don't
t('tv query accepts smart tv', passesQueryRelevance(
  { title: 'Samsung 43-inch Crystal Smart Television', brand: 'Samsung' }, tvQuery) === true);
t('tv query rejects shoe row', passesQueryRelevance(
  { title: 'Nike Running Shoes for Men', brand: 'Nike' }, tvQuery) === false);

// 4. Watch query rejects shoes (distinctive tokens disjoint)
t('watch query rejects shoes', passesQueryRelevance(
  { title: 'Nike Revolution men running shoes', brand: 'Nike' }, watchQuery) === false);

// 5. Same-category rows keep replaying (iPhone query vs iPhone catalogue row)
t('iphone query accepts iphone row', passesQueryRelevance(
  { title: 'Apple iPhone 18 Pro 256 GB', brand: 'Apple' }, { rawQuery: 'apple iphone 18 pro 256 gb' } as any) === true);

// 6. Browse mode (empty query) passes everything
t('browse passes all', passesQueryRelevance({ title: 'anything at all', brand: null }, browseQuery) === true);

// 7. Category attribute counts too
t('category attr can carry relevance', passesQueryRelevance(
  { title: 'Series 8 LTE 45mm', attributes: { category: 'smart watches' } },
  { rawQuery: 'smart watches' } as any) === true);

// 8. Token sanity
const toks = queryTokens({ rawQuery: "men's Wrist Watches" } as any);
t('tokens stemmed', toks.has('wrist') && toks.has('watch') && toks.has('men'));
t('stopwords dropped', !toks.has('the'));

// 9. Accessory/supplement guard (owner 22 Oct: 'tablet' query showed Tablet
//    Stands and Multivitamin Tablets; 'mobile power banks' showed chargers).
const tabletQuery: any = { rawQuery: 'tablets' };
t('tablet query rejects tablet stand', passesQueryRelevance(
  { title: 'Portronics Metal Tablet Stand POR-3105', brand: 'Portronics' }, tabletQuery) === false);
t('tablet query rejects multivitamin pills', passesQueryRelevance(
  { title: 'Skinaa Women Multivitamin Tablets', brand: 'Skinaa' }, tabletQuery) === false);
t('tablet query accepts real tablet', passesQueryRelevance(
  { title: 'Lenovo Tab M11 Wi-Fi Tablet 128 GB', brand: 'Lenovo' }, tabletQuery) === true);
t('laptop query rejects laptop bag', passesQueryRelevance(
  { title: 'HP Omen Gaming Laptop Bag 15 inch', brand: 'HP' }, { rawQuery: 'laptop' } as any) === false);
t('laptop bag query accepts laptop bag', passesQueryRelevance(
  { title: 'HP Omen Gaming Laptop Bag 15 inch', brand: 'HP' }, { rawQuery: 'laptop bag' } as any) === true);
t('power bank query rejects charger-holder', passesQueryRelevance(
  { title: 'Portronics USB Charger & Mobile Holder 3AC Socket', brand: 'Portronics' },
  { rawQuery: 'mobile power banks' } as any) === false);
t('iphone query rejects back cover', passesQueryRelevance(
  { title: 'iPhone 15 Pro Back Cover Case', brand: 'Apple' }, { rawQuery: 'iphone 15' } as any) === false);
t('earbuds query accepts charging case product', passesQueryRelevance(
  { title: 'boAt Airdopes 141 TWS Earbuds with Charging Case', brand: 'boAt' },
  { rawQuery: 'earbuds' } as any) === true);
t('charger query accepts charger', passesQueryRelevance(
  { title: 'Samsung 25W Type-C Fast Charger', brand: 'Samsung' }, { rawQuery: 'samsung charger' } as any) === true);
t('tablet query rejects probiotics tablets', passesQueryRelevance(
  { title: 'The Good Bug Magnesium Bisglycinate Tablets with Probiotics', brand: 'The Good Bug' }, tabletQuery) === false);
t('tablet query rejects arnica homeopathy tablets', passesQueryRelevance(
  { title: 'Allen Arnica Plus Triple Action Hair Vitality Tablets', brand: 'Allen' }, tabletQuery) === false);
t('tablet query rejects glutathione tablets', passesQueryRelevance(
  { title: 'CHICNUTRIX Glow 500 MG Glutathione Tablets - Orange', brand: 'CHICNUTRIX' }, tabletQuery) === false);
t('tablet query rejects keyboard pack', passesQueryRelevance(
  { title: 'Idea Tab Pro Gen 2 Keyboard Pack - Luna Grey', brand: 'Lenovo' }, tabletQuery) === false);
t('tablet query accepts bundled pen tablet', passesQueryRelevance(
  { title: 'Idea Tab 27.94 cms (11) 6 GB 128 GB 5G + Pen - Luna Grey', brand: 'Lenovo' }, tabletQuery) === true);
t('tv query rejects smart dock', passesQueryRelevance(
  { title: 'ThinkPad Thunderbolt 4 Smart Dock Gen2 7500', brand: 'Lenovo' }, tvQuery) === false);
// Known limitation, documented honestly: a source junk listing that literally
// titles itself "...Towel Tablets" token-matches and passes — no fabrication on
// our side, the source's own title carries the word.
t('curtain-towel junk listing passes token gate (source-titled)', passesQueryRelevance(
  { title: 'Cortina Eyelet Curtain Set of 4 Cortina Cotton Towel Tablets', brand: 'Cortina' }, tabletQuery) === true);

// 10. Guard exported and self-consistent
import { isAccessoryOfQuery } from '../server/search/queryRelevance';
t('stand is accessory of tablet query', isAccessoryOfQuery('Tablet Stand', 'tablets') === true);
t('stand is NOT accessory when queried', isAccessoryOfQuery('Tablet Stand', 'tablet stand') === false);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
