/** DirectMerchantProvider — direct brand/merchant feeds (CSV upload or webhook).
 *  Skeleton: the merchant B2B portal (/merchantinstab2b) will push rows here,
 *  making this the only acquisition channel nobody can revoke.
 */
import { BaseAffiliateProvider } from '../baseProvider';
import type { ProviderFetchResult, UnifiedAffiliateOffer } from '../types';

export class DirectMerchantProvider extends BaseAffiliateProvider {
  readonly id = 'direct' as const;
  readonly label = 'Direct Merchant Feed';
  private pending: UnifiedAffiliateOffer[] = []; // TODO: CSV/webhook ingestion queue

  isConfigured(): boolean { return false; } // enabled per-merchant after B2B onboarding
  tokenValid(): boolean { return false; }
  async authenticate(): Promise<void> { /* direct feeds need no auth handshake */ }
  async fetchOffers(): Promise<ProviderFetchResult> { return { offers: this.pending, count: this.pending.length, warnings: [] }; }
  async fetchCampaigns(): Promise<Array<Record<string, unknown>>> { return []; }
  async generateTrackingLink(targetUrl: string, subId?: string): Promise<string> {
    const u = new URL(targetUrl);           // direct feeds carry their own tracking or none
    if (subId) u.searchParams.set('sub_id', subId);
    return u.toString();
  }
}
