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

/**
 * Rewrite the vertical tag of engine rows to its canonical id, leaving everything else intact.
 *
 * OWNER 30 Oct (blank white /hotels page): "Uncaught TypeError: Cannot read properties of
 * undefined (reading 'map')" inside ComparisonFeed's flatMap. The price sidebar collects seller
 * names with `items.flatMap(it => it.sellerQuotes.map(...))`, and a single engine row that
 * arrives without sellerQuotes (presence / "still scanning" rows, and cached rows written by an
 * older build) threw during render, which unmounts the whole React tree and leaves the page
 * blank. This is the one place every live row passes through, so the shape is guaranteed here
 * instead of guarding a dozen consumers: sellerQuotes is always an array and null rows are
 * dropped. Nothing is invented - a row with no quotes simply carries an empty list.
 */
export function canonicalizeRows<T extends { vertical?: unknown; sellerQuotes?: unknown }>(rows: T[]): T[] {
  return (Array.isArray(rows) ? rows : []).filter(Boolean).map((row) => {
    const canon = canonicalVertical((row as any)?.vertical);
    const raw = (row as any)?.sellerQuotes;
    const needsVertical = Boolean(canon) && canon !== (row as any)?.vertical;
    if (!needsVertical && Array.isArray(raw)) return row;
    return {
      ...(row as any),
      ...(needsVertical ? { vertical: canon } : {}),
      sellerQuotes: Array.isArray(raw) ? raw.filter(Boolean) : [],
    } as T;
  });
}
