/**
 * Voice's acquisition client (owner 29 Oct).
 *
 * Why over loopback instead of importing runSearch again: the web feed's answer is not just
 * `runSearch` - it is `runSearch` PLUS the last-chance fast pass, the last-verified-row fallback and
 * the relevance ranking, all of which live in POST /api/scrape/live. Voice answering from a different
 * pipeline is exactly how a listener ends up hearing "no price" while the site shows one.
 *
 * So voice calls the product's own public search endpoint on the loopback interface: one acquisition
 * path, two clients (web + Alexa), no duplicated healing logic, and anything that fixes the web feed
 * fixes voice too.
 */
import { settings } from '../common/settings';
import type { SearchInput, SearchResponse } from '../search/searchOrchestrator';

const LOOPBACK = process.env.ALEXA_LOOPBACK_URL || `http://127.0.0.1:${settings.port}`;

export async function liveSearchForVoice(input: SearchInput, timeoutMs = 6_000): Promise<SearchResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(500, timeoutMs));
  try {
    const res = await fetch(`${LOOPBACK}/api/scrape/live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-t1s-voice': '1' },
      body: JSON.stringify({
        query: input.query,
        vertical: input.vertical,
        city: input.city,
        pincode: input.pincode,
        from: input.from,
        to: input.to,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`search endpoint answered ${res.status}`);
    return (await res.json()) as SearchResponse;
  } finally {
    clearTimeout(timer);
  }
}
