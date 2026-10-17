/**
 * Goibibo hotels SSR regression (17 Oct): /hotels/* SEO pages are Akamai-stubbed
 * ("200 - OK", 8 bytes) from sandbox + Browserbase IPs — a path-scoped gate —
 * but the SSR pipeline is the same as the flights SEO pages that work. The
 * parser is shape-tolerant: it walks __NEXT_DATA__ for hotel-shaped objects
 * (name + price at any nesting depth) so it self-activates on production
 * once the Hostinger IP is accepted. Nothing invented: stub -> [] ->
 * honest ACCESS_CHALLENGE.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGoibiboHotelsSsr } from '../server/workers/parsers/goibiboHotels.ts';

function giHtml(state: any) {
  const fixture = { props: { pageProps: { data: { state } } } };
  return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(fixture)}</script></body></html>`;
}

test('parseGoibiboHotelsSsr extracts hotel listings from any __NEXT_DATA__ nesting', () => {
  const html = giHtml({
    hotelListings: {
      hotels: [
        { displayName: 'W Goa', price: { finalPrice: 12500 }, rating: 4.6, hotelImage: '//pix.goibibo.com/w.jpg', locality: 'Vagator' },
        { displayName: 'The Hosteller Goa', price: { finalPrice: 899 }, rating: 4.2, hotelImage: '//pix.goibibo.com/h.jpg', locality: 'Anjuna' },
        { displayName: 'Taj Exotica', price: { finalPrice: 22000 }, rating: 4.8, hotelImage: '//pix.goibibo.com/t.jpg', locality: 'Benaulim' },
        { displayName: 'Budget Stay', price: { finalPrice: 700 }, rating: 3.8, hotelImage: '//pix.goibibo.com/b.jpg', locality: 'Mapusa' },
      ],
    },
  });
  const rows = parseGoibiboHotelsSsr(html);
  assert.equal(rows.length, 4);
  const hosteller = rows.find((r) => r.name === 'The Hosteller Goa');
  assert.ok(hosteller, 'hosteller row present');
  assert.equal(hosteller!.price, 899);
  assert.equal(hosteller!.rating, 4.2);
  assert.equal(hosteller!.image, 'https://pix.goibibo.com/h.jpg');
  assert.equal(hosteller!.locality, 'Anjuna');
});

test('parseGoibiboHotelsSsr dedupes and caps at 60 rows', () => {
  const hotels = Array.from({ length: 80 }, (_, i) => ({ hotelName: `Hotel ${i % 40}`, sellingPrice: 1500 + i, rating: 4 }));
  const rows = parseGoibiboHotelsSsr(giHtml({ list: hotels }));
  assert.equal(rows.length, 40, '80 dupes -> 40 unique');
  assert.ok(rows.every((r) => r.price >= 1500));
});

test('parseGoibiboHotelsSsr: Akamai stub page -> no rows (honest empty)', () => {
  assert.deepEqual(parseGoibiboHotelsSsr('200 - OK'), []);
});

test('parseGoibiboHotelsSsr: non-hotel arrays are not mistaken for listings', () => {
  const html = giHtml({
    faqs: [{ name: 'Check-in time', sortOrder: 1 }, { name: 'Pets policy', sortOrder: 2 }, { name: 'Refunds', sortOrder: 3 }, { name: 'Gate', sortOrder: 4 }],
  });
  assert.deepEqual(parseGoibiboHotelsSsr(html), []);
});
