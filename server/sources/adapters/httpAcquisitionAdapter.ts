/**
 * HTTPAcquisitionAdapter (Section 4.1): direct HTTP/HTTPS retrieval + HTML parsing.
 * Parses JSON-LD / OpenGraph / microdata with cheerio — only what the page genuinely exposes.
 * A 200 response is NOT proof of product data; missing fields stay unknown (never invented).
 */
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import type { AdapterResult, RawSourceItem, SourceConfig } from '../../types';
import { httpAcquire, httpHealthCheck, AcquisitionError } from '../../common/httpClient';
import { emptyResult, failedResult, newRawItem, type SourceAdapter } from '../contract';

interface ParsedOffer {
  title: string;
  price?: number;
  listPrice?: number;
  brand?: string;
  availability?: 'in_stock' | 'out_of_stock' | 'unknown';
  image?: string;
}

function toNumber(v: any): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const cleaned = String(v).replace(/[₹,\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseJsonLdOffers($: cheerio.CheerioAPI): ParsedOffer[] {
  const out: ParsedOffer[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      const nodes = Array.isArray(data) ? data : [data, ...(data['@graph'] || [])];
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        const t = node['@type'];
        if (typeof t === 'string' && /product|offer/i.test(t)) {
          const offer = t === 'Product' ? (node.offers?.[0] ?? node.offers) : node;
          out.push({
            title: node.name || offer?.name || '',
            price: toNumber(offer?.price ?? offer?.lowPrice),
            listPrice: toNumber((node as any).listPrice),
            brand: typeof node.brand === 'object' ? node.brand?.name : node.brand,
            availability: typeof offer?.availability === 'string'
              ? offer.availability.includes('InStock') ? 'in_stock'
                : offer.availability.includes('OutOfStock') ? 'out_of_stock' : 'unknown'
              : 'unknown',
          });
        }
      }
    } catch { /* malformed JSON-LD — record nothing, fabricate nothing */ }
  });
  return out.filter((o) => o.title);
}

function parseMetaOffer($: cheerio.CheerioAPI): ParsedOffer | null {
  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('h1').first().text().trim() || '';
  if (!title) return null;
  const priceMeta =
    $('meta[property="product:price:amount"]').attr('content') ||
    $('meta[property="og:price:amount"]').attr('content') ||
    $('[itemprop="price"]').first().attr('content') ||
    $('[itemprop="price"]').first().text().trim() || '';
  const currency =
    $('meta[property="product:price:currency"]').attr('content') ||
    $('meta[property="og:price:currency"]').attr('content') || 'INR';
  const brandMeta = $('meta[property="og:site_name"]').attr('content') || undefined;
  const price = toNumber(priceMeta);
  const availability = /out of stock|sold out/i.test($('body').text().slice(0, 20000)) ? 'out_of_stock' : 'unknown';
  const offer: ParsedOffer = { title, price, brand: brandMeta, availability };
  return offer;
}

export class HttpAcquisitionAdapter implements SourceAdapter {
  readonly id = 'http_adapter';
  readonly method = 'direct_http' as const;
  readonly adapterVersion = '1.0.0';
  readonly parserVersion = '1.2.0';

  async search(ctx: { query: any; source: SourceConfig }): Promise<AdapterResult> {
    const { source, query } = ctx;
    const fetchedAt = new Date().toISOString();
    const urlTemplate = String(source.config.urlTemplate || '');
    if (!urlTemplate) return emptyResult(source, fetchedAt);

    // Template contains {query} / {city} placeholders resolved per request
    const url = urlTemplate
      .replace('{query}', encodeURIComponent(query.rawQuery || ''))
      .replace('{city}', encodeURIComponent(query.location?.city || ''));
    try {
      const res = await httpAcquire(url, {
        sourceId: source.id,
        maxPerMinute: source.rateLimit.maxRequestsPerMinute,
        maxConcurrency: source.rateLimit.maxConcurrency,
        retries: 2,
      });
      if (res.status !== 200) {
        return failedResult(source, 'NOT_FOUND', `HTTP ${res.status}`, res.latencyMs, res.status);
      }
      const $ = cheerio.load(res.body);
      let offers = parseJsonLdOffers($);
      if (offers.length === 0) {
        const meta = parseMetaOffer($);
        if (meta) offers = [meta];
      }
      if (offers.length === 0) {
        // Honest: page fetched but no verifiable offer data present
        return failedResult(source, 'MISSING_REQUIRED_FIELD', 'No verifiable product data found on page', res.latencyMs, 200);
      }
      const rawItems: RawSourceItem[] = offers.slice(0, 20).map((o) =>
        newRawItem(source, {
          title: o.title,
          price: o.price,
          currency: 'INR',
          listPrice: o.listPrice,
          brand: o.brand,
          seller: source.name.replace(/\s*\(.*\)$/, ''),
          sellerUrl: url,
          availability: o.availability,
          evidence: {
            sourceUrl: url,
            rawFingerprint: createHash('sha256').update(res.body.slice(0, 50000)).digest('hex'),
            extractedFields: ['title', ...(o.price ? ['price'] : []), ...(o.availability !== 'unknown' ? ['availability'] : [])],
          },
        }),
      );
      return { success: true, sourceId: source.id, sourceMethod: source.method, rawItems, httpStatus: 200, latencyMs: res.latencyMs, fetchedAt };
    } catch (e: any) {
      const fc = e instanceof AcquisitionError ? e.failureClass : 'UNKNOWN';
      return failedResult(source, fc, String(e.message || e), 0, e?.httpStatus);
    }
  }

  async healthCheck(source: SourceConfig) {
    const url = String(source.config.healthUrl || source.config.urlTemplate || '');
    if (!url) return { healthy: false, failureClass: 'CONFIGURATION_REQUIRED' as any, latencyMs: 0 };
    const r = await httpHealthCheck(url, source.id);
    return { healthy: r.healthy, failureClass: r.failureClass, latencyMs: r.latencyMs };
  }

  getFreshness(source: SourceConfig) {
    return source.freshnessPolicy;
  }

  getExpiry(): string | null {
    return null;
  }
}
