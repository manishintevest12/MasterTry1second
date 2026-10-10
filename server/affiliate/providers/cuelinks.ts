/** CuelinksProvider — skeleton. Real API contract documented; enable by
 *  implementing the TODOs once CUELINKS_API_KEY is issued to the publisher.
 */
import { settings } from '../../common/settings';
import { BaseAffiliateProvider } from '../baseProvider';
import type { ProviderFetchResult } from '../types';

export class CuelinksProvider extends BaseAffiliateProvider {
  readonly id = 'cuelinks' as const;
  readonly label = 'Cuelinks';

  isConfigured(): boolean { return Boolean(settings.cuelinks?.enabled); }
  tokenValid(): boolean { return false; } // TODO: cache Cuelinks JWT after /authenticate

  async authenticate(): Promise<void> { throw new Error('cuelinks: adapter pending publisher approval'); }
  async fetchOffers(): Promise<ProviderFetchResult> { return this.unconfigured(); }
  async fetchCampaigns(): Promise<Array<Record<string, unknown>>> { return []; }
  async generateTrackingLink(targetUrl: string, subId?: string): Promise<string> {
    // TODO: https://www.cuelinks.com/api/v2/campaigns + link?i={campaignId}&sub_id={subId}
    const u = new URL(targetUrl);
    if (subId) u.searchParams.set('sub_id', subId);
    return u.toString();
  }
}
