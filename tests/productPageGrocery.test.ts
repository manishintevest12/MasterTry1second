/**
 * Product page: 10-minute grocery comparison + typed-query normalisation (owner 27 Oct).
 *
 * The owner asked for grocery products to compare "just like ecommerce", inside a second.
 * Three regressions are pinned here:
 *  1. Quantity spelling ("1 l" / "1 ltr" / "1 kg pouch") blocked every Blinkit/Zepto row.
 *  2. Pack sizes were hard model tokens, so a shop that omits the weight lost the match.
 *  3. Loose queries ("i phone 18", "buy one plus 12 online") never reached sources cleanly.
 * Electronics strictness (iPhone 16 vs 17, 256 vs 512 GB) must stay intact.
 */
import { isSameProduct, identityTokens, isAccessory } from '../server/lens/sameProduct';
import { normalizeTypedProductQuery } from '../server/lens/productLink';

let passed = 0, failed = 0;
const t = (name: string, cond: boolean) => { cond ? passed++ : (failed++, console.error(`FAIL ${name}`)); };

// 1. Same pack, different unit spelling -> one product
t('milk 1 l matches Blinkit 1 ltr',
  isSameProduct('amul taaza toned milk 1 l', 'Amul Taaza Homogenised Toned Milk (1 ltr)', 'typed') === true);
t('butter 500 g matches 500 g',
  isSameProduct('amul butter 500 g', 'Amul Butter 500 g', 'typed') === true);
t('12 pack matches "Pack of 12"',
  isSameProduct('maggi 2 minute noodles 12 pack', 'Maggi 2-Minute Masala Noodles, Pack of 12 (12 x 70 g)', 'typed') === true);

// 2. Pouch/packet is grocery packaging, not an accessory
t('weighing pouch is not an accessory', isAccessory('Tata Salt, 1 kg Pouch') === false);
t('salt 1 kg matches 1 kg pouch',
  isSameProduct('tata salt 1 kg', 'Tata Salt, 1 kg Pouch', 'typed') === true);
t('phone case is still an accessory', isAccessory('Silicone Back Case Cover for iPhone 16') === true);

// 3. Pack size stays a token (for ranking) but is no longer a veto
t('1 l tokenises as 1l', identityTokens('amul taaza toned milk 1 l').includes('1l'));
t('salt with omitted weight still matches',
  isSameProduct('tata salt 1 kg', 'Tata Salt Crystal', 'typed') === true);

// 4. Electronics strictness untouched
t('iphone 16 never matches 17', isSameProduct('iphone 16', 'Apple iPhone 17 128 GB', 'typed') === false);
t('256 GB never matches 512 GB', isSameProduct('iphone 16 256gb', 'Apple iPhone 16 512 GB', 'typed') === false);
t('iphone 16 matches its own listing', isSameProduct('iphone 16', 'Apple iPhone 16 (Black, 128 GB)', 'typed') === true);

// 5. Typed queries reach the sources in a usable form
t('glued brand repaired', normalizeTypedProductQuery('i phone 18').includes('iphone 18'));
t('filler stripped from one plus', normalizeTypedProductQuery('buy one plus 12 online') === 'oneplus 12');
t('price-of filler stripped', normalizeTypedProductQuery('price of tata salt 1 kg').includes('tata salt'));

console.log(`productPageGrocery: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
