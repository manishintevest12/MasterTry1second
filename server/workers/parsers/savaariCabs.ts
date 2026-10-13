/**
 * Savaari cab parser — cab vertical.
 *
 * Savaari's SEO route pages (https://www.savaari.com/{from}/{from}-to-{to}-cabs)
 * embed FAQPage JSON-LD whose answer text carries the real one-way fares, e.g.
 * "starts from Rs 2236 for one-way cab service" and
 * "varies from Rs 2236 (for 4 seater sedan) to Rs 3250 (for 12 seater ...)".
 * Seller is Savaari (a direct cab operator, price-owning website).
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export function savaariRouteSlug(city: string): string {
  return city.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-');
}

export function parseSavaariCabs(html: string, source: SourceConfig, pageUrl: string, from: string, to: string): RawSourceItem[] {
  const items: RawSourceItem[] = [];
  const seenFares: Array<{ fare: number; label: string }> = [];
  const re = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let data: any;
    try { data = JSON.parse(m[1]); } catch { continue; }
    const blocks = Array.isArray(data) ? data : [data];
    for (const b of blocks) {
      const qa = b?.mainEntity;
      if (!Array.isArray(qa)) continue;
      for (const q of qa) {
        const text = String(q?.acceptedAnswer?.text || '');
        // "varies from Rs 2236 (for 4 seater sedan) to Rs 3250 (for 12 seater luxury tempo traveller)"
        const vary = /from\s+Rs\.?\s*([\d,]+)\s*\(([^)]*)\)\s*to\s+Rs\.?\s*([\d,]+)\s*\(([^)]*)\)/i.exec(text);
        if (vary) {
          seenFares.push({ fare: Number(vary[1].replace(/,/g, '')), label: vary[2].replace(/\bfor\b/gi, '').trim() || 'base vehicle' });
          seenFares.push({ fare: Number(vary[3].replace(/,/g, '')), label: vary[4].replace(/\bfor\b/gi, '').trim() || 'top vehicle' });
          continue;
        }
        // "starts from Rs 2236 for one-way cab service"
        const starts = /starts\s+from\s+Rs\.?\s*([\d,]+)\s*(?:for\s+([^.,]+))?/i.exec(text);
        if (starts) seenFares.push({ fare: Number(starts[1].replace(/,/g, '')), label: (starts[2] || 'one-way cab service').trim() });
        // bare "Rs 2236" mentions as last resort
        if (!vary && !starts) {
          const bare = /Rs\.?\s*([\d,]{4,6})/.exec(text);
          if (bare) seenFares.push({ fare: Number(bare[1].replace(/,/g, '')), label: 'one-way cab service' });
        }
      }
    }
  }
  if (!seenFares.length) return [];
  const today = new Date().toISOString().slice(0, 10);
  const lo = Math.min(...seenFares.map((f) => f.fare));
  const hi = Math.max(...seenFares.map((f) => f.fare));
  const loLabel = seenFares.find((f) => f.fare === lo)?.label || 'one-way';
  const hiLabel = seenFares.find((f) => f.fare === hi)?.label || 'one-way';
  for (const { fare, label } of seenFares.slice(0, 6)) {
    items.push(newRawItem(source, {
      title: `${from} to ${to} cab (${label}, one-way)`,
      brand: 'Savaari',
      price: Math.round(fare),
      currency: 'INR',
      seller: 'Savaari',
      sellerUrl: pageUrl, // the price-owning website itself
      travel: { route: `${from} to ${to}`.toLowerCase(), seatType: 'unknown' },
      attributes: {
        pickup: from,
        drop: to,
        route: `${from} to ${to}`,
        vehicle_type: `cab (${label})`,
        vehicle_class: label,
        trip_type: 'one-way',
        fare_range: `Rs ${lo} (base) - Rs ${hi}`,
        price_basis: `route fare as published by savaari.com on ${today}`,
        image: '',
        data_note: `Route fare scraped from savaari.com route page on ${today}`,
      },
      identifiers: { sku: `savaari-${from}-${to}-${label}`.toLowerCase().replace(/\s+/g, '-') },
      evidence: { sourceUrl: pageUrl, extractedFields: ['FAQPage ld+json fare text'] },
    }));
  }
  return items;
}
