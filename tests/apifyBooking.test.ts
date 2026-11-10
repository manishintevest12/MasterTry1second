/**
 * OWNER 10 Nov: "stayapi, apify actors jaise kaam kr rahe hai same principal lga kr price lao aur uss pr
 * evergreen cj deeplink kro". These pin the two things that matter: an actor row only becomes a card when it
 * carries a REAL positive price and an http(s) URL (No Price, No Card), and the source names the exact env
 * vars it needs instead of silently returning nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { apifyBookingRows, apifyMeetsConfigured, apifyMissingEnv, bookingActorInput, coercePrice } from '../server/workers/parsers/apifySource';

test('actor rows without a positive price never become cards', () => {
  const rows = apifyBookingRows([
    { name: 'Taj Exotica', price: 18500, url: 'https://www.booking.com/hotel/in/taj-exotica.html' },
    { name: 'No price hotel', url: 'https://www.booking.com/hotel/in/x.html' },
    { name: 'Zero price', price: 0, url: 'https://www.booking.com/hotel/in/y.html' },
    { name: 'Negative', price: -5, url: 'https://www.booking.com/hotel/in/z.html' },
    { name: 'No url', price: 4000 },
    { name: 'Bad url', price: 4000, url: 'javascript:alert(1)' },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Taj Exotica');
  assert.equal(rows[0].price, 18500);
});

test('price strings from actors are read, duplicates collapse', () => {
  const rows = apifyBookingRows([
    { hotelName: 'A', pricePerNight: 'Rs 4,299', bookingUrl: 'https://www.booking.com/hotel/in/a.html' },
    { hotelName: 'A again', minPrice: '₹4,299.00', bookingUrl: 'https://www.booking.com/hotel/in/a.html' },
    { title: 'B', lowestPrice: '1 999', url: 'https://www.booking.com/hotel/in/b.html' },
  ]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.price).sort((x, y) => x - y), [1999, 4299]);
});

test('coercePrice refuses anything unprovable', () => {
  assert.equal(coercePrice('N/A'), 0);
  assert.equal(coercePrice(''), 0);
  assert.equal(coercePrice(undefined), 0);
  assert.equal(coercePrice('0'), 0);
  assert.equal(coercePrice(2500), 2500);
});

test('source is idle until both env values exist, and says which', () => {
  const saved = { t: process.env.APIFY_TOKEN, a: process.env.APIFY_BOOKING_ACTOR };
  delete process.env.APIFY_TOKEN;
  delete process.env.APIFY_BOOKING_ACTOR;
  assert.equal(apifyMeetsConfigured(), false);
  assert.deepEqual(apifyMissingEnv(), ['APIFY_TOKEN', 'APIFY_BOOKING_ACTOR']);
  process.env.APIFY_TOKEN = 'tok';
  assert.deepEqual(apifyMissingEnv(), ['APIFY_BOOKING_ACTOR']);
  process.env.APIFY_BOOKING_ACTOR = 'someone/booking-scraper';
  assert.equal(apifyMeetsConfigured(), true);
  process.env.APIFY_TOKEN = saved.t;
  process.env.APIFY_BOOKING_ACTOR = saved.a;
});

test('actor input carries the city, dates and INR', () => {
  const input = bookingActorInput({ destination: 'Goa', checkin: '2026-11-20', checkout: '2026-11-23' });
  assert.equal(input.location, 'Goa');
  assert.equal(input.checkIn, '2026-11-20');
  assert.equal(input.checkOut, '2026-11-23');
  assert.equal(input.currency, 'INR');
  assert.equal(input.adults, 2);
});

test('the hotels source is registered and keeps the CJ exit in front of it', () => {
  const src = readFileSync('server/workers/verticals/hotels.ts', 'utf8');
  assert.ok(src.includes("sourceId: 'w_hotels_booking_apify'"), 'apify source registered');
  const aff = readFileSync('server/affiliate/deeplink.ts', 'utf8');
  assert.ok(aff.includes("'booking.com': 'https://www.dpbolvw.net/click-101903513-17293139?url={DESTINATION}'"), 'booking.com still exits through the CJ evergreen link');
});
