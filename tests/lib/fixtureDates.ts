/**
 * Evergreen date fixtures for the fare-calendar parsers.
 *
 * The Air India / SpiceJet fixtures were recorded LIVE on 24 Oct 2026 with a calendar
 * starting 28 Oct 2026. Those parsers deliberately refuse past dates (`f.dt >= today`),
 * so a test that hardcodes the recorded dates starts failing the day after they pass -
 * which is exactly what happened on 29 Oct 2026. The fixture is still a real capture, so
 * instead of editing the recorded data we shift its dates forward by whole days until its
 * base day is today. Shapes, prices, flight numbers and field names stay untouched; only
 * the calendar dates move, so the assertion (exact date wins, honest fallback label,
 * metadata merge) keeps testing what it was written to test, forever.
 */

/** ISO (YYYY-MM-DD) for today + offsetDays, UTC. */
export const dayOffset = (offsetDays = 0): string =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

/** Whole days from `baseIso` to today (positive when the base date is in the past). */
export const daysSince = (baseIso: string): number =>
  Math.round((Date.parse(dayOffset(0)) - Date.parse(baseIso)) / 86_400_000);

/**
 * Rewrite every ISO date inside a JSON string by `deltaDays`, so a fixture captured on
 * day X reads as if it were captured today. Timestamps keep their time-of-day part.
 */
export const shiftDates = (raw: string, deltaDays: number, fromYear = 2026): string => {
  if (!deltaDays) return raw;
  // No trailing \b: a date glued to a time ("2026-10-28T19:20:00") has no word boundary
  // between the day and the "T", and that timestamp must shift too.
  const re = new RegExp(`${fromYear}-\\d\\d-\\d\\d`, 'g');
  return raw.replace(re, (iso) => {
    const d = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return iso;
    d.setUTCDate(d.getUTCDate() + deltaDays);
    return d.toISOString().slice(0, 10);
  });
};

/** Earliest YYYY-MM-DD found anywhere in a fixture JSON string. */
export const earliestDate = (raw: string): string | null => {
  const found = raw.match(/\b20\d\d-\d\d-\d\d\b/g);
  if (!found) return null;
  return found.sort()[0];
};
