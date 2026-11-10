/**
 * OWNER 10 Nov: "flight and cab mai booking.com ka source bnao".
 * Booking.com serves our egress a bot wall (measured: flights 202/0 bytes, taxi 405 "Human Verification"),
 * so these sources are registered as monitored probes that self-heal, never as fake parsers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bookingGate, bookingGateMessage, BOOKING_PROBE } from '../server/workers/parsers/bookingProbe';

test('the bot wall is classified as an access challenge, not as an empty result', () => {
  assert.equal(bookingGate(202, ''), 'access_challenge');
  assert.equal(bookingGate(405, '<title>Human Verification</title>'), 'access_challenge');
  assert.equal(bookingGate(429, 'slow down'), 'access_challenge');
  assert.equal(bookingGate(200, '<title>Human Verification</title>'), 'access_challenge');
  assert.equal(bookingGate(200, 'x'.repeat(40)), 'empty');
  assert.equal(bookingGate(200, '<html>' + 'fare '.repeat(400) + '</html>'), 'ok');
});

test('the message names the surface and the self-healing behaviour', () => {
  const m = bookingGateMessage('flights', 202, 'access_challenge');
  assert.match(m, /flights\.booking\.com/);
  assert.match(m, /proxy rotation and backoff/i);
  assert.match(bookingGateMessage('taxi', 405, 'access_challenge'), /taxi\.booking\.com/);
});

test('probe targets are the two real surfaces', () => {
  assert.equal(BOOKING_PROBE.flights, 'https://flights.booking.com/');
  assert.match(BOOKING_PROBE.taxi, /booking\.com\/taxi/);
});

test('both verticals register the Booking.com source and never fabricate a price', () => {
  const flights = readFileSync(new URL('../server/workers/verticals/flights.ts', import.meta.url), 'utf8');
  const cab = readFileSync(new URL('../server/workers/verticals/cab.ts', import.meta.url), 'utf8');
  assert.ok(flights.includes("sourceId: 'w_flights_booking'"), 'flights source registered');
  assert.ok(cab.includes("sourceId: 'w_cab_booking_taxi'"), 'cab source registered');
  for (const src of [flights, cab]) {
    const block = src.slice(src.indexOf('w_flights_booking') >= 0 ? src.indexOf('w_flights_booking') : src.indexOf('w_cab_booking_taxi'));
    const body = block.slice(0, block.indexOf('sourceId:', 20));
    assert.ok(!/price:\s*\d/.test(body), 'no hardcoded price');
    assert.ok(body.includes('AcquisitionError'), 'a wall is an error for the health ladder, not a silent []');
  }
});
