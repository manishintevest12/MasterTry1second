import test from 'node:test';
import assert from 'node:assert/strict';
import { isQuotaError, nextQuotaReset, parsePsiResponse } from '../server/admin/speedtest';

// Owner 27 Oct: the Performance widget must not break when PageSpeed's free daily quota
// runs out — the run is recognised as a quota hit, not a site failure.
const realGoogleQuotaBody = {
  error: {
    code: 429,
    message: "Quota exceeded for quota metric 'Queries' and limit 'Queries per day' of service 'pagespeedonline.googleapis.com' for consumer 'project_number:583797351490'.",
    status: 'RESOURCE_EXHAUSTED',
  },
};

test('the exact Google daily-quota body is detected as a quota hit', () => {
  assert.equal(isQuotaError(realGoogleQuotaBody, 429), true);
  assert.equal(isQuotaError(realGoogleQuotaBody, 200), true);
});

test('reason codes and plain HTTP 429 are detected too', () => {
  assert.equal(isQuotaError({ error: { errors: [{ reason: 'dailyLimitExceeded' }] } }), true);
  assert.equal(isQuotaError({ error: { details: [{ reason: 'RATE_LIMIT_EXCEEDED' }] } }), true);
  assert.equal(isQuotaError({}, 429), true);
});

test('a real site failure is NOT misread as a quota problem', () => {
  assert.equal(isQuotaError({ error: { message: 'Lighthouse returned error: FAILED_DOCUMENT_REQUEST' } }), false);
  assert.equal(isQuotaError(null, 500), false);
  assert.equal(isQuotaError({}, 200), false);
});

test('reset time is the next UTC midnight', () => {
  const now = Date.UTC(2026, 9, 27, 6, 30, 0);
  assert.equal(nextQuotaReset(now), '2026-10-28T00:00:00.000Z');
});

test('a quota body never yields a bogus zero score', () => {
  const parsed = parsePsiResponse(realGoogleQuotaBody, 'mobile');
  assert.equal(parsed.score, null);
  assert.match(String(parsed.error), /Quota exceeded/i);
});

test('a normal Lighthouse response still parses to a score', () => {
  const parsed = parsePsiResponse({
    lighthouseResult: {
      finalDisplayedUrl: 'https://www.try1second.com/',
      categories: { performance: { score: 0.96 } },
      audits: {
        'largest-contentful-paint': { numericValue: 1450 },
        'total-blocking-time': { numericValue: 120 },
        'cumulative-layout-shift': { numericValue: 0.012 },
      },
    },
  }, 'desktop');
  assert.equal(parsed.score, 96);
  assert.equal(parsed.lcp_ms, 1450);
  assert.equal(parsed.cls, 0.012);
  assert.equal(parsed.error, null);
});
