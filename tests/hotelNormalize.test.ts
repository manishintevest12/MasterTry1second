import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHotelName, hotelSimilarity, sameHotel, haversineDistanceMeters } from '../src/utils/hotelNormalize';
import {
  normalizeHotelName as serverNormalizeHotelName,
  sameHotel as serverSameHotel
} from '../server/common/hotelNormalize';

// --------------------------------------------------------------------------
// 1. normalizeHotelName unit tests
// --------------------------------------------------------------------------

test('1. normalizeHotelName: lowercases and strips unicode accents', () => {
  assert.equal(normalizeHotelName('Café Royal', 'Mumbai'), 'cafe royal');
});

test('2. normalizeHotelName: strips punctuation and star ratings', () => {
  assert.equal(normalizeHotelName('5 Star Hotel St. Regis', 'Mumbai'), 'st regis');
  assert.equal(normalizeHotelName('4* Marriott Hotel', 'Delhi'), 'marriott');
});

test('3. normalizeHotelName: drops city/area suffixes after comma / dash / pipe', () => {
  assert.equal(normalizeHotelName('Trident, Bandra Kurla, Mumbai', 'Mumbai'), 'trident bandra kurla');
  assert.equal(normalizeHotelName('Ginger Hotel - Airport, Mumbai', 'Mumbai'), 'ginger');
});

test('4. normalizeHotelName: removes stopwords (hotel, resort & spa, suites, inn, pvt ltd, etc.)', () => {
  assert.equal(normalizeHotelName('The Lalit Resort & Spa', 'Goa'), 'lalit');
  assert.equal(normalizeHotelName('Grand Hyatt Suites', 'Mumbai'), 'hyatt');
  assert.equal(normalizeHotelName('Treebo Inn Pvt Ltd', 'Bengaluru'), 'treebo');
});

test('5. normalizeHotelName: expands abbreviations (rd->road, intl->international, apt->airport)', () => {
  const norm = normalizeHotelName('Ginger Rd Intl Apt', 'Mumbai');
  assert.equal(norm, 'ginger road');
});

test('6. normalizeHotelName: unifies & and and', () => {
  assert.equal(normalizeHotelName('Bed & Breakfast', 'Delhi'), 'bed breakfast');
});

test('7. normalizeHotelName: handles brand prefixes (Treebo Trend, OYO, FabHotel, Radisson Blu)', () => {
  assert.equal(normalizeHotelName('Treebo Trend Grand Vistara', 'Bengaluru'), 'treebo vistara');
  assert.equal(normalizeHotelName('OYO Flagship 1234 Hotel Green', 'Delhi'), 'oyo green');
  assert.equal(normalizeHotelName('FabHotel 567 City Center', 'Mumbai'), 'fabhotel');
  assert.equal(normalizeHotelName('Radisson Blu Resort & Spa', 'Goa'), 'radisson blu');
});

test('8. normalizeHotelName: transliteration variants match (Lalit vs The Lalit Grand Palace Srinagar)', () => {
  const norm1 = normalizeHotelName('Lalit', 'Srinagar');
  const norm2 = normalizeHotelName('The Lalit Grand Palace Srinagar', 'Srinagar');
  assert.equal(norm1, 'lalit');
  assert.equal(norm2, 'lalit');
  assert.equal(norm1, norm2);
});

// --------------------------------------------------------------------------
// 2. hotelSimilarity unit tests
// --------------------------------------------------------------------------

test('9. hotelSimilarity: returns 1.0 for identical normalized names', () => {
  assert.equal(hotelSimilarity('The Lalit Mumbai', 'The Lalit Mumbai', 'Mumbai', 'Mumbai'), 1.0);
});

test('10. hotelSimilarity: returns high similarity score for close variants', () => {
  const sim = hotelSimilarity('Ginger Mumbai Airport', 'Ginger Mumbai International Airport', 'Mumbai', 'Mumbai');
  assert.equal(sim, 1.0);
});

test('11. hotelSimilarity: returns 0.0 for completely different hotel names', () => {
  const sim = hotelSimilarity('The Taj Mahal Palace', 'Ginger Hotel', 'Mumbai', 'Mumbai');
  assert.equal(sim, 0.0);
});

// --------------------------------------------------------------------------
// 3. sameHotel unit tests & false-positive guards
// --------------------------------------------------------------------------

test('12. sameHotel: merges same hotel across different booking sites', () => {
  const h1 = { name: 'The LaLiT Mumbai', city: 'Mumbai', site: 'agoda' };
  const h2 = { name: 'The Lalit Mumbai', city: 'Mumbai', site: 'booking' };
  assert.equal(sameHotel(h1, h2), true);
});

test('13. sameHotel: GUARD - two listings from the exact same site NEVER merge', () => {
  const h1 = { name: 'Hotel Sea Princess', city: 'Mumbai', site: 'agoda' };
  const h2 = { name: 'Hotel Sea Princess Juhu', city: 'Mumbai', site: 'agoda' };
  assert.equal(sameHotel(h1, h2), false);
});

test('14. sameHotel: GUARD - different cities NEVER merge', () => {
  const h1 = { name: 'Ginger Hotel', city: 'Mumbai', site: 'agoda' };
  const h2 = { name: 'Ginger Hotel', city: 'Pune', site: 'booking' };
  assert.equal(sameHotel(h1, h2), false);
});

test('15. sameHotel: GUARD - lat/lng distance > 600m returns false', () => {
  const h1 = { name: 'Taj Hotel', city: 'Mumbai', lat: 18.9217, lng: 72.8332, site: 'agoda' };
  const h2 = { name: 'Taj Hotel', city: 'Mumbai', lat: 19.0596, lng: 72.8295, site: 'booking' }; // ~15km away
  assert.equal(sameHotel(h1, h2), false);
});

test('16. sameHotel: lat/lng distance <= 600m merges', () => {
  const h1 = { name: 'Taj Mahal Palace', city: 'Mumbai', lat: 18.92170, lng: 72.83320, site: 'agoda' };
  const h2 = { name: 'Taj Mahal Palace', city: 'Mumbai', lat: 18.92180, lng: 72.83325, site: 'booking' }; // ~15m away
  assert.equal(sameHotel(h1, h2), true);
});

test('17. sameHotel: GUARD - differing locality tokens in same city prevent false merges', () => {
  const h1 = { name: 'Trident, Bandra Kurla, Mumbai', city: 'Mumbai', site: 'agoda' };
  const h2 = { name: 'Trident, Nariman Point, Mumbai', city: 'Mumbai', site: 'booking' };
  assert.equal(sameHotel(h1, h2), false);
});

test('18. sameHotel: GUARD - Ginger Andheri vs Ginger Goregaon in same city do not merge', () => {
  const h1 = { name: 'Ginger Mumbai, Andheri (MIDC)', city: 'Mumbai', site: 'ixigo' };
  const h2 = { name: 'Ginger Mumbai, Goregaon', city: 'Mumbai', site: 'cleartrip' };
  assert.equal(sameHotel(h1, h2), false);
});

test('19. sameHotel: subset match merges hotel with wing/building extension', () => {
  const h1 = { name: 'JW Marriott Sahar', city: 'Mumbai', site: 'agoda' };
  const h2 = { name: 'JW Marriott Sahar Hotel & Apartments', city: 'Mumbai', site: 'booking' };
  assert.equal(sameHotel(h1, h2), true);
});

test('20. sameHotel: GUARD - bare brand does not absorb different locality branch', () => {
  const h1 = { name: 'Trident', city: 'Mumbai', site: 'agoda' };
  const h2 = { name: 'Trident Nariman Point', city: 'Mumbai', site: 'booking' };
  assert.equal(sameHotel(h1, h2), false);
});

test('21. sameHotel: Taj Mahal vs Taj Mahal Tower in same location', () => {
  const h1 = { name: 'The Taj Mahal Palace', city: 'Mumbai', site: 'agoda' };
  const h2 = { name: 'Taj Mahal Tower Mumbai', city: 'Mumbai', site: 'booking' };
  assert.equal(sameHotel(h1, h2), true);
});

test('22. sameHotel: Oberoi New Delhi vs Oberoi Mumbai rejected by city', () => {
  const h1 = { name: 'The Oberoi', city: 'New Delhi', site: 'agoda' };
  const h2 = { name: 'The Oberoi', city: 'Mumbai', site: 'booking' };
  assert.equal(sameHotel(h1, h2), false);
});

test('23. haversineDistanceMeters correctly calculates distance', () => {
  const dist = haversineDistanceMeters(18.9217, 72.8332, 18.9220, 72.8347);
  assert.ok(dist > 100 && dist < 300);
});

// --------------------------------------------------------------------------
// Extended false positive and edge case tests
// --------------------------------------------------------------------------

test('24. sameHotel: GUARD - Lalit Mumbai vs Lalit Delhi must NOT merge', () => {
  const h1 = { name: 'Lalit Mumbai', city: 'Mumbai', site: 'agoda' };
  const h2 = { name: 'Lalit Delhi', city: 'Delhi', site: 'booking' };
  assert.equal(sameHotel(h1, h2), false);
});

test('25. sameHotel: GUARD - Radisson Blu Kaushambi Delhi NCR vs Radisson Blu Hotel New Delhi Paschim VIHAR must NOT merge', () => {
  const h1 = { name: 'Radisson Blu Kaushambi Delhi NCR', city: 'Delhi', site: 'agoda' };
  const h2 = { name: 'Radisson Blu Hotel New Delhi Paschim VIHAR', city: 'Delhi', site: 'booking' };
  assert.equal(sameHotel(h1, h2), false);
});

test('26. sameHotel: The Lalit Grand Palace Srinagar vs Lalit Grand Palace Hotel Srinagar MUST merge', () => {
  const h1 = { name: 'The Lalit Grand Palace Srinagar', city: 'Srinagar', site: 'agoda' };
  const h2 = { name: 'Lalit Grand Palace Hotel Srinagar', city: 'Srinagar', site: 'booking' };
  assert.equal(sameHotel(h1, h2), true);
});

test('27. sameHotel: Treebo Trend properties with same suffix merge only when full distinctive tokens match', () => {
  // Matching property name
  const h1 = { name: 'Treebo Trend Grand Vistara', city: 'Bengaluru', site: 'agoda' };
  const h2 = { name: 'Treebo Trend Vistara', city: 'Bengaluru', site: 'booking' };
  assert.equal(sameHotel(h1, h2), true);

  // Different properties under same Treebo brand must NOT merge
  const h3 = { name: 'Treebo Trend Grand Plaza', city: 'Bengaluru', site: 'agoda' };
  assert.equal(sameHotel(h1, h3), false);
});

test('28. sameHotel: GUARD - FabHotel Premier vs FabHotel Royal in same city do NOT merge', () => {
  const h1 = { name: 'FabHotel Premier', city: 'Delhi', site: 'agoda' };
  const h2 = { name: 'FabHotel Royal', city: 'Delhi', site: 'booking' };
  assert.equal(sameHotel(h1, h2), false);
});

test('29. sameHotel: Parentheses in title strip city correctly (The Lalit Grand Palace (Srinagar))', () => {
  const h1 = { name: 'The Lalit Grand Palace (Srinagar)', city: 'Srinagar', site: 'agoda' };
  const h2 = { name: 'Lalit Grand Palace Srinagar', city: 'Srinagar', site: 'booking' };
  assert.equal(sameHotel(h1, h2), true);
});

test('30. sameHotel: GUARD - JW Marriott Juhu vs JW Marriott Sahar do NOT merge', () => {
  const h1 = { name: 'JW Marriott Juhu', city: 'Mumbai', site: 'agoda' };
  const h2 = { name: 'JW Marriott Sahar', city: 'Mumbai', site: 'booking' };
  assert.equal(sameHotel(h1, h2), false);
});

test('31. sameHotel: GUARD - Bare brand Treebo vs Treebo Trend Vistara does NOT merge', () => {
  const h1 = { name: 'Treebo', city: 'Bengaluru', site: 'agoda' };
  const h2 = { name: 'Treebo Trend Vistara', city: 'Bengaluru', site: 'booking' };
  assert.equal(sameHotel(h1, h2), false);
});

test('32. server-side mirror gives identical normalization result across all test cases', () => {
  const clientRes1 = normalizeHotelName('The Lalit Grand Palace Srinagar', 'Srinagar');
  const serverRes1 = serverNormalizeHotelName('The Lalit Grand Palace Srinagar', 'Srinagar');
  assert.equal(clientRes1, serverRes1);

  const clientRes2 = normalizeHotelName('Radisson Blu Kaushambi Delhi NCR', 'Delhi');
  const serverRes2 = serverNormalizeHotelName('Radisson Blu Kaushambi Delhi NCR', 'Delhi');
  assert.equal(clientRes2, serverRes2);
});

test('33. server-side mirror sameHotel behaves identically across test cases', () => {
  const h1 = { name: 'Radisson Blu Kaushambi Delhi NCR', city: 'Delhi', site: 'agoda' };
  const h2 = { name: 'Radisson Blu Hotel New Delhi Paschim VIHAR', city: 'Delhi', site: 'booking' };
  assert.equal(serverSameHotel(h1, h2), false);

  const h3 = { name: 'The Lalit Grand Palace Srinagar', city: 'Srinagar', site: 'agoda' };
  const h4 = { name: 'Lalit Grand Palace Hotel Srinagar', city: 'Srinagar', site: 'booking' };
  assert.equal(serverSameHotel(h3, h4), true);
});
