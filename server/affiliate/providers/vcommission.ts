/** VCommissionProvider — campaigns feed already live in production.
 *  Reuses the same public campaigns endpoint; adds unified-offer normalization
 *  and tracking-link generation with subId attribution.
 */
import { settings } from '../../common/settings';
import { BaseAffiliateProvider } from '../baseProvider';
import type { ProviderFetchResult, UnifiedAffiliateOffer } from '../types';

export class VCommissionProvider extends BaseAffiliateProvider {
  readonly id = 'vcommission' as const;
  readonly label = 'VCommission';
  private campaigns: any[] = [];

  isConfigured(): boolean { return Boolean(settings.vcommission.enabled); }
  tokenValid(): boolean { return this.campaigns.length > 0; }

  async authenticate(): Promise<void> {
    const res = await fetch(`${settings.vcommission.baseUrl}/publisher/campaigns?apiKey=${settings.vcommission.apiKey}`);
    if (!res.ok) throw new Error(`vcommission: campaigns HTTP ${res.status}`);
    const j: any = await res.json();
    this.campaigns = Array.isArray(j.data) ? j.data : [];
  }

  async fetchOffers(_opts: { limit?: number } = {}): Promise<ProviderFetchResult> {
    if (!this.isConfigured()) return this.unconfigured();
    if (!this.tokenValid()) await this.authenticate();
    const offers: UnifiedAffiliateOffer[] = this.campaigns.map((c: any) => this.normalize(c));
    return { offers, count: offers.length, warnings: [] };
  }

  normalize(c: any): UnifiedAffiliateOffer {
    const cats = String(c.category || '').split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    return {
      network_source: 'vcommission',
      network_offer_id: String(c.campaign_id ?? c.id ?? ''),
      merchant_name: String(c.name || 'VCommission merchant').slice(0, 255),
      merchant_logo: c.logo || null,
      title: String(c.name || '').slice(0, 500),
      description: c.description ? String(c.description).slice(0, 2000) : null,
      coupon_code: null,
      discount_value: null,
      discount_type: 'cashback',
      affiliate_url: c.link ? String(c.link) : (c.url ? String(c.url) : null),
      original_url: c.url ? String(c.url) : null,
      categories: cats,
      starts_at: null,
      expires_at: null,
      status: 'active',
      commission: Number(String(c.payout || '').replace(/[^\d.]/g, '')) || null,
      commission_note: c.payout || null,
      raw: { tracking: c.tracking || null },
    };
  }

  async fetchCampaigns(): Promise<Array<Record<string, unknown>>> {
    if (!this.tokenValid()) await this.authenticate();
    return this.campaigns;
  }

  async generateTrackingLink(targetUrl: string, subId?: string): Promise<string> {
    const c = this.campaigns.find((x: any) => x.link && String(x.link) === targetUrl) || this.campaigns.find((x: any) => x.url === targetUrl);
    const base = c?.link ? String(c.link) : targetUrl;
    const u = new URL(base);
    if (subId) u.searchParams.set('sub_id', subId);
    return u.toString();
  }
}
