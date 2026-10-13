/**
 * Bharat Taxi parser — cab vertical.
 *
 * BharatTaxi's SEO route pages (https://www.bharattaxi.com/{from}/to/{to}) embed
 * SSR HTML fare tables. The FIRST table carries flat one-way route fares per
 * vehicle ("Maruti Swift Dzire" -> "₹1810" for Delhi→Agra); subsequent tables are
 * per-km outstation/local packages ("/Km" suffix) and are ignored here.
 * Seller is Bharat Taxi (a direct cab operator, price-owning website).
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

// BharatTaxi URL slugs use legacy spellings (bangalore, mysore, calcutta, madras).
const BTX_ALIASES: Record<string, string> = {
  bengaluru: 'bangalore', mysuru: 'mysore', kolkata: 'kolkata', chennai: 'chennai',
  gurugram: 'gurgaon', prayagraj: 'allahabad', puducherry: 'pondicherry',
};
export function bharatTaxiSlug(city: string): string {
  const s = city.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-');
  return BTX_ALIASES[s] || s;
}

export function parseBharatTaxiCabs(html: string, source: SourceConfig, pageUrl: string, from: string, to: string): RawSourceItem[] {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  const flat: Array<{ car: string; fare: number }> = [];
  for (const tb of tables) {
    const rows = tb.match(/<tr>\s*<td>[\s\S]*?<\/td>\s*<td>[\s\S]*?<\/td>\s*<\/tr>/g) || [];
    const parsed: Array<{ car: string; price: string }> = [];
    for (const row of rows) {
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) ?? [];
      if (cells.length < 2) continue;
      const clean = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
      parsed.push({ car: clean(cells[0] ?? ''), price: clean(cells[1] ?? '') });
    }
    // Flat one-way table: every cell a bare rupee amount, none a per-km package.
    const isFlat = parsed.length > 0
      && parsed.every((p) => /^[₹rs\.]*\s?[\d,]{3,6}$/i.test(p.price))
      && parsed.every((p) => !/km/i.test(p.price));
    if (isFlat) {
      for (const p of parsed) flat.push({ car: p.car, fare: Number(p.price.replace(/[₹rs\.,\s]/gi, '')) });
      break; // only the first flat table (the route fare sheet)
    }
  }
  const seen = flat.filter((f) => f.fare > 0 && f.car).slice(0, 8);
  if (!seen.length) return [];
  const today = new Date().toISOString().slice(0, 10);
  const lo = Math.min(...seen.map((f) => f.fare));
  const hi = Math.max(...seen.map((f) => f.fare));
  return seen.map((f) => newRawItem(source, {
    title: `${from} to ${to} cab (${f.car}, one-way)`,
    brand: 'Bharat Taxi',
    price: Math.round(f.fare),
    currency: 'INR',
    seller: 'Bharat Taxi',
    sellerUrl: pageUrl, // the price-owning website itself
    travel: { route: `${from} to ${to}`.toLowerCase(), seatType: 'unknown' },
    attributes: {
      pickup: from,
      drop: to,
      route: `${from} to ${to}`,
      vehicle_type: f.car,
      trip_type: 'one-way',
      fare_range: `Rs ${lo} (base) - Rs ${hi}`,
      price_basis: `one-way route fare as published by bharattaxi.com on ${today}`,
      data_note: `Route fare scraped from bharattaxi.com route page on ${today}`,
    },
    identifiers: { sku: `bharattaxi-${from}-${to}-${f.car}`.toLowerCase().replace(/\s+/g, '-') },
    evidence: { sourceUrl: pageUrl, extractedFields: ['SSR HTML fare table (flat one-way)'] },
  }));
}
