/**
 * QuickRide outstation cab parser — cab vertical.
 *
 * https://quickride.in/outstation-taxi.php carries a static HTML table of
 * popular route fares: From | To | FARE (One Way) | FARE (Round Trip).
 * Seller is Quick Ride (a direct cab operator, price-owning website).
 * If the queried route is not in the table, nothing is fabricated — the
 * per-km rate matrix is surfaced only for rate-style queries.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export function parseQuickRideCabs(html: string, source: SourceConfig, pageUrl: string, from: string, to: string): RawSourceItem[] {
  const items: RawSourceItem[] = [];
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  const norm = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const fare = (s: string) => {
    const m = /([\d,]{3,7})/.exec(norm(s).replace(/[₹]/g, ''));
    return m ? Number(m[1].replace(/,/g, '')) : null;
  };
  const today = new Date().toISOString().slice(0, 10);
  for (const row of rows) {
    const cells = row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/g) || [];
    if (cells.length < 4) continue;
    const rf = norm(cells[0] || '').toLowerCase();
    const rt = norm(cells[1] || '').toLowerCase();
    const f = norm(from || '').toLowerCase();
    const t = norm(to || '').toLowerCase();
    const routeMatch = f && t && (rf.includes(f) || f.includes(rf)) && (rt.includes(t) || t.includes(rt));
    if (!routeMatch) continue;
    const oneWay = fare(cells[2] || '');
    const roundTrip = fare(cells[3] || '');
    if (oneWay && oneWay > 0) {
      items.push(newRawItem(source, {
        title: `${norm(cells[0] || '')} to ${norm(cells[1] || '')} cab (one-way)`,
        brand: 'Quick Ride',
        price: Math.round(oneWay),
        currency: 'INR',
        seller: 'Quick Ride',
        sellerUrl: pageUrl,
        travel: { route: `${from} to ${to}`.toLowerCase(), seatType: 'unknown' },
        attributes: {
          pickup: from,
          drop: to,
          route: `${norm(cells[0] || '')} to ${norm(cells[1] || '')}`,
          vehicle_type: 'cab (outstation)',
          trip_type: 'one-way',
          round_trip_fare: roundTrip ? String(roundTrip) : '',
          price_basis: `route fare as published on quickride.in on ${today}`,
          image: '',
          data_note: `Route fare scraped from quickride.in outstation fare table on ${today}`,
        },
        identifiers: { sku: `quickride-${rf}-${rt}-ow`.replace(/\s+/g, '-') },
        evidence: { sourceUrl: pageUrl, extractedFields: ['fare table row'] },
      }));
    }
  }
  return items;
}
