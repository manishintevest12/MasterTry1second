import test from 'node:test';
import assert from 'node:assert/strict';

// Owner 21 Oct: the Account section's bank search bar sends queries like
// "sbi savings account" / "hdfc demat account". Those are provider lookups:
// only the named bank/broker's rows may return. Regression guards for the
// PROVIDER_QUERY_PATTERNS branch in filterByQueryEntity (server/verticals/verticalEngine.ts).
const OFFERS = [
  { id: 'a1', vertical: 'banking', title: 'State Bank of India Savings Account', vendor: 'BankBazaar', attributes: { product_type: 'savings account' }, prices: { effectivePrice: 2.7 } },
  { id: 'a2', vertical: 'banking', title: 'HDFC Bank Savings Account', vendor: 'BankBazaar', attributes: { product_type: 'savings account' }, prices: { effectivePrice: 3.0 } },
  { id: 'a3', vertical: 'banking', title: 'SBI Savings Account', vendor: 'Paisabazaar', attributes: { product_type: 'savings account' }, prices: { effectivePrice: 2.5 } },
  { id: 'a4', vertical: 'banking', title: 'Zerodha Demat Account', vendor: 'Zerodha', attributes: { product_type: 'demat account' }, prices: {} },
];

async function run(query: string, intent = 'browse') {
  const { getVerticalEngine } = await import('../server/verticals/verticalEngine');
  const engine = getVerticalEngine('banking');
  return engine.execute(OFFERS as any, { entityName: query, intent } as any);
}

test('bank search bar: "sbi savings account" returns ONLY SBI rows (not every bank)', async () => {
  // Before the provider filter, the browse shortcut (>2 tokens on a non-comparison
  // vertical) returned ALL banks for this query.
  const out = await run('sbi savings account');
  assert.equal(out.length, 2, 'both SBI rows survive, HDFC/Zerodha rows must be dropped');
  assert.ok((out as any[]).every((o) => /sbi|state bank of india/i.test(`${o.title} ${o.vendor || ''}`)));
});

test('bank search bar: plain "savings account" still browses every bank (default feed unchanged)', async () => {
  const out = await run('savings account');
  assert.equal(out.length, OFFERS.length, 'no provider named -> no provider restriction');
});

test('bank search bar: "hdfc demat account" keeps only HDFC rows', async () => {
  const out = await run('hdfc demat account');
  assert.equal(out.length, 1);
  assert.match((out as any[])[0].title, /hdfc/i);
});

test('bank search bar: full provider name "state bank of india savings" matches SBI rows', async () => {
  const out = await run('state bank of india savings');
  assert.equal(out.length, 2, 'typed full bank name matches the same rows as the "sbi" short code');
});

test('bank search bar: broker name "zerodha demat account" keeps only Zerodha rows', async () => {
  const out = await run('zerodha demat account');
  assert.equal(out.length, 1);
  assert.match((out as any[])[0].title, /zerodha/i);
});

test('bank search bar: UNRECOGNIZED provider-like words stay a browse feed (no accidental wipe)', async () => {
  // "xyz small finance bank" is not in PROVIDER_QUERY_PATTERNS, so the engine cannot
  // know it names a bank: it must NOT restrict (and must NOT empty) the feed. Only
  // RECOGNIZED providers restrict; a bogus provider falls back to the browse list.
  const out = await run('xyz small finance bank savings account');
  assert.equal(out.length, OFFERS.length, 'unrecognized name -> unchanged browse feed, no silent wipe');
});
