/**
 * Feed & API adapters:
 *  - AffiliateFeedAdapter   (Section 15: authorized merchant/affiliate feeds, e.g. Cuelinks)
 *  - PartnerFeedAdapter      (partner-granted feeds, configured per partner)
 *  - OfficialAPIAdapter      (vendor/partner official APIs, authorized only)
 *  - SearchProviderAdapter   (OPTIONAL SearchApi.io; disabled/unavailable never blocks search)
 */
import { createHash } from 'crypto';
import type { AdapterResult, RawSourceItem, SourceConfig } from '../../types';
import { httpAcquire, AcquisitionError } from '../../common/httpClient';
import { settings } from '../../common/settings';
import { log } from '../../common/logger';
import { emptyResult, failedResult, newRawItem, type SourceAdapter } from '../contract';

// ---------------- AffiliateFeedAdapter ----------------
export class AffiliateFeedAdapter implements SourceAdapter {
  readonly id = 'affiliate_feed_adapter';
  readonly method = 'affiliate_feed' as const;
  readonly adapterVersion = '1.0.0';
  readonly parserVersion = '1.0.0';

  async search(ctx: { query: any; source: SourceConfig }): Promise<AdapterResult> {
    const { source, query } = ctx;
    const fetchedAt = new Date().toISOString();
    const apiKey = String(source.config.apiKey || '');
    const isVcommission = source.config.schema === 'vcommission_campaigns';
    const feedUrl = isVcommission
      ? `${String(source.config.baseUrl || 'https://api.vcommission.com/v2')}/publisher/campaigns?apiKey=${encodeURIComponent(apiKey)}`
      : String(source.config.feedUrl || '');
    if (!feedUrl || !apiKey) {
      // Credentials missing → adapter reports it, engine continues with other sources
      return failedResult(source, 'EXPIRED_CREDENTIALS', 'Affiliate feed URL/API key not configured', 0);
    }
    try {
      const res = await httpAcquire(feedUrl, {
        sourceId: source.id,
        headers: isVcommission ? {} : { Authorization: `Bearer ${apiKey}` },
        expectJson: true,
        maxPerMinute: source.rateLimit.maxRequestsPerMinute,
      });
      if (!res.ok) return failedResult(source, res.status === 429 ? 'QUOTA_EXHAUSTED' : 'SERVER_ERROR', `HTTP ${res.status}`, res.latencyMs, res.status);
      const json = JSON.parse(res.body);
      // VCommission: { success, data: { campaigns: [...] } } — affiliate campaign
      // metadata (merchant, tracking link, commission). No product prices are
      // fabricated from campaigns; only evidence-backed fields are extracted.
      if (isVcommission) {
        const campaigns = json?.data?.campaigns;
        if (!Array.isArray(campaigns)) {
          return failedResult(source, 'SCHEMA_DRIFT', 'VCommission feed schema unrecognized', res.latencyMs, 200);
        }
        const rawItems: RawSourceItem[] = campaigns.slice(0, 50)
          .filter((c: any) => c && c.title)
          .map((c: any) =>
            newRawItem(source, {
              title: String(c.title),
              price: undefined, // campaigns carry commissions, not product prices — never fabricated
              currency: 'INR',
              identifiers: c.id ? { sku: String(c.id) } : {},
              seller: String(c.store_title || c.merchant_name || 'VCommission merchant'),
              sellerUrl: c.tracking_url || c.url || undefined,
              availability: 'unknown',
              expiresAt: c.validity_end || c.expires_at,
              evidence: {
                sourceUrl: feedUrl.replace(`apiKey=${encodeURIComponent(apiKey)}`, 'apiKey=***'),
                rawFingerprint: createHash('sha256').update(res.body.slice(0, 50000)).digest('hex'),
                extractedFields: ['title', 'seller', ...(c.tracking_url || c.url ? ['tracking_url'] : [])],
              },
            }),
          );
        return { success: true, sourceId: source.id, sourceMethod: source.method, rawItems, httpStatus: 200, latencyMs: res.latencyMs, fetchedAt };
      }
      if (!Array.isArray(json.offers) && !Array.isArray(json)) {
        return failedResult(source, 'SCHEMA_DRIFT', 'Feed response schema unrecognized', res.latencyMs, 200);
      }
      const offers: any[] = (json.offers || json).slice(0, 50);
      const rawItems: RawSourceItem[] = offers
        .filter((o) => o && (o.title || o.product_name) && (o.price ?? o.sale_price) !== undefined)
        .map((o) =>
          newRawItem(source, {
            title: String(o.title || o.product_name),
            price: Number(o.price ?? o.sale_price) || undefined,
            listPrice: Number(o.list_price) || undefined,
            currency: (o.currency || 'INR').toUpperCase(),
            identifiers: o.sku || o.product_id ? { sku: String(o.sku || o.product_id) } : {},
            seller: String(o.merchant || source.name),
            sellerUrl: o.url || o.deeplink,
            availability: o.in_stock === false ? 'out_of_stock' : 'unknown',
            expiresAt: o.expires_at || o.valid_to,
            evidence: {
              sourceUrl: o.url || o.deeplink,
              rawFingerprint: createHash('sha256').update(res.body.slice(0, 50000)).digest('hex'),
              extractedFields: ['title', 'price', 'seller', ...(o.url ? ['url'] : [])],
            },
          }),
        );
      return { success: true, sourceId: source.id, sourceMethod: source.method, rawItems, httpStatus: 200, latencyMs: res.latencyMs, fetchedAt };
    } catch (e: any) {
      const fc = e instanceof AcquisitionError ? e.failureClass : 'UNKNOWN';
      return failedResult(source, fc, String(e.message || e).slice(0, 200), 0);
    }
  }

  async healthCheck(source: SourceConfig) {
    const feedUrl = String(source.config.feedUrl || '');
    if (!feedUrl || !source.config.apiKey) return { healthy: false, failureClass: 'EXPIRED_CREDENTIALS' as any, latencyMs: 0 };
    try {
      const r = await httpAcquire(feedUrl, { sourceId: source.id, headers: { Authorization: `Bearer ${source.config.apiKey}` }, retries: 0, timeoutMs: 5000 });
      return { healthy: r.ok, latencyMs: r.latencyMs };
    } catch (e: any) {
      return { healthy: false, failureClass: e.failureClass || 'UNKNOWN', latencyMs: 0 };
    }
  }

  getFreshness(source: SourceConfig) { return source.freshnessPolicy; }
  getExpiry(raw: RawSourceItem): string | null { return raw.expiresAt || null; }
}

// ---------------- PartnerFeedAdapter ----------------
export class PartnerFeedAdapter implements SourceAdapter {
  readonly id = 'partner_feed_adapter';
  readonly method = 'partner_feed' as const;
  readonly adapterVersion = '1.0.0';
  readonly parserVersion = '1.0.0';

  async search(ctx: { query: any; source: SourceConfig }): Promise<AdapterResult> {
    const { source } = ctx;
    // No partner is claimed until configured and verified (Section 5 honesty rule)
    if (!source.config.feedUrl) {
      return failedResult(source, 'MISSING_REQUIRED_FIELD', 'Partner feed not configured yet', 0);
    }
    try {
      const res = await httpAcquire(String(source.config.feedUrl), { sourceId: source.id, expectJson: true });
      const json = JSON.parse(res.body);
      const rows: any[] = Array.isArray(json) ? json : json.items || [];
      const rawItems: RawSourceItem[] = rows.slice(0, 50).map((o) =>
        newRawItem(source, {
          title: String(o.title || o.name || ''),
          price: Number(o.price) || undefined,
          currency: (o.currency || 'INR').toUpperCase(),
          seller: String(o.seller || source.name),
          sellerUrl: o.url,
          availability: o.in_stock === false ? 'out_of_stock' : 'unknown',
          evidence: { sourceUrl: o.url, extractedFields: ['title', ...(o.price ? ['price'] : [])] },
        }),
      ).filter((r) => r.title);
      return { success: true, sourceId: source.id, sourceMethod: source.method, rawItems, httpStatus: res.status, latencyMs: res.latencyMs, fetchedAt: new Date().toISOString() };
    } catch (e: any) {
      const fc = e instanceof AcquisitionError ? e.failureClass : 'UNKNOWN';
      return failedResult(source, fc, String(e.message || e).slice(0, 200), 0);
    }
  }

  async healthCheck(source: SourceConfig) {
    if (!source.config.feedUrl) return { healthy: false, failureClass: 'CONFIGURATION_REQUIRED' as any, latencyMs: 0 };
    try {
      const r = await httpAcquire(String(source.config.feedUrl), { sourceId: source.id, retries: 0, timeoutMs: 5000 });
      return { healthy: r.ok, latencyMs: r.latencyMs };
    } catch (e: any) {
      return { healthy: false, failureClass: e.failureClass || 'UNKNOWN', latencyMs: 0 };
    }
  }

  getFreshness(source: SourceConfig) { return source.freshnessPolicy; }
  getExpiry(raw: RawSourceItem): string | null { return raw.expiresAt || null; }
}

// ---------------- OfficialAPIAdapter ----------------
export class OfficialAPIAdapter implements SourceAdapter {
  readonly id = 'official_api_adapter';
  readonly method = 'official_api' as const;
  readonly adapterVersion = '1.0.0';
  readonly parserVersion = '1.0.0';

  async search(ctx: { query: any; source: SourceConfig }): Promise<AdapterResult> {
    const { source } = ctx;
    const endpoint = String(source.config.endpoint || '');
    if (!endpoint || !source.config.apiKey) {
      return failedResult(source, 'EXPIRED_CREDENTIALS', 'Official API not authorized yet (endpoint/key missing)', 0);
    }
    try {
      const res = await httpAcquire(endpoint, {
        sourceId: source.id,
        headers: { Authorization: `Bearer ${source.config.apiKey}` },
        expectJson: true,
      });
      const json = JSON.parse(res.body);
      const rows: any[] = Array.isArray(json) ? json : json.data || json.results || [];
      const rawItems: RawSourceItem[] = rows.slice(0, 50).map((o) =>
        newRawItem(source, {
          title: String(o.title || o.name || ''),
          price: Number(o.price ?? o.fare ?? o.premium) || undefined,
          currency: (o.currency || 'INR').toUpperCase(),
          seller: String(o.provider || source.name),
          sellerUrl: o.url || o.booking_url,
          availability: o.available === false ? 'out_of_stock' : 'unknown',
          travel: o.route || o.date ? { route: o.route, date: o.date, passengers: o.passengers, seatType: o.seat_type } : undefined,
          evidence: { sourceUrl: o.url, extractedFields: ['title', ...(o.price ? ['price'] : [])] },
        }),
      ).filter((r) => r.title);
      return { success: true, sourceId: source.id, sourceMethod: source.method, rawItems, httpStatus: res.status, latencyMs: res.latencyMs, fetchedAt: new Date().toISOString() };
    } catch (e: any) {
      const fc = e instanceof AcquisitionError ? e.failureClass : 'UNKNOWN';
      return failedResult(source, fc, String(e.message || e).slice(0, 200), 0);
    }
  }

  async healthCheck(source: SourceConfig) {
    if (!source.config.endpoint) return { healthy: false, failureClass: 'CONFIGURATION_REQUIRED' as any, latencyMs: 0 };
    try {
      const r = await httpAcquire(String(source.config.endpoint), { sourceId: source.id, retries: 0, timeoutMs: 5000 });
      return { healthy: r.ok, latencyMs: r.latencyMs };
    } catch (e: any) {
      return { healthy: false, failureClass: e.failureClass || 'UNKNOWN', latencyMs: 0 };
    }
  }

  getFreshness(source: SourceConfig) { return source.freshnessPolicy; }
  getExpiry(raw: RawSourceItem): string | null { return raw.expiresAt || null; }
}

// ---------------- SearchProviderAdapter (OPTIONAL) ----------------
/**
 * SearchApi.io is an OPTIONAL adapter (Sections 2.3, 4.3). Its responses are candidate
 * data only — every item must pass the normal validation pipeline. When the provider is
 * disabled, quota-exhausted, or malformed, this adapter fails alone; the core continues.
 */
export class SearchProviderAdapter implements SourceAdapter {
  readonly id = 'search_provider_adapter';
  readonly method = 'search_provider' as const;
  readonly adapterVersion = '1.0.0';
  readonly parserVersion = '1.0.0';

  async search(ctx: { query: any; source: SourceConfig }): Promise<AdapterResult> {
    const { source, query } = ctx;
    const fetchedAt = new Date().toISOString();
    const apiKey = String(source.config.apiKey || settings.searchApi.apiKey);
    if (!apiKey) return failedResult(source, 'EXPIRED_CREDENTIALS', 'SearchApi key not configured (adapter optional)', 0);

    const engineMap: Record<string, string> = { ecommerce: 'google_shopping', flights: 'google_flights', hotels: 'google_hotels' };
    const engine = engineMap[query.vertical || ''] || 'google_shopping';
    if (!(source.config.engines as string[] | undefined)?.includes(engine)) {
      return failedResult(source, 'MISSING_REQUIRED_FIELD', `Engine ${engine} not supported for this vertical`, 0);
    }
    try {
      const url = `https://www.searchapi.io/api/v1/search?engine=${engine}&q=${encodeURIComponent(query.rawQuery)}`;
      const res = await httpAcquire(url, { sourceId: source.id, headers: { Authorization: `Bearer ${apiKey}` }, expectJson: true });
      if (res.status === 429) return failedResult(source, 'QUOTA_EXHAUSTED', 'SearchApi quota exhausted', res.latencyMs, 429);
      if (!res.ok) return failedResult(source, 'SERVER_ERROR', `HTTP ${res.status}`, res.latencyMs, res.status);
      const json = JSON.parse(res.body);
      const products: any[] = (json.shopping_results || json.flights || json.hotels || []).slice(0, 20);
      const rawItems: RawSourceItem[] = products
        .filter((p) => p && (p.title || p.name))
        .map((p) =>
          newRawItem(source, {
            title: String(p.title || p.name),
            price: Number(String(p.extracted_price ?? p.price ?? '').replace(/[₹,]/g, '')) || undefined,
            currency: p.currency || 'INR',
            brand: p.source || p.seller,
            seller: p.source || p.seller || 'SearchApi candidate',
            sellerUrl: p.link || p.url,
            availability: 'unknown',
            evidence: {
              sourceUrl: p.link || p.url,
              rawFingerprint: createHash('sha256').update(res.body.slice(0, 50000)).digest('hex'),
              extractedFields: ['title', ...(p.price !== undefined ? ['price'] : [])],
            },
          }),
        );
      log.debug('SearchProvider', `SearchApi returned ${rawItems.length} candidates`);
      return { success: true, sourceId: source.id, sourceMethod: source.method, rawItems, httpStatus: 200, latencyMs: res.latencyMs, fetchedAt };
    } catch (e: any) {
      const fc = e instanceof AcquisitionError ? e.failureClass : 'UNKNOWN';
      return failedResult(source, fc, String(e.message || e).slice(0, 200), 0);
    }
  }

  async healthCheck(source: SourceConfig) {
    if (!source.config.apiKey) return { healthy: false, failureClass: 'EXPIRED_CREDENTIALS' as any, latencyMs: 0 };
    try {
      const r = await httpAcquire('https://www.searchapi.io/api/v1/account', { sourceId: source.id, headers: { Authorization: `Bearer ${source.config.apiKey}` }, retries: 0, timeoutMs: 5000 });
      return { healthy: r.ok, latencyMs: r.latencyMs };
    } catch (e: any) {
      return { healthy: false, failureClass: e.failureClass || 'UNKNOWN', latencyMs: 0 };
    }
  }

  getFreshness(source: SourceConfig) { return source.freshnessPolicy; }
  getExpiry(): string | null { return null; }
}
