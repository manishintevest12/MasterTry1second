/**
 * StructuredDataAdapter (Section 4.2): JSON / XML / RSS / Atom feeds and documented endpoints.
 * Schemas are validated BEFORE offers are extracted (reject unknown shapes, never guess).
 */
import { createHash } from 'crypto';
import type { AdapterResult, RawSourceItem, SourceConfig } from '../../types';
import { httpAcquire, AcquisitionError } from '../../common/httpClient';
import { emptyResult, failedResult, newRawItem, type SourceAdapter } from '../contract';

/** Open Library book result — a genuinely open, permitted structured endpoint. */
interface OpenLibraryDoc {
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  key: string;
  isbn?: string[];
  cover_i?: number;
}

function validateOpenLibrary(json: any): OpenLibraryDoc[] {
  if (!json || typeof json !== 'object' || !Array.isArray(json.docs)) {
    throw new AcquisitionError('SCHEMA_DRIFT', 'Response does not match Open Library search schema');
  }
  return (json.docs as OpenLibraryDoc[]).filter((d) => d && typeof d.title === 'string');
}

/** Generic RSS 2.0 / Atom item extraction (used for permitted public offer feeds). */
export interface FeedItem {
  title: string;
  link?: string;
  description?: string;
  pubDate?: string;
}
export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const itemBlocks = xml.match(/<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/g) || [];
  for (const block of itemBlocks) {
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.trim();
    if (!title) continue;
    items.push({
      title: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
      link: block.match(/<link[^>]*href="([^"]+)"/)?.[1] || block.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1]?.trim(),
      description: block.match(/<description[^>]*>([\s\S]*?)<\/description>|<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1]?.trim(),
      pubDate: block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>|<updated[^>]*>([\s\S]*?)<\/updated>/)?.[1]?.trim(),
    });
  }
  return items;
}

export class StructuredDataAdapter implements SourceAdapter {
  readonly id = 'structured_adapter';
  readonly method = 'structured_data' as const;
  readonly adapterVersion = '1.0.0';
  readonly parserVersion = '1.1.0';

  async search(ctx: { query: any; source: SourceConfig }): Promise<AdapterResult> {
    const { source, query } = ctx;
    const fetchedAt = new Date().toISOString();
    const baseUrl = String(source.config.baseUrl || '');
    if (!baseUrl) return emptyResult(source, fetchedAt);

    try {
      let url = baseUrl;
      // Structured endpoints declare their parameter mapping in config
      if (source.config.paramMap && typeof source.config.paramMap === 'object') {
        for (const [param, qp] of Object.entries(source.config.paramMap as Record<string, string>)) {
          const value = param === 'query' ? (query.entityName || query.rawQuery) : (query as any)[param];
          if (value) url += `${url.includes('?') ? '&' : '?'}${qp}=${encodeURIComponent(String(value))}`;
        }
      }
      const res = await httpAcquire(url, {
        sourceId: source.id,
        expectJson: true,
        maxPerMinute: source.rateLimit.maxRequestsPerMinute,
        maxConcurrency: source.rateLimit.maxConcurrency,
      });
      if (!res.ok) return failedResult(source, 'SERVER_ERROR', `HTTP ${res.status}`, res.latencyMs, res.status);

      const fingerprint = createHash('sha256').update(res.body.slice(0, 50000)).digest('hex');

      // Route to a validator by configured schema type — validate BEFORE extracting offers
      if (source.config.schema === 'openlibrary_search') {
        const docs = validateOpenLibrary(JSON.parse(res.body));
        const rawItems: RawSourceItem[] = docs.slice(0, 20).map((d) =>
          newRawItem(source, {
            title: d.title,
            brand: d.author_name?.[0],
            identifiers: d.isbn?.[0] ? { gtin: d.isbn[0] } : {},
            attributes: d.first_publish_year ? { firstPublishYear: String(d.first_publish_year) } : {},
            seller: 'Open Library (book metadata, not a commercial offer)',
            availability: 'unknown',
            // NOTE: Open Library exposes no price. We deliberately do NOT set a price.
            evidence: { sourceUrl: `https://openlibrary.org${d.key}`, sourceReference: d.key, rawFingerprint: fingerprint, extractedFields: ['title', 'brand', 'identifiers'] },
          }),
        );
        return { success: true, sourceId: source.id, sourceMethod: source.method, rawItems, httpStatus: 200, latencyMs: res.latencyMs, fetchedAt };
      }

      if (source.config.schema === 'feed') {
        const items = parseFeed(res.body);
        const rawItems: RawSourceItem[] = items.slice(0, 20).map((i) =>
          newRawItem(source, {
            title: i.title,
            seller: source.name,
            sellerUrl: i.link,
            availability: 'unknown',
            evidence: { sourceUrl: i.link, rawFingerprint: fingerprint, extractedFields: ['title'] },
          }),
        );
        return { success: true, sourceId: source.id, sourceMethod: source.method, rawItems, httpStatus: 200, latencyMs: res.latencyMs, fetchedAt };
      }

      return failedResult(source, 'SCHEMA_DRIFT', `No validator for schema '${source.config.schema}'`, res.latencyMs, 200);
    } catch (e: any) {
      const fc = e instanceof AcquisitionError ? e.failureClass : e.message?.includes('JSON') ? 'MALFORMED_RESPONSE' : 'UNKNOWN';
      return failedResult(source, fc, String(e.message || e).slice(0, 200), 0);
    }
  }

  async healthCheck(source: SourceConfig) {
    const url = String(source.config.baseUrl || '');
    if (!url) return { healthy: false, failureClass: 'CONFIGURATION_REQUIRED' as any, latencyMs: 0 };
    try {
      const r = await httpAcquire(url, { sourceId: source.id, retries: 0, timeoutMs: 5000 });
      return { healthy: r.ok, latencyMs: r.latencyMs };
    } catch (e: any) {
      return { healthy: false, failureClass: e.failureClass || 'UNKNOWN', latencyMs: 0 };
    }
  }

  getFreshness(source: SourceConfig) {
    return source.freshnessPolicy;
  }

  getExpiry(raw: RawSourceItem): string | null {
    return raw.expiresAt || null;
  }
}
