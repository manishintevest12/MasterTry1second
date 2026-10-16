import { test } from 'node:test';
import assert from 'node:assert/strict';
import { olaCardFare, olaPickCards, type OlaRateCard } from '../server/workers/verticals/cab';

// Fixture: real shapes from Ola's live BPD rate-card DB (Delhi, Oct 2026).
const autoCard: OlaRateCard = {
  category: 'auto', description: 'delhi', base_fare: 30, inclusive_km: 0,
  rate_per_km: 14.5, min_fare: 70.75, threshold_1: 4, threshold_2: 9,
  rate_after_threshold_1: 11, rate_after_threshold_2: 10.7,
  created_at: '2024-01-16 10:30:00', time_of_day: null,
};
const primeAl: OlaRateCard = {
  category: 'prime_plus', description: 'AL', base_fare: 51.89,
  rate_per_km: 5.82, rate_per_trip_minute: 0.57, min_fare: 121,
  threshold_1: 12, threshold_2: null, rate_after_threshold_1: 7.17, rate_after_threshold_2: null,
  created_at: '2026-10-15 08:06:23', time_of_day: 'AL',
};
const primeWl: OlaRateCard = {
  category: 'prime_plus', description: 'WL', base_fare: 38.88,
  rate_per_km: 4.4, rate_per_trip_minute: 0.43, min_fare: 110,
  created_at: '2026-10-03 08:58:00', time_of_day: 'WL',
};
const passMicro: OlaRateCard = {
  category: 'micro', description: 'PASS_25KM', base_fare: 249, inclusive_km: 25,
  rate_per_km: 14, threshold_1: 30, threshold_2: 35,
  rate_after_threshold_1: 16, rate_after_threshold_2: 50,
  created_at: '2020-05-03 18:46:07', time_of_day: null,
};

test('olaCardFare: slab pricing (auto 0-4 @14.5, 4-9 @11, >9 @10.7)', () => {
  // 2km: 30 + 2*14.5 = 59 -> min fare 70.75 -> 71
  assert.equal(olaCardFare(autoCard, 2, 0), 71);
  // 6.5km: 30 + 4*14.5 + 2.5*11 = 115.5 -> 116 (round)
  assert.equal(olaCardFare(autoCard, 6.5, 0), 116);
  // 25km: 30 + 58 + 55 + 16*10.7 = 314.2 -> 314
  assert.equal(olaCardFare(autoCard, 25, 0), 314);
});

test('olaCardFare: single threshold + per-minute rate (prime AL)', () => {
  // 10km, 30min: 51.89 + 10*5.82 + 30*0.57 = 127.29 -> floor min 121 -> 127
  assert.equal(olaCardFare(primeAl, 10, 30), 127);
  // 1km: 51.89 + 5.82 + ~ = below min 121 -> 121
  assert.equal(olaCardFare(primeAl, 1, 5), 121);
});

test('olaCardFare: inclusive km card charges nothing inside the bundle', () => {
  // 5km with 25km inclusive: base 249 only
  assert.equal(olaCardFare(passMicro, 5, 0), 249);
  // 27km: 249 + 2*14 = 277
  assert.equal(olaCardFare(passMicro, 27, 0), 277);
});

test('olaPickCards: all-day (AL) beats non-AL; one card per category; micro (pass product) excluded', () => {
  const picked = olaPickCards([autoCard, primeAl, primeWl, passMicro]);
  assert.equal(picked.prime_plus, primeAl);
  assert.equal(picked.auto, autoCard);
  assert.equal(picked.micro, undefined);
});
