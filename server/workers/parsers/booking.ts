/**
 * Booking.com search-results parser. Verified live: the plain search URL returns
 * SSR HTML with [data-testid="property-card"] cards carrying the property name,
 * nightly price (USD by default from our region), review score and property link.
 * Only fields actually present are returned; currency is reported truthfully.
 */
import { createHash } from 'crypto';
import * as cheerio from 'cheerio';
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export function parseInr2(text: string | undefined): { value?: number; currency: string } {
  if (!text) return { currency: 'USD' };
  const m = text.replace(/\s/g, '').match(/(₹|\$|€|£)?([\d,]+(?:\.\d+)?)/);
  if (!m) return { currency: 'USD' };
  const n = Number(m[2].replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return { currency: 'USD' };
  const cur = m[1] === '₹' ? 'INR' : m[1] === '€' ? 'EUR' : m[1] === '£' ? 'GBP' : 'USD';
  return { value: n, currency: cur };
}

export function parseBookingHotels(html: string, source: SourceConfig, searchUrl: string, checkin: string, checkout: string): RawSourceItem[] {
  const $ = cheerio.load(html);
  const fingerprint = createHash('sha256').update(html.slice(0, 50000)).digest('hex');
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  $('[data-testid="property-card"]').each((_, el) => {
    const card = $(el);
    const name = card.find('[data-testid="title"]').first().text().trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    const priceEl = card.find('[data-testid="price-and-discounted-price"]').first().text()
      || card.find('[data-testid="price"]').first().text();
    const { value: price, currency } = parseInr2(priceEl);
    const scoreText = card.find('[data-testid="review-score"]').first().text().replace(/\s+/g, ' ').trim();
    const score = scoreText.match(/(\d(?:\.\d)?)\b/)?.[1];
    const href = card.find('a[href*="/hotel/"]').first().attr('href') || '';
    const propUrl = href ? `https://www.booking.com${href.split('?')[0]}` : searchUrl;
    const distance = card.find('[data-testid="distance"]').first().text().trim();
    if (!price) return; // a card without a displayed price carries no verifiable offer
    out.push(newRawItem(source, {
      title: name.slice(0, 200),
      price,
      currency,
      seller: 'Booking.com',
      sellerUrl: propUrl,
      availability: 'in_stock',
      travel: { roomType: 'as listed on Booking.com' },
      attributes: {
        ...(score ? { review_score: score } : {}),
        ...(distance ? { distance_from_center: distance.slice(0, 40) } : {}),
        price_scope: `nightly rate for ${checkin} → ${checkout} (as displayed by Booking.com)`,
        price_currency_note: currency !== 'INR' ? 'Price in source currency; convert to INR at checkout' : '',
      },
      evidence: {
        sourceUrl: searchUrl,
        sourceReference: name,
        rawFingerprint: fingerprint,
        extractedFields: ['title', 'price', ...(score ? ['review_score'] : [])],
      },
    }));
  });
  return out.slice(0, 25);
}
