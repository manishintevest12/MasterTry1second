/**
 * AdmitadProvider — first concrete network adapter.
 *   OAuth2: POST https://api.admitad.com/token/  (Basic base64(client_id:client_secret),
 *   grant_type=client_credentials). Auto-refresh: tokens cached in-memory with
 *   expires_in minus a safety margin; re-authenticated transparently on 401.
 *   Coupons: GET https://api.admitad.com/coupons/ (paginated; status=active).
 *   Tracking: deeplink  /deeplink/{w_id}/advcampaign/{campaign_id}/?ulp={url}&subid={subId}
 *             or the coupon's own `goto` link when present.
 * Honest failures: no creds → UNAVAILABLE warning; 429/5xx → surfaced, never crashes.
 */
import { settings } from '../../common/settings';
import { log } from '../../common/logger';
import { BaseAffiliateProvider } from '../baseProvider';
import type { ProviderFetchResult, UnifiedAffiliateOffer } from '../types';

interface AdmitadToken { access_token: string; expires_in: number; fetchedAt: number }

const CATEGORY_MAP: Array<[RegExp, string]> = [
  [/fashion|cloth|apparel/i, 'fashion'], [/electronic|gadget|mobile|computer/i, 'electronics'],
  [/travel|hotel|flight/i, 'travel'], [/food|grocer|restaurant/i, 'food'],
  [/beauty|cosmetic/i, 'beauty'], [/home|furnish|kitchen/i, 'home'],
  [/financ|bank|loan|credit|invest/i, 'finance'], [/health|pharma|fitness|medic/i, 'health'],
  [/education|course|learn/i, 'education'], [/entertain|movie|game|music|stream/i, 'entertainment'],
];

export class AdmitadProvider extends BaseAffiliateProvider {
  readonly id = 'admitad' as const;
  readonly label = 'Admitad';
  private token: AdmitadToken | null = null;

  isConfigured(): boolean {
    return Boolean(settings.admitad.clientId && settings.admitad.clientSecret);
  }

  tokenValid(): boolean {
    if (!this.token) return false;
    const ageSec = (Date.now() - this.token.fetchedAt) / 1000;
    return ageSec < (this.token.expires_in - 60);
  }

  async authenticate(): Promise<void> {
    if (this.tokenValid()) return;
    if (!this.isConfigured()) throw new Error('admitad: ADMITAD_CLIENT_ID/ADMITAD_CLIENT_SECRET not set');
    const basic = Buffer.from(`${settings.admitad.clientId}:${settings.admitad.clientSecret}`).toString('base64');
    const res = await fetch(`${settings.admitad.baseUrl}/token/`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: settings.admitad.clientId,
        scope: settings.admitad.scope,
      }),
    });
    if (!res.ok) throw new Error(`admitad: token request failed (HTTP ${res.status})`);
    const j: any = await res.json();
    this.token = { access_token: j.access_token, expires_in: Number(j.expires_in || 300), fetchedAt: Date.now() };
    log.info('Affiliate', 'Admitad OAuth2 token acquired', { expires_in: this.token.expires_in });
  }

  private async apiGet(path: string, params: Record<string, string | number> = {}): Promise<any> {
    await this.authenticate();
    const qs = new URLSearchParams(params as any).toString();
    const res = await fetch(`${settings.admitad.baseUrl}${path}${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${this.token!.access_token}` },
    });
    if (res.status === 401) { this.token = null; await this.authenticate(); return this.apiGet(path, params); }
    if (!res.ok) throw new Error(`admitad: GET ${path} failed (HTTP ${res.status})`);
    return res.json();
  }

  async fetchOffers(opts: { limit?: number; pages?: number } = {}): Promise<ProviderFetchResult> {
    if (!this.isConfigured()) return this.unconfigured();
    const maxOffers = opts.limit ?? 500;
    const maxPages = opts.pages ?? 5;
    const offers: UnifiedAffiliateOffer[] = [];
    const warnings: string[] = [];
    for (let page = 0; page < maxPages && offers.length < maxOffers; page++) {
      const j = await this.apiGet('/coupons/', { limit: Math.min(100, maxOffers - offers.length), offset: page * 100, region: 'IN' });
      const results: any[] = j?.results || [];
      if (results.length === 0) break;
      for (const c of results) {
        try { offers.push(this.normalize(c)); } catch (e: any) { warnings.push(`admitad: offer ${c?.id} skipped (${String(e).slice(0, 60)})`); }
      }
    }
    return { offers, count: offers.length, warnings };
  }

  /** Admitad coupon JSON → UnifiedAffiliateOffer. Only evidence-backed fields. */
  normalize(c: any): UnifiedAffiliateOffer {
    const id = String(c.id ?? '');
    if (!id || !c.name) throw new Error('missing id/name');
    const frame = (c.frames || [])[0] || {};
    const rawCats: string[] = (c.categories || []).map((x: any) => String(x?.name || x)).concat(String(c.campaign?.category || ''));
    const type = /percent/i.test(String(frame.type || c.types?.[0]?.name_en || '')) ? 'percentage'
      : /cashback/i.test(String(c.types?.[0]?.name_en || '')) ? 'cashback'
      : /free.?ship|shipping/i.test(String(c.name)) ? 'shipping'
      : (frame.discount ? 'flat' : 'other');
    const expires = c.date_end ? new Date(String(c.date_end)) : null;
    return {
      network_source: 'admitad',
      network_offer_id: id,
      merchant_name: String(c.campaign?.name || c.campaign?.site || 'Unknown merchant'),
      merchant_logo: c.campaign?.image || null,
      title: String(c.name).slice(0, 500),
      description: c.description ? String(c.description).slice(0, 2000) : null,
      coupon_code: c.code ? String(c.code) : (Array.isArray(c.codewords) ? String(c.codewords[0]) : null),
      discount_value: frame.discount ? Number(frame.discount) : null,
      discount_type: type as any,
      affiliate_url: c.goto ? String(c.goto) : null,
      original_url: c.url || c.campaign?.site_url || null,
      categories: [...new Set(rawCats.map(this.mapCategory).filter(Boolean) as string[])],
      starts_at: c.date_start ? new Date(String(c.date_start)) : null,
      expires_at: expires,
      status: expires && expires.getTime() < Date.now() ? 'expired' : 'active',
      commission: c.campaign?.rate ? Number(String(c.campaign.rate).replace(/[^\d.]/g, '')) || null : null,
      commission_note: c.campaign?.rate ? String(c.campaign.rate) : null,
      raw: { campaign_id: c.campaign?.id, regions: c.regions },
    };
  }

  private mapCategory(raw: string): string | null {
    for (const [re, name] of CATEGORY_MAP) if (re.test(raw)) return name;
    return null;
  }

  async fetchCampaigns(): Promise<Array<Record<string, unknown>>> {
    if (!this.isConfigured()) { log.warn('Affiliate', 'Admitad campaigns skipped: not configured'); return []; }
    const j = await this.apiGet('/advcampaigns/', { limit: 100, website: settings.admitad.websiteId });
    return (j?.results || []).map((r: any) => ({ id: r.id, name: r.name, site: r.site, status: r.status, categories: r.categories, gotolink: r.gotolink }));
  }

  async generateTrackingLink(targetUrl: string, subId?: string): Promise<string> {
    await this.authenticate();
    // Deeplink format; when a website + campaign id are known the ulp param carries the target.
    if (settings.admitad.websiteId && settings.admitad.defaultCampaignId) {
      const u = new URL(`${settings.admitad.baseUrl.replace('api.', 'ad.')}/deeplink/${settings.admitad.websiteId}/advcampaign/${settings.admitad.defaultCampaignId}/`);
      u.searchParams.set('ulp', targetUrl);
      if (subId) u.searchParams.set('subid', subId);
      return u.toString();
    }
    const u = new URL(targetUrl);
    if (subId) u.searchParams.set('subid', subId);
    return u.toString();
  }
}
