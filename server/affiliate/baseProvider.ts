/** BaseAffiliateProvider — Adapter/Provider pattern for affiliate networks.
 *  Contract: authenticate() lazily on first fetch, token cached in-memory
 *  (with expiry), per-network error isolation handled by the Aggregator.
 */
import type { ProviderFetchResult, UnifiedAffiliateOffer } from './types';

export abstract class BaseAffiliateProvider {
  abstract readonly id: string;                 // 'admitad' | 'vcommission' | ...
  abstract readonly label: string;

  /** True when required credentials are present in the environment. */
  abstract isConfigured(): boolean;

  /** OAuth2 / API-key handshake. Implementations cache tokens in-memory. */
  abstract authenticate(): Promise<void>;

  /** Coupons/deals list. Must NEVER throw for per-offer issues — collect warnings. */
  abstract fetchOffers(opts?: { limit?: number; pages?: number }): Promise<ProviderFetchResult>;

  /** Campaigns/advertiser list (for admin + deeplink templates). */
  abstract fetchCampaigns(): Promise<Array<Record<string, unknown>>>;

  /** Build the final tracking link for a target URL with an attribution subId. */
  abstract generateTrackingLink(targetUrl: string, subId?: string): Promise<string>;

  /** Capability-honest helper: providers without creds report and skip. */
  protected unconfigured(): ProviderFetchResult {
    return { offers: [], count: 0, warnings: [`${this.id}: credentials not configured (check .env)`] };
  }

  /** Override to hook in-memory token expiry. */
  abstract tokenValid(): boolean;
}
