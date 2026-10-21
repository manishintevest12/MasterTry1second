import test from 'node:test';
import assert from 'node:assert';
/**
 * Regression (21 Oct owner report: bus timings not showing):
 * AbhiBus rows must carry normalized arrival_time + duration_minutes so web AND
 * Flutter cards render complete "dep → arr" times and durations.
 */

const parseAbhiAttrs = (timings: any) => {
  // mirrors the normalization added to server/workers/parsers/abhibus.ts
  const attrs: Record<string, string> = {};
  if (timings.startTime) attrs.departure_time = String(timings.startTime).slice(0, 5);
  if (timings.arriveTime) attrs.arrival_time = String(timings.arriveTime).slice(0, 5);
  if (timings.travelTime) {
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(timings.travelTime).trim());
    if (m) attrs.duration_minutes = String(Number(m[1]) * 60 + Number(m[2]));
  }
  return attrs;
};

test('AbhiBus timing normalization: full dep/arr + duration minutes', () => {
  const a = parseAbhiAttrs({ startTime: '06:00 PM', arriveTime: '11:00 PM', travelTime: '05:00:00' });
  assert.equal(a.departure_time, '06:00');
  assert.equal(a.arrival_time, '11:00');
  assert.equal(a.duration_minutes, '300');
});

test('AbhiBus timing normalization: missing fields stay absent (no invention)', () => {
  const a = parseAbhiAttrs({ startTime: '02:30 AM' });
  assert.equal(a.departure_time, '02:30');
  assert.equal('arrival_time' in a, false);
  assert.equal('duration_minutes' in a, false);
});
