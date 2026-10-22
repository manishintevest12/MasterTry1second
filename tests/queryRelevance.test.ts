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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
