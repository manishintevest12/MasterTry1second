/**
 * Per-vertical default search seeds + a shape guard (web parity of the app's
 * flutter_app/lib/core/verticals.dart).
 *
 * OWNER 4 Nov (screenshot: Hotels box holding "Rau Tahsil to Bhopal" and the page saying "No
 * matching options found"): "hr vertical pr data user ke search ke phle ek default aaye jiss se koi
 * v vertical khali naa dikhe — hotels ke liye Goa, flight ke liye Indore to New Delhi, bus ke liye
 * Indore to Nagpur". And: a remembered query from ANOTHER vertical's shape must never be searched
 * in this one, because that is a guaranteed empty answer (a route in Hotels, a city in Flights).
 */

export const DEFAULT_QUERY_FOR = (vertical: string, city?: string): string => {
  const target = (city || '').trim() || 'Indore';
  const v = vertical === 'movies' ? 'movie' : vertical;
  switch (v) {
    case 'flights': return `${target} to New Delhi`;
    case 'hotels': return 'Goa';
    case 'bus': return `${target} to Nagpur`;
    case 'cab': return `Rajwada ${target} to Airport ${target}`;
    case 'ecommerce': return 'mobile phone';
    case 'grocery': return 'milk';
    case 'food': return 'biryani';
    case 'movie': return 'movies';
    case 'loans': return 'personal loan';
    case 'insurance': return 'health insurance';
    case 'creditcards': return 'best credit card';
    case 'account': return 'savings account';
    default: return '';
  }
};

/** Route-shaped searches belong to flights/bus/cab only; a city/product belongs to the rest. */
export function queryFitsVertical(vertical: string, query: string): boolean {
  const q = String(query || '').trim();
  if (!q) return false;
  const isRoute = /\bto\b/i.test(q);
  const v = vertical === 'movies' ? 'movie' : vertical;
  if (['flights', 'bus', 'cab'].includes(v)) return isRoute;
  return !isRoute;
}

/** What this vertical should search right now: its own remembered query only if it fits. */
export function seedQueryFor(vertical: string, city: string | undefined, remembered: string): string {
  if (queryFitsVertical(vertical, remembered)) return remembered.trim();
  return DEFAULT_QUERY_FOR(vertical, city);
}
