/**
 * Price plausibility: one shop's mis-parsed price must never become the "cheapest".
 *
 * Owner 27 Oct (second report, screenshot): the product page showed "Apple iPhone 18 Pro 5G |
 * 512 GB | Burgundy" at Rs.831 from Zepto next to a Flipkart iPhone at Rs.59,900, labelled
 * "99% costlier". Whatever the cause — an accessory row with a phone-like title, or a price
 * scraped from a "you may also like" tile on the same page — a single seller priced ~70x below
 * everyone else is a data error, not a deal, and publishing it is worse than showing nothing.
 *
 * The rule is deliberately dumb and conservative: a row is withheld only when it is a tiny
 * fraction of the band every other row agrees on. Real deals (a 30-60% discount) survive.
 */

export type Priced = { price: number };

export function dropImplausiblePrices<T extends Priced>(rows: T[]): { kept: T[]; dropped: T[] } {
  const priced = rows.filter((r) => Number.isFinite(r.price) && r.price > 0);
  if (priced.length < 2) return { kept: rows, dropped: [] };
  const prices = priced.map((r) => r.price).sort((a, b) => a - b);
  const min = prices[0];
  const max = prices[prices.length - 1];
  if (max <= 0 || min / max >= 0.25) return { kept: rows, dropped: [] };
  // With three or more shops the MEDIAN is the band; with only two rows the higher price is
  // the only evidence we have, so the cutoff has to be stricter before we call it an error.
  const median = prices[Math.floor(prices.length / 2)];
  const cutoff = prices.length >= 3 ? median * 0.35 : max * 0.2;
  const kept: T[] = [];
  const dropped: T[] = [];
  for (const r of rows) {
    const isPriced = Number.isFinite(r.price) && r.price > 0;
    if (isPriced && r.price < cutoff) dropped.push(r);
    else kept.push(r);
  }
  // Never empty the page: if the "outlier" is all we have, it stays (and the UI keeps polling).
  if (!kept.some((r) => r.price > 0)) return { kept: rows, dropped: [] };
  return { kept, dropped };
}
