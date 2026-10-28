/**
 * Price plausibility (owner 27 Oct, screenshot): "Apple iPhone 18 Pro" shown at Rs.831 from
 * Zepto beside a Rs.59,900 Flipkart phone, labelled "99% costlier". A single seller priced
 * tens of times below the band every other shop agrees on is a data error, never a deal.
 */
import { dropImplausiblePrices } from '../server/lens/pricePlausibility';

let passed = 0, failed = 0;
const t = (name: string, cond: boolean) => { cond ? passed++ : (failed++, console.error(`FAIL ${name}`)); };

// 1. The screenshot: one impossible cheap row must not become "cheapest"
const shot = dropImplausiblePrices([
  { seller: 'Zepto', price: 831 },
  { seller: 'Flipkart', price: 59900 },
  { seller: 'Croma', price: 70990 },
]);
t('impossible cheap row is withheld', shot.dropped.length === 1 && shot.dropped[0].seller === 'Zepto');
t('real sellers are kept', shot.kept.length === 2 && shot.kept.every((r) => r.price >= 59900));

// 2. Two-row case (exactly what the page rendered)
const two = dropImplausiblePrices([{ seller: 'Zepto', price: 831 }, { seller: 'Flipkart', price: 59900 }]);
t('2 rows: 70x gap withholds the low one', two.kept.length === 1 && two.dropped[0].price === 831);

// 3. Genuine discounts survive
const real = dropImplausiblePrices([
  { price: 44900 }, { price: 59900 }, { price: 70990 }, { price: 89900 },
]);
t('a real 25% discount is not dropped', real.dropped.length === 0 && real.kept.length === 4);
const sale = dropImplausiblePrices([{ price: 31900 }, { price: 59900 }, { price: 62900 }]);
t('a real 47% clearance still survives', sale.dropped.length === 0);

// 4. Grocery-scale spread (cheap items) is untouched
const grocery = dropImplausiblePrices([{ price: 28 }, { price: 30 }, { price: 34 }]);
t('grocery prices are never withheld', grocery.dropped.length === 0);

// 5. Never blank the page
const only = dropImplausiblePrices([{ price: 831 }]);
t('a single row is always kept', only.kept.length === 1 && only.dropped.length === 0);
const zeros = dropImplausiblePrices([{ price: 0 }, { price: 0 }]);
t('priceless rows are not treated as outliers', zeros.dropped.length === 0);

console.log(`pricePlausibility: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
