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
    // Live shape (verified Oct 2026): {success, data: {page, count, campaigns: [...]}}
    this.campaigns = Array.isArray(j?.data?.campaigns) ? j.data.campaigns : (Array.isArray(j?.data) ? j.data : []);
  }

  async fetchOffers(_opts: { limit?: number } = {}): Promise<ProviderFetchResult> {
    if (!this.isConfigured()) return this.unconfigured();
    if (!this.tokenValid()) await this.authenticate();
    const offers: UnifiedAffiliateOffer[] = this.campaigns.map((c: any) => this.normalize(c));
    return { offers, count: offers.length, warnings: [] };
  }

  normalize(c: any): UnifiedAffiliateOffer {
    // Verified live fields: id, title, description, thumbnail, preview_url,
    // tracking_link, categories, payouts (string repr of list-of-dicts), currency
    const cats = (() => { try { return String(c.categories || '').replace(/[\[\]'\"]/g, '').split(','); } catch { return []; } })();
    // payouts arrives as a string repr of a list ("[{'payout': 31.5, ...}]") — regex the
    // first payout number; unparseable stays null, never fabricated.
    let commission: number | null = null;
    const m = /['"]payout['"]\s*:\s*([\d.]+)/.exec(String(c.payouts || ''));
    if (m) commission = Number(m[1]) || null;
    return {
      network_source: 'vcommission',
      network_offer_id: String(c.id ?? c.campaign_id ?? ''),
      merchant_name: String(c.title || 'VCommission merchant').slice(0, 255),
      merchant_logo: c.thumbnail || null,
      title: String(c.title || '').slice(0, 500),
      description: c.description ? String(c.description).replace(/<[^>]*>/g, '').slice(0, 2000) : null,
      coupon_code: null,
      discount_value: null,
      discount_type: 'cashback',
      affiliate_url: c.tracking_link ? String(c.tracking_link) : null,
      original_url: c.preview_url ? String(c.preview_url) : null,
      categories: cats.map((s: string) => s.trim().toLowerCase()).filter(Boolean),
      starts_at: null,
      expires_at: null,
      status: 'active',
      commission,
      commission_note: commission != null ? `${commission} ${c.currency || 'INR'}` : null,
      raw: { model: c.model || null },
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
