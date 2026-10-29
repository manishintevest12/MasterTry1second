import { isSameProduct } from '../server/lens/sameProduct';
import { isAccessoryOfQuery } from '../server/search/queryRelevance';
const q = 'iphone 16';
const titles = [
  'Apple iPhone 16 (128GB, Teal)',
  'Apple iPhone 16 128 GB, Ultramarine',
  'Apple iPhone 16 (Black, 128 GB)',
  'Apple iPhone 16 Plus (Black, 128 GB)',
  'Apple iPhone 16e (White, 128 GB)',
  'Apple iPhone 17 (Black, 256 GB)',
  'iPhone 16 Silicone Mobile Case with MagSafe, Denim',
  'CHUMBAK Printed Apple iPhone 16 Back Cover',
];
for (const t of titles) {
  const m = isSameProduct(q, t, 'typed');
  const acc = isAccessoryOfQuery(q, t);
  console.log(`${m ? 'KEEP' : 'DROP'} acc=${acc} :: ${t}`);
}
