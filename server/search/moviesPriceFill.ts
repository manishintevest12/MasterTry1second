/**
 * MOVIE PRICE FILL (owner 9 Nov: "bookmyshow, ticketnew website mai price dikha raha hai pr flutter app
 * pr ni usko v fix kr").
 *
 * A movies answer carries the seat band that was actually observed in live sessions (District/TicketNew
 * public sessions gateway): specs['price band'] like "₹250–₹1050" and specs['cheapest show']. BookMyShow
 * itself publishes no fare, so its row for the SAME film had primaryPrice 0 and was then removed by the
 * No-Price-No-Card gate - the film vanished on the app while the site still showed it, because the site
 * rendered the band from the sibling row.
 *
 * This fills a price-less row for a film with the SAME film's already-observed band minimum, and labels
 * it (specs['price basis'] = 'observed_seat_band', unit 'from') so nothing is invented: the number comes
 * from a real observation on another seller's row for the identical title. A film with no observation
 * anywhere stays price-less and is still withheld.
 */
function moneyFrom(text: string): number {
  const m = String(text || '').match(/(?:₹|rs\.?|inr)\s*([0-9][0-9,]{1,7})/i) || String(text || '').match(/\b([0-9]{3,6})\b/);
  if (!m) return 0;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const normTitle = (t: string) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function fillMoviePricesFromBand<T extends Record<string, any>>(rows: T[]): { rows: T[]; filled: number } {
  if (!Array.isArray(rows) || !rows.length) return { rows: rows || [], filled: 0 };
  const best = new Map<string, number>();
  for (const r of rows) {
    const title = normTitle(String(r.title || ''));
    if (!title) continue;
    let price = Number(r.primaryPrice ?? 0);
    if (!(price > 0)) price = moneyFrom(String(r.specs?.['price band'] ?? r.specs?.['price_band'] ?? ''));
    if (!(price > 0)) price = moneyFrom(String(r.specs?.['cheapest show'] ?? r.specs?.['cheapest_show'] ?? ''));
    if (price > 0) best.set(title, Math.min(best.get(title) ?? Infinity, price));
  }
  let filled = 0;
  const out = rows.map((r) => {
    if (Number(r.primaryPrice ?? 0) > 0) return r;
    const title = normTitle(String(r.title || ''));
    const band = best.get(title);
    if (!band || !(band > 0)) return r;
    filled += 1;
    return {
      ...r,
      primaryPrice: band,
      priceAvailable: true,
      unit: 'from',
      specs: {
        ...(r.specs || {}),
        'price basis': 'observed_seat_band',
        'price note': 'Cheapest seat price observed for this film in Indore sessions; this seller publishes no fare',
      },
    } as T;
  });
  return { rows: out, filled };
}
