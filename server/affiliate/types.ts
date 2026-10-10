/** Unified affiliate-offer model (Section: Affiliate Aggregator Engine).
 *  Every network (Admitad, VCommission, Cuelinks, Optimise, direct merchants)
 *  normalizes into THIS shape before persistence; the frontend never sees
 *  provider-specific fields.
 */
export type NetworkSource = 'admitad' | 'vcommission' | 'cuelinks' | 'optimise' | 'direct';
export type DiscountType = 'percentage' | 'flat' | 'cashback' | 'bogo' | 'shipping' | 'other';
export type OfferStatus = 'active' | 'expired' | 'paused';

export interface UnifiedAffiliateOffer {
  network_source: NetworkSource;
  network_offer_id: string;
  merchant_name: string;
  merchant_logo?: string | null;
  title: string;
  description?: string | null;
  coupon_code?: string | null;
  discount_value?: number | null;
  discount_type?: DiscountType | null;
  affiliate_url?: string | null;
  original_url?: string | null;
  categories: string[];          // normalized platform categories
  starts_at?: Date | null;
  expires_at?: Date | null;
  status: OfferStatus;
  commission?: number | null;    // % payout, used by smart dedup
  commission_note?: string | null;
  raw?: Record<string, unknown>; // never persisted wholesale; kept for evidence hash
}

export interface ProviderFetchResult {
  offers: UnifiedAffiliateOffer[];
  count: number;
  warnings: string[];
}

export interface ProviderSyncOutcome {
  provider: string;
  ok: boolean;
  offers: number;
  error?: string;
}
