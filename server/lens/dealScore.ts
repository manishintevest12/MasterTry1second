/**
 * Deal score from REAL recorded prices only (price_history + the live cross-site prices).
 * With fewer than 2 history points we say "not enough history" and return no score: never invented.
 */
export interface HistPoint { price: number; capturedAt: string | number | Date }

export interface DealAnalysis {
  hasHistory: boolean;
  points: number;
  current: number;
  allTimeLow: number | null;
  allTimeHigh: number | null;
  average: number | null;
  vsAveragePct: number | null;      // negative = cheaper than average
  score: number | null;             // 0..100
  verdict: 'great' | 'good' | 'fair' | 'wait' | 'unknown';
  headline: string;
  breakup: Array<{ label: string; pts: number; max: number }>;
}

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

export function analyseDeal(current: number, history: HistPoint[], crossSiteLow?: number | null): DealAnalysis {
  const prices = history.map((h) => Math.round(Number(h.price))).filter((p) => Number.isFinite(p) && p > 0);
  if (!(current > 0) || prices.length < 2) {
    return {
      hasHistory: false, points: prices.length, current, allTimeLow: prices.length ? Math.min(...prices) : null,
      allTimeHigh: prices.length ? Math.max(...prices) : null, average: null, vsAveragePct: null,
      score: null, verdict: 'unknown',
      headline: 'Not enough recorded price history yet to score this deal. We never guess.',
      breakup: [],
    };
  }
  const low = Math.min(...prices, current);
  const high = Math.max(...prices, current);
  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const vsAvg = ((current - avg) / avg) * 100;

  // 1) closeness to all-time low (max 40): at the low = 40, at/above the high = 0
  const range = Math.max(1, high - low);
  const lowPts = Math.round(clamp(1 - (current - low) / range, 0, 1) * 40);
  // 2) versus average (max 35): 15% under avg or better = 35
  const avgPts = Math.round(clamp((-vsAvg + 0) / 15, 0, 1) * 35);
  // 3) versus other sites right now (max 25): cheapest live = 25
  let sitePts = 12;
  if (crossSiteLow && crossSiteLow > 0) sitePts = Math.round(clamp(1 - (current - crossSiteLow) / crossSiteLow / 0.1, 0, 1) * 25);
  const score = clamp(lowPts + avgPts + sitePts, 0, 100);

  const verdict: DealAnalysis['verdict'] = score >= 75 ? 'great' : score >= 55 ? 'good' : score >= 35 ? 'fair' : 'wait';
  const headline =
    verdict === 'great' ? 'Lower than the average price. Good time to buy!'
    : verdict === 'good' ? 'A fair-to-good price compared with its history.'
    : verdict === 'fair' ? 'Around its usual price. You may find it cheaper later.'
    : 'Higher than usual. Consider waiting or setting a price alert.';
  return {
    hasHistory: true, points: prices.length, current, allTimeLow: low, allTimeHigh: high, average: avg,
    vsAveragePct: Math.round(vsAvg * 10) / 10, score, verdict, headline,
    breakup: [
      { label: 'Closeness to all-time low', pts: lowPts, max: 40 },
      { label: 'Versus average price', pts: avgPts, max: 35 },
      { label: 'Versus other sites right now', pts: sitePts, max: 25 },
    ],
  };
}
