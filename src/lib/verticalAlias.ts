/**
 * One vertical, one name.
 *
 * OWNER 28 Oct (screenshots: Movies tab badge "28", feed "No matching options found" while the
 * sidebar still said live prices are loading): the prefetch pass asks the engine for `movies`
 * and the tab/feed use `movie`. Rows arrived tagged `movies`, the badge counted them through its
 * own inline alias check, and the feed's `it.vertical === 'movie'` filter matched nothing — so a
 * vertical that HAD 28 live rows rendered the trust-breaking empty page. The same pair is used
 * inconsistently across the card, the source panel and the feed.
 *
 * Both spellings mean the same vertical, so canonicalise every row on ingestion and compare with
 * `sameVertical` everywhere else. Unknown verticals pass through untouched (never guess).
 */
const CANONICAL: Record<string, string> = {
  movies: 'movie',
  movie: 'movie',
};

export function canonicalVertical(value: unknown): string {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return '';
  return CANONICAL[v] || v;
}

/** True when two vertical ids name the same vertical (movie / movies today). */
export function sameVertical(a: unknown, b: unknown): boolean {
  const ca = canonicalVertical(a);
  return ca !== '' && ca === canonicalVertical(b);
}

/** Rewrite the vertical tag of engine rows to its canonical id, leaving everything else intact. */
export function canonicalizeRows<T extends { vertical?: unknown }>(rows: T[]): T[] {
  return rows.map((row) => {
    const canon = canonicalVertical(row?.vertical);
    return canon && canon !== row?.vertical ? ({ ...row, vertical: canon } as T) : row;
  });
}
