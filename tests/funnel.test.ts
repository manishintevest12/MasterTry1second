import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseEvent, scrub, sessionToken, withinBudget, resetFunnelBudget, FUNNEL_EVENTS, funnelReport } from '../server/growth/funnel';

/**
 * OWNER 19 Nov growth brief: "Instrument clear funnel events ... so optimization focuses on real drop-off
 * points and retention rather than vanity metrics."
 *
 * These tests pin the two things that make telemetry safe to ship: only allowlisted events, and no
 * personal data in the table - plus the funnel maths the admin report shows.
 */

test('only allowlisted events are stored', () => {
  for (const e of FUNNEL_EVENTS) {
    assert.ok(normaliseEvent({ event: e, sessionId: 'sess_abcdef' }), e);
  }
  assert.equal(normaliseEvent({ event: 'arbitrary_sql', sessionId: 'sess_abcdef' }), null);
  assert.equal(normaliseEvent({ event: 'search' }), null, 'a session is required to attribute the step');
  assert.equal(normaliseEvent(null), null);
});

test('no personal data reaches the table', () => {
  // an email or a phone typed into a search box is scrubbed before it is stored
  assert.equal(scrub('mail me at ravi.k@example.com about iphone'), 'mail me at [email] about iphone');
  assert.equal(scrub('call 9876543210 for atta'), 'call [number] for atta');
  const row = normaliseEvent({ event: 'search', sessionId: 'sess_abcdef', query: 'atta 10 kg', city: 'Indore', vertical: 'grocery' })!;
  assert.equal(row.query, 'atta 10 kg');
  assert.equal(row.city, 'Indore');
  assert.equal(row.vertical, 'grocery');
  // the request-guard key carries an IP + user agent: it must be hashed, never stored raw
  const token = sessionToken('h:203.0.113.9|Mozilla/5.0 (Linux; Android 14)');
  assert.match(token, /^h_[a-f0-9]{24}$/);
  assert.ok(!token.includes('203.0.113.9'));
  assert.equal(sessionToken('sess_abcdef'), 'sess_abcdef', 'a client token is kept as-is');
});

test('unknown verticals are bucketed, never dropped silently', () => {
  const row = normaliseEvent({ event: 'search', sessionId: 'sess_abcdef', vertical: 'crypto-casino' })!;
  assert.equal(row.vertical, 'other');
});

test('a looping client is cut off by the per-session budget', () => {
  resetFunnelBudget();
  let allowed = 0;
  for (let i = 0; i < 200; i++) if (withinBudget('track:sess_abcdef')) allowed++;
  assert.equal(allowed, 120, '120 events per minute per session, then 429');
  resetFunnelBudget();
});

test('the report computes the funnel rates from rows, not from assumptions', async () => {
  // the report reads through getStore(); with no DB configured the dev file store answers with no rows,
  // and the report must still be well-formed rather than throwing.
  const report = await funnelReport(30);
  assert.equal(report.ok, true);
  assert.equal(report.days, 30);
  assert.ok(Array.isArray(report.byEvent));
  assert.ok(report.conversion.searchToCard >= 0);
  assert.equal(report.zeroResult.rate >= 0 && report.zeroResult.rate <= 100, true);
});

test('the funnel maths: rates come from the rows it read', async () => {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const mk = (event: string, session: string, vertical = 'grocery', day = now) => ({ event, session_id: session, vertical, created_at: day });
  const rows = [
    mk('search', 's1'), mk('search', 's2'), mk('search', 's3'), mk('search', 's4'),
    mk('results_view', 's1'), mk('results_view', 's2'),
    mk('card_click', 's1'),
    mk('outbound_click', 's1'),
    mk('share', 's2'),
    mk('zero_result', 's3'),
    mk('search', 's1', 'flights'),
  ];
  const fake = { query: async <T,>() => rows as T[] };
  const r = await funnelReport(30, 50_000, fake);

  assert.equal(r.totals.searches, 5);
  assert.equal(r.totals.sessions, 4);
  assert.equal(r.totals.cardClicks, 1);
  assert.equal(r.totals.outbound, 1);
  assert.equal(r.conversion.searchToResults, 40, '2 results views of 5 searches');
  assert.equal(r.conversion.searchToCard, 20, '1 card click of 5 searches');
  assert.equal(r.conversion.cardToOutbound, 100, 'the one card click did reach the merchant');
  assert.equal(r.conversion.searchToShare, 20);
  assert.equal(r.zeroResult.empty, 1);
  assert.equal(r.zeroResult.rate, 20, 'one empty search out of five');
  assert.equal(r.repeatSessions.returning, 0, 'all sessions on one day');
  assert.equal(r.byVertical[0].vertical, 'grocery');
});

test('a returning session is counted as returning, and old rows fall outside the window', async () => {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
  const yesterday = new Date(today.getTime() - 24 * 3600_000);
  const longAgo = new Date(today.getTime() - 40 * 24 * 3600_000);
  const rows = [
    { event: 'search', session_id: 's1', vertical: 'movies', created_at: iso(today) },
    { event: 'search', session_id: 's1', vertical: 'movies', created_at: iso(yesterday) },
    { event: 'search', session_id: 's9', vertical: 'movies', created_at: iso(longAgo) },
  ];
  const r = await funnelReport(30, 50_000, { query: async <T,>() => rows as T[] });
  assert.equal(r.totals.searches, 2, 'the 40-day-old row is outside a 30-day window');
  assert.equal(r.repeatSessions.returning, 1);
  assert.equal(r.repeatSessions.rate, 100);
});
