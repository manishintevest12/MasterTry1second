/**
 * Try1Second — Shared backend types (single source of truth for module contracts).
 * Implements the normalized data model required by the master architecture.
 */

// ============ Freshness / validation statuses (Section 9) ============
export type FreshnessStatus =
  | 'LIVE_VERIFIED'
  | 'FRESH'
  | 'CACHED_VERIFIED'
  | 'AGING'
  | 'STALE'
  | 'EXPIRED'
  | 'PARTIAL'
  | 'UNVERIFIED'
  | 'SOURCE_UNAVAILABLE'
  | 'INVALID'
  | 'UNKNOWN';

export type MatchState = 'MATCHED' | 'PROBABLE_MATCH' | 'REVIEW_REQUIRED' | 'NOT_MATCHED';

export type VerticalId =
  | 'food'
  | 'grocery'
  | 'ecommerce'
  | 'flights'
  | 'hotels'
  | 'cab'
  | 'loans'
  | 'insurance'
  | 'movies'
  | 'bus'
  | 'coupons'
  | 'giftcards'
  | 'banking';

export const ALL_VERTICALS: VerticalId[] = [
  'food', 'grocery', 'ecommerce', 'flights', 'hotels', 'cab', 'loans',
  'insurance', 'movies', 'bus', 'coupons', 'giftcards', 'banking',
];

// ============ Query understanding ============
export interface ParsedQuery {
  rawQuery: string;
  vertical: VerticalId | null;
  verticalConfidence: number; // 0..1, rule-based confidence
  entityName: string | null;
  intent: 'compare' | 'buy' | 'book' | 'research' | 'browse';
  location: {
    pincode?: string;
    city?: string;
    locality?: string;
    lat?: number;
    lng?: number;
  };
  travelDates?: { depart?: string; return?: string };
  parties?: { passengers?: number; guests?: number };
  configuration?: Record<string, string>; // variant/config attributes (color, size, storage...)
}

// ============ Acquisition ============
export type SourceMethod =
  | 'direct_http'
  | 'structured_data'
  | 'affiliate_feed'
  | 'partner_feed'
  | 'official_api'
  | 'search_provider'
  | 'cached_catalogue';

export interface SourceConfig {
  id: string;
  name: string;
  method: SourceMethod;
  verticals: VerticalId[];
  enabled: boolean;
  priority: number; // lower = higher priority
  baseUrl?: string;
  config: Record<string, unknown>; // credentials, templates, selectors — never logged raw
  rateLimit: { maxRequestsPerMinute: number; maxConcurrency: number };
  freshnessPolicy: {
    liveVerifiedTtlSec: number;
    freshTtlSec: number;
    maxStaleSec: number;
  };
  adapterVersion: string;
  parserVersion: string;
  requiresAuthorization: boolean;
  permittedForRetention: boolean;
}

export type AdapterCapability =
  | 'search'
  | 'fetch'
  | 'parse'
  | 'normalize'
  | 'validate'
  | 'extract_evidence'
  | 'health_check'
  | 'get_freshness'
  | 'get_expiry';

export interface AdapterResult {
  success: boolean;
  sourceId: string;
  sourceMethod: SourceMethod;
  rawItems: RawSourceItem[];
  httpStatus?: number;
  latencyMs: number;
  error?: string;
  failureClass?: FailureClass;
  fetchedAt: string;
}

/** Un-normalized item as returned by a source, prior to parsing into the catalogue model. */
export interface RawSourceItem {
  sourceId: string;
  sourceUrl?: string;
  title: string;
  price?: number;
  currency?: string;
  listPrice?: number;
  brand?: string;
  model?: string;
  identifiers?: Partial<Record<'gtin' | 'ean' | 'upc' | 'mpn' | 'sku' | 'vendorProductId', string>>;
  attributes?: Record<string, string>;
  seller?: string;
  sellerUrl?: string;
  availability?: 'in_stock' | 'out_of_stock' | 'unknown';
  fees?: Partial<PricedFees>;
  location?: { pincode?: string; city?: string };
  travel?: { route?: string; date?: string; passengers?: number; guests?: number; roomType?: string; seatType?: string };
  expiresAt?: string;
  evidence: {
    sourceUrl?: string;
    sourceReference?: string;
    rawFingerprint?: string; // sha256 of raw payload — never store raw content unless permitted
    extractedFields: string[];
  };
  fetchedAt: string;
}

export type FailureClass =
  | 'DNS_FAILURE'
  | 'CONNECTION_FAILURE'
  | 'TLS_FAILURE'
  | 'TIMEOUT'
  | 'SERVER_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'ACCESS_CHALLENGE' // CAPTCHA / login wall
  | 'GEO_RESTRICTED'
  | 'MALFORMED_RESPONSE'
  | 'EMPTY_RESPONSE'
  | 'MISSING_REQUIRED_FIELD'
  | 'PARSER_FAILURE'
  | 'SCHEMA_DRIFT'
  | 'EXPIRED_CREDENTIALS'
  | 'QUOTA_EXHAUSTED'
  | 'CIRCUIT_OPEN'
  | 'CANCELLED'
  | 'UNKNOWN';

// ============ Pricing (Section 11) ============
export interface PricedFees {
  basePrice?: number;
  listPrice?: number;
  discount?: number;
  deliveryFee?: number;
  platformFee?: number;
  serviceFee?: number;
  tax?: number;
  couponDiscount?: number;
  bankDiscount?: number;
  vendorCashback?: number;
  giftCardSaving?: number;
  otherMandatoryFee?: number;
}

export interface NormalizedOffer {
  id: string;
  canonicalEntityId: number | string | null;
  canonicalVariantId: number | string | null;
  vertical: VerticalId;
  title: string;
  brand?: string;
  model?: string;
  identifiers: Record<string, string>;
  attributes: Record<string, string>;
  vendor: string; // merchant / platform
  seller: string;
  sellerUrl?: string;
  location?: { pincode?: string; city?: string };
  travel?: RawSourceItem['travel'];
  prices: {
    listPrice?: number;
    mandatoryTotal?: number;
    effectivePrice?: number;
    finalPayablePrice?: number;
    verifiedSavings?: number;
    currency: string;
    fees: PricedFees;
  };
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
  matchState: MatchState;
  matchEvidence?: string;
  freshnessStatus: FreshnessStatus;
  validationStatus: 'VALID' | 'INVALID' | 'PARTIAL';
  confidence: number; // 0..1
  affiliate?: {
    network: string;
    deepLink: string | null; // exact configured deep link, never invented
    campaignId?: string;
    subId?: string;
  };
  provenance: {
    sourceId: string;
    sourceMethod: SourceMethod;
    adapterVersion: string;
    parserVersion: string;
    sourceUrl?: string;
    sourceReference?: string;
    fetchedAt: string;
    validatedAt?: string;
    evidenceHash?: string;
  };
  expiresAt?: string;
}

// ============ Search response ============
export interface SearchResultOffer extends NormalizedOffer {
  rank: number;
  rankReasons: string[];
}

export interface SearchStateFlags {
  servedFrom: 'live' | 'catalogue' | 'cache' | 'partial' | 'unavailable';
  sourcesAttempted: string[];
  sourcesSucceeded: string[];
  sourcesFailed: Array<{ sourceId: string; failureClass: FailureClass; error: string }>;
  reusedCatalogue: boolean;
  triggeredRefresh: boolean;
  honestNotice?: string; // user-facing honest limitation, e.g. no sources configured
}

export interface SearchResponse {
  query: ParsedQuery;
  results: SearchResultOffer[];
  state: SearchStateFlags;
  latencyMs: number;
  totalSearchLatencyMs: number;
}

// ============ Health ============
export type SourceHealthState = 'HEALTHY' | 'DEGRADED' | 'CIRCUIT_OPEN' | 'UNVERIFIED' | 'DISABLED';

export interface SourceHealth {
  sourceId: string;
  state: SourceHealthState;
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureClass: FailureClass | null;
  circuitOpenUntil: string | null;
  totalAttempts: number;
  totalSuccesses: number;
  avgLatencyMs: number | null;
}

// ============ Rewards (Section 18) ============
export type FulfilmentStatus =
  | 'PENDING' | 'CONTACT_REQUIRED' | 'APPROVED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';

export interface AuthUser {
  id: number;
  email: string;
  role: 'user' | 'admin';
  displayName?: string;
}
