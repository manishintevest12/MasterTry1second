import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// OWNER 9 Nov: "loan, credit card, insurance, account mai filters, compare apr, yaa quicks picks yaa view
// quotes kaam ni kr rha". Two separate defects: buttons that only typed into the box (no search), and a
// credit-card pick filter that matched nothing.
import { pickTargets } from '../server/workers/verticals/creditcards';

const links = [
  { u: 'https://cardinsider.com/hdfc-bank/hdfc-millennia-credit-card/' },
  { u: 'https://cardinsider.com/hdfc-bank/hdfc-infinia-credit-card/' },
  { u: 'https://cardinsider.com/axis-bank/axis-atlas-credit-card/' },
  { u: 'https://cardinsider.com/sbi-card/sbi-simply-save-card/' },
];

test('a bank quick pick still narrows to that bank', () => {
  const got = pickTargets(links, ['hdfc']);
  assert.equal(got.length, 2);
  assert.ok(got.every((l) => l.u.includes('hdfc-bank')));
});

test('a descriptive quick pick never crawls nothing', () => {
  // tokens produced from "Premium Metal Cards (Atlas, Infinia)"
  const got = pickTargets(links, ['premium', 'metal', 'atlas', 'infinia']);
  assert.ok(got.length > 0, 'the pick must widen instead of returning zero cards');
  assert.ok(got.some((l) => l.u.includes('atlas')) || got.length === links.length);
});

test('no token at all keeps the whole universe', () => {
  assert.equal(pickTargets(links, []).length, links.length);
});

// The buttons must run a live search, not just type into the search box.
test('Compare APR, View Quotes and the AI filter pills all start a search', () => {
  const src = fs.readFileSync('src/components/SearchAndFilterHeader.tsx', 'utf8');
  const apr = src.slice(src.indexOf('Compare APR') - 900, src.indexOf('Compare APR'));
  assert.match(apr, /triggerLiveLocationScrape\(q\)/, 'Compare APR fires a search');
  const vq = src.slice(src.indexOf('View Quotes') - 700, src.indexOf('View Quotes'));
  assert.match(vq, /triggerLiveLocationScrape\(q\)/, 'View Quotes fires a search');
  const pill = src.slice(src.indexOf('applySmartFilter(queryPrompt)'), src.indexOf('applySmartFilter(queryPrompt)') + 700);
  assert.match(pill, /triggerLiveLocationScrape\(financeBaseQuery\(\)\)/, 'an AI filter pill fetches on the finance verticals');
});
