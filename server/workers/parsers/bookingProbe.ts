/**
 * Booking.com probe (owner 10 Nov: "flight and cab mai booking.com ka source bnao").
 *
 * MEASURED from our production egress before writing this, so the source tells the truth instead of
 * inventing fares:
 *   https://www.booking.com/flights/index.en-gb.html   -> HTTP 202, 0 bytes  (bot wall, no HTML)
 *   https://flights.booking.com/                       -> HTTP 202, 8.8 KB shell, zero price tokens
 *   https://www.booking.com/taxi/index.en-gb.html       -> HTTP 202, 0 bytes
 *   https://taxi.booking.com/                           -> HTTP 405, title "Human Verification"
 * So Booking.com cannot be a working price source today for either vertical: there is no HTML or JSON a
 * parser could read. This module therefore does the two things that ARE possible:
 *   1. classify the wall precisely (ACCESS_CHALLENGE vs EMPTY_RESPONSE) so the rotational proxy pool and
 *      adaptive backoff keep retrying it - the source self-heals the day Booking.com answers;
 *   2. never emit a row without a real price (owner's No Price, No Card rule).
 * The CJ affiliate exit for Booking.com is already live in server/affiliate/deeplink.ts, so any row that
 * ever appears here is monetised automatically, in flights and cabs exactly like hotels.
 */

export type BookingGate = 'access_challenge' | 'empty' | 'ok';

/** Classifies a Booking.com response. Anything with no body or a verification title is a wall. */
export function bookingGate(status: number, body: string): BookingGate {
  const text = String(body || '');
  if (status === 202 || status === 403 || status === 405 || status === 429) return 'access_challenge';
  if (/human verification|are you a robot|captcha|access denied|unusual traffic/i.test(text.slice(0, 4000))) return 'access_challenge';
  if (text.trim().length < 500) return 'empty';
  return 'ok';
}

/** Explains the wall in one line, for the source-health log and the admin dashboard. */
export function bookingGateMessage(vertical: 'flights' | 'taxi', status: number, gate: BookingGate): string {
  const surface = vertical === 'flights' ? 'flights.booking.com' : 'taxi.booking.com';
  if (gate === 'access_challenge') {
    return `Booking.com ${surface} answers HTTP ${status} with a bot-verification wall (no HTML/JSON to parse). `
      + 'Registered as a monitored source: proxy rotation and backoff will retry it automatically.';
  }
  if (gate === 'empty') {
    return `Booking.com ${surface} returned an empty shell (HTTP ${status}); no fare data served to this egress.`;
  }
  return `Booking.com ${surface} answered HTTP ${status}`;
}

/** Probe targets, kept in one place so the health view and the workers cannot drift apart. */
export const BOOKING_PROBE = {
  flights: 'https://flights.booking.com/',
  taxi: 'https://www.booking.com/taxi/index.en-gb.html',
} as const;
