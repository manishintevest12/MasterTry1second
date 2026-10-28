/**
 * Product identity: KIND gate (owner 27 Oct, "iphone search ne adapter dikhaya").
 *
 * The reported bug: searching "iphone" showed an "Ambrane 20000mAh 35W Fast Powerbank |
 * Type-C | iPhone - Android Mobiles" at Rs.199 as THE product, then compared it against a
 * real "Apple iPhone 12" at Rs.59,900 and called it "100% costlier". Two holes let that
 * happen:
 *   1. the brand word only appeared as a COMPATIBILITY mention ("... | iPhone - Android
 *      Mobiles | ..."), which was read as identity;
 *   2. nothing checked that an accessory and a phone are different KINDS of product.
 * These tests pin the gate: different kind => never the same product, while bundles
 * ("... with Charger"), groceries, type-only searches and strict variant rules stay intact.
 */
import { isSameProduct, sharesIdentity, declaredTypes, stripCompatibility, primarySegment } from '../server/lens/sameProduct';

let passed = 0, failed = 0;
const t = (name: string, cond: boolean) => { cond ? passed++ : (failed++, console.error(`FAIL ${name}`)); };

const POWERBANK = 'Ambrane 20000mAh 35W Fast Powerbank | Compact | Type-C | iPhone - Android Mobiles | Black';
const IPHONE12 = 'Apple iPhone 12 (Black, 128 GB)';

// 1. The exact rows from the owner's screenshots
t('power bank is not the iPhone it is compatible with',
  isSameProduct('iphone', POWERBANK, 'typed') === false);
t('the real iPhone is still the iPhone',
  isSameProduct('iphone', IPHONE12, 'typed') === true);
t('closest-variant fallback never promotes an adapter for a phone search',
  sharesIdentity('iphone', POWERBANK) === false);

// 2. Other kinds of accessory must not answer a phone search either
t('back cover is not the phone', isSameProduct('iphone', 'Spigen Back Cover for iPhone 15 (Black)', 'typed') === false);
t('charging adapter is not the phone', isSameProduct('iphone', 'Apple 20W USB-C Power Adapter', 'typed') === false);
t('earbuds are not the phone', isSameProduct('iphone', 'boAt Airdopes 141 TWS Earbuds for iPhone', 'typed') === false);

// 3. Asking for the accessory itself still works
t('a charger query matches a charger listing',
  isSameProduct('iphone charger', 'Apple 20W USB-C Power Adapter for iPhone', 'typed') === true);
t('a power bank query matches a power bank',
  isSameProduct('power bank', 'Ambrane 20000mAh Fast Powerbank | Type-C', 'typed') === true);
t('a case query matches a case',
  isSameProduct('iphone 15 case', 'Silicone Back Cover for iPhone 15', 'typed') === true);

// 4. Bundles in the listing title must not disqualify the real product
t('bundled charger does not disqualify the phone',
  isSameProduct('samsung galaxy m35', 'Samsung Galaxy M35 5G (Thunder Grey, 6GB, 128GB Storage) with Charger', 'typed') === true);
t('bundled adapter does not disqualify the phone',
  isSameProduct('iphone 15', 'Apple iPhone 15 (Blue, 128 GB) with 20W Adapter', 'typed') === true);

// 5. Compatibility text carries no identity
t('compatibility segments are stripped',
  stripCompatibility(POWERBANK).includes('iPhone') === false);
t('model numbers survive the strip',
  stripCompatibility('Power Bank | iPhone 12 | Black').includes('iPhone 12') === true);
t('primary segment stops at the first bundle marker',
  primarySegment('Samsung Galaxy M35 5G (Grey) with Charger').includes('Charger') === false);
t('power bank is detected as its own kind',
  declaredTypes(POWERBANK).has('powerbank') === true);
t('a phone declares no accessory kind',
  declaredTypes(IPHONE12).size === 0);

// 6. Type-only searches (no brand) still resolve
t('tv query matches a TV listing',
  isSameProduct('tv', 'Samsung 138 cm (55 inch) 4K Ultra HD Smart LED TV', 'typed') === true);
t('laptop query matches a MacBook',
  isSameProduct('laptop', 'Apple MacBook Air M2 (8GB, 256GB SSD)', 'typed') === true);

// 7. Grocery and strict-variant rules unchanged
t('grocery pack still matches', isSameProduct('amul butter 500 g', 'Amul Butter 500 g', 'typed') === true);
t('grocery pouch still matches', isSameProduct('tata salt 1 kg', 'Tata Salt, 1 kg Pouch', 'typed') === true);
t('iphone 16 never matches 17', isSameProduct('iphone 16', 'Apple iPhone 17 128 GB', 'typed') === false);
t('256 GB never matches 512 GB', isSameProduct('iphone 16 256gb', 'Apple iPhone 16 512 GB', 'typed') === false);

console.log(`productIdentityTypeGate: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

// 8. Owner's SECOND report (27 Oct, screenshot): a cover whose title is pipe-suffixed with a
//    real phone name was still accepted, because the accessory check only read the segment
//    before the first "|": "Apple iPhone 18 Pro 5G | 512 GB | Burgundy | Mobile Cover" at
//    Rs.831 became "the iPhone" and made a Rs.59,900 Flipkart phone look "99% costlier".
import { accessoryScope, isAccessory } from '../server/lens/sameProduct';
const PIPE_COVER = 'Apple iPhone 18 Pro 5G | 512 GB | Burgundy | Mobile Cover';
t('pipe-suffixed mobile cover is rejected', isSameProduct('iphone 18 pro', PIPE_COVER, 'typed') === false);
t('pipe-suffixed cover is an accessory', isAccessory(PIPE_COVER) === true);
t('bundle clause is cut, pipe segments are not',
  accessoryScope('Samsung Galaxy M35 5G (Grey) with Charger').includes('Charger') === false
  && accessoryScope(PIPE_COVER).includes('Mobile Cover') === true);
t('the plain phone title itself still matches',
  isSameProduct('iphone 18 pro', 'Apple iPhone 18 Pro 5G | 512 GB | Burgundy', 'typed') === true);
t('tempered glass guarded by a brand name is rejected',
  isSameProduct('iphone 18 pro', 'Pokryt iPhone 18 Pro/17/17 Pro/16 Pro Tempered Glass (Transparent)', 'typed') === false);
t('magSafe cover with a brand name is rejected',
  isSameProduct('iphone 18 pro', 'Ohonesty Iphone 17 Pro/18 Pro MagSafe Mobile Cover (Transparent)', 'typed') === false);
t('skin sticker is rejected', isSameProduct('iphone 15', 'GADGETSWRAP Printed Vinyl Skin Sticker for iPhone 15', 'typed') === false);
t('lightning cable is rejected', isSameProduct('iphone 15', 'APFEN iPhone Fast Charging Type C to Lightning Cable (27 W)', 'typed') === false);

if (failed) { console.error(`type gate: ${failed} failed`); process.exit(1); }
console.log(`type gate total: ${passed} passed`);
