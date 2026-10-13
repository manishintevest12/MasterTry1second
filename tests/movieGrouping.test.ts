import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupSameProduct, movieKey } from '../server/pipeline/productGrouping';
import { resolveCabQuery } from '../server/verticals/verticalEngine';

const mk = (id: string, title: string, seller: string, price = 0) => ({
  id, vertical: 'movies', title, primaryPrice: price, imageUrl: id === 'b' ? 'https://x/i.jpg' : undefined,
  sellerQuotes: [{ sellerName: seller, price, isLowest: true }],
});

test('same film on several sites -> one card, every site a seller', () => {
  const out = groupSameProduct([
    mk('a', 'Drishyam The Conclusion', 'BookMyShow'),
    mk('b', 'Drishyam: The Conclusion', 'TicketNew'),
    mk('c', 'Drishyam: The Conclusion', 'District by Zomato (Paytm)'),
    mk('d', 'Other Film', 'BookMyShow'),
  ] as any);
  assert.equal(out.length, 2);
  const g = out.find((x: any) => /drishyam/i.test(x.title))!;
  assert.equal(g.sellerQuotes.length, 3);
  assert.ok(g.imageUrl, 'image taken from a member that has one');
});

test('cheapest ticket price becomes the headline when prices exist', () => {
  const out = groupSameProduct([mk('a', 'Jawan', 'BookMyShow', 250), mk('b', 'Jawan', 'TicketNew', 180)] as any);
  assert.equal(out.length, 1);
  assert.equal(out[0].sellerQuotes[0].sellerName, 'TicketNew');
  assert.equal(out[0].primaryPrice, 180);
});

test('movieKey ignores punctuation, articles and language tags', () => {
  assert.equal(movieKey('Drishyam: The Conclusion (Hindi)'), movieKey('Drishyam The Conclusion'));
});

test('cab: bare location resolves to a real route; routes untouched', () => {
  assert.equal(resolveCabQuery('vijay nagar indore'), 'Indore to Bhopal');
  assert.equal(resolveCabQuery('cab in Indore airport'), 'Indore to Bhopal');
  assert.equal(resolveCabQuery('delhi to agra'), 'delhi to agra');
  assert.equal(resolveCabQuery('somewhere unknown', ''), 'somewhere unknown');
});
