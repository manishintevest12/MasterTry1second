/**
 * Feed pagination rule for the WEB (mirror of the app's core/feed_page.dart).
 *
 * OWNER 20 Nov: "abhi 4 card ke baad hi load more aa raha hai, 12 card ke baad aana chaiye."
 *
 * The web revealed 4 results and then +4 forever, because the constant was written for the old
 * one-card-per-row list. The grocery vertical is now a GRID, so a full screen of products is 12 tiles — and the
 * app has always opened product feeds at 12 (+8 per tap). One rule, both platforms:
 *
 *   - tall-card feeds (movies: poster + theatre + showtimes) reveal 4 at a time, web and app;
 *   - everything else, grocery included, opens with 12 and adds 8.
 *
 * The pill only appears when the feed really holds more than is on screen, so it can never be a dead button.
 */

/** Feeds whose cards are tall enough that a phone screen holds about four. */
export const TALL_CARD_VERTICALS = new Set(['movies', 'movie']);

/** Cards painted before the first "Load More" tap. */
export function initialFor(vertical: string): number {
  return TALL_CARD_VERTICALS.has(String(vertical || '').toLowerCase()) ? 4 : 12;
}

/** Cards a "Load More" tap adds. */
export function stepFor(vertical: string): number {
  return TALL_CARD_VERTICALS.has(String(vertical || '').toLowerCase()) ? 4 : 8;
}

/** The pill appears only when more rows exist than are shown. */
export function showLoadMore(visible: number, total: number): boolean {
  return total > 0 && total > Math.max(0, visible);
}
