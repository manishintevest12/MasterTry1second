/**
 * Amazon.in search-results parser. Verified live against
 * https://www.amazon.in/s?k=<q> : result cards are
 * div[data-component-type="s-search-result"] carrying data-asin, title (h2),
 * price (span.a-price > span.a-offscreen), MRP (span.a-price.a-text-price)
 * and rating (span.a-icon-alt). Only fields actually present are returned.
 */
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export function parseInr(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const m = text.replace(/\s/g, '').match(/[\d,]+(?:\.\d+)?/);
  if (!m) return undefined;
  const n = Number(m[0].replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function parseAmazonIn(html: string, source: SourceConfig, searchUrl: string): RawSourceItem[] {
  const $ = cheerio.load(html);
  const fingerprint = createHash('sha256').update(html.slice(0, 50000)).digest('hex');
  const out: RawSourceItem[] = [];
  $('div[data-component-type="s-search-result"]').each((_, el) => {
    const card = $(el);
    const asin = card.attr('data-asin');
    if (!asin) return;
    if (card.find('.puis-sponsored-label-text, [aria-label*="Sponsored"]').length) return; // skip ads
    // Amazon renders brand in <h2> and the product name in the title-recipe link
    // (or, failing that, the product image alt). Combine so the title is meaningful.
    const brandText = card.find('h2').first().text().replace(/\s+/g, ' ').trim();
    const nameText = (
      card.find('[data-cy="title-recipe"] a.a-link-normal[class*="line-clamp"]').first().text() ||
      card.find('a.a-link-normal[class*="s-line-clamp"]').first().text() ||
      card.find('img.s-image').first().attr('alt') || ''
    ).replace(/\s+/g, ' ').trim();
    const title = nameText
      ? (brandText && !nameText.toLowerCase().startsWith(brandText.toLowerCase()) ? `${brandText} ${nameText}` : nameText)
      : brandText;
    const h2 = card.find('h2').first();
    const price = parseInr(card.find('span.a-price:not(.a-text-price) > span.a-offscreen').first().text());
    const mrp = parseInr(card.find('span.a-price.a-text-price > span.a-offscreen').first().text());
    if (!title || !price) return; // unpriced cards carry no verifiable offer
    const rating = card.find('span.a-icon-alt').first().text().match(/([\d.]+) out of 5/)?.[1];
    const href = h2.find('a').attr('href') || card.find('a.a-link-normal[href*="/dp/"]').attr('href') || `/dp/${asin}`;
    const url = new URL(href.startsWith('http') ? href : `https://www.amazon.in${href.startsWith('/') ? '' : '/'}${href}`);
    const productUrl = `https://www.amazon.in/dp/${asin}`; // canonical, tracking-free
    void url;
    const prime = card.find('i.a-icon-prime').length > 0;
    const img = (card.find('img.s-image').first().attr('src') || '').trim();
    const imageUrl = /^https:\/\/m\.media-amazon\.com\//.test(img) ? img : '';
    const unavailable = /currently unavailable|out of stock/i.test(card.text());
    out.push(newRawItem(source, {
      title: title.slice(0, 220),
      price,
      currency: 'INR',
      listPrice: mrp && mrp > price ? mrp : undefined,
      identifiers: { vendorProductId: asin },
      attributes: { ...(rating ? { rating } : {}), ...(prime ? { prime: 'true' } : {}), ...(imageUrl ? { image_url: imageUrl } : {}) },
      seller: 'Amazon.in',
      sellerUrl: productUrl,
      availability: unavailable ? 'out_of_stock' : 'in_stock',
      evidence: {
        sourceUrl: searchUrl,
        sourceReference: asin,
        rawFingerprint: fingerprint,
        extractedFields: ['title', 'price', ...(mrp ? ['listPrice'] : []), ...(rating ? ['rating'] : []), 'availability'],
      },
    }));
  });
  return out.slice(0, 20);
}

/**
 * Amazon PDP image-gallery extractor (17 Oct). A product page embeds the
 * "colorImages" block ("ImageBlockATF" data): 'colorImages' : { 'initial':
 * [{ hiRes: "...", large: "...", thumb: "...", variant: "MAIN" }, ...] }.
 * Returns deduped https-only hiRes (fallback large) image URLs, max 6.
 */
export function extractAmazonGallery(pdpHtml: string): string[] {
  const urls: string[] = [];
  const push = (u: string) => {
    if (/^https:\/\/m\.media-amazon\.com\/.*\.(jpe?g|png|webp)/i.test(u) && !urls.includes(u)) urls.push(u);
  };
  for (const m of pdpHtml.matchAll(/"hiRes"\s*:\s*"(https:[^"]+)"/g)) push(m[1]);
  if (urls.length < 2) {
    for (const m of pdpHtml.matchAll(/"large"\s*:\s*"(https:[^"]+)"/g)) push(m[1]);
  }
  return urls.slice(0, 6);
}
