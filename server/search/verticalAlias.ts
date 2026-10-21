/**
 * UI vertical tab ids vs engine vertical ids (21 Oct crash post-mortem):
 * the UI registry calls the verticals 'movie' and 'account', while the server's
 * engine/worker registry calls them 'movies' and 'banking'. /api/scrape/live
 * always normalized the alias; /api/search passed the raw UI id through, and
 * getVerticalEngine('account') returned undefined -> unhandled TypeError ->
 * the whole Node process died (Flutter account searches 503-crashed production).
 * Both endpoints now normalize through this one shared function.
 */
export function normalizeVerticalId(raw: unknown): string {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'movie') return 'movies';
  if (v === 'account') return 'banking';
  return v;
}
