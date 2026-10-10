/** OptimiseProvider — skeleton (Optimise Media / OptimiseIndia). */
import { BaseAffiliateProvider } from '../baseProvider';
import type { ProviderFetchResult } from '../types';

export class OptimiseProvider extends BaseAffiliateProvider {
  readonly id = 'optimise' as const;
  readonly label = 'Optimise Media';
  isConfigured(): boolean { return false; } // TODO: OPTIMISE_API_KEY in settings + .env
  tokenValid(): boolean { return false; }
  async authenticate(): Promise<void> { throw new Error('optimise: adapter pending publisher approval'); }
  async fetchOffers(): Promise<ProviderFetchResult> { return this.unconfigured(); }
  async fetchCampaigns(): Promise<Array<Record<string, unknown>>> { return []; }
  async generateTrackingLink(targetUrl: string, subId?: string): Promise<string> {
    // TODO: Optimise link factory: https://linksredirect.com/?cid={campaignId}&source=linkkit&sub_id={subId}&url={targetUrl}
    const u = new URL(targetUrl);
    if (subId) u.searchParams.set('sub_id', subId);
    return u.toString();
  }
}
