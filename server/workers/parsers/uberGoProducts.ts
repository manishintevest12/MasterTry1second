/**
 * Uber m.uber.com/go guest Products parser (discovered 24 Oct 2026).
 *
 * Context: Uber retired the legacy www.uber.com loadFEEstimates guest fare RPC;
 * the price-estimate page now hands off to the guest ride web app at
 * m.uber.com/go. That app is an Apollo GraphQL client talking to
 * POST https://m.uber.com/go/graphql with a literal "x-csrf-token: x" header
 * (their own bundle sends exactly this). Its Products query returns the real
 * route-scoped product catalog (names, descriptions, capacity, availability,
 * intercity configs) for pickup + dropoff COORDINATES -- verified browserless
 * via curl_cffi from the sandbox on 24 Oct 2026 (Indore Rajwada -> Airport).
 *
 * Honesty: in the ANONYMOUS response every fare/eta field is an empty string --
 * Uber quotes prices only post-login. We NEVER invent them. Each fetch
 * re-requests fares, so if Uber ever re-exposes guest prices the rows
 * automatically carry them (self-healing probe, no dead fallback).
 *
 * Production acquisition: curl_cffi replay (impersonate chrome), no browser
 * automation. A session must be primed first (GET m.uber.com/go/looking) so the
 * graphql call receives the guest jwt-session cookie, otherwise it 302s to the
 * login page.
 */

/** Verbatim query text captured from the site's own bundle (client-69684):
 *  operation "Products" + Products/Tier/Product/Badges fragments. */
export const UBER_PRODUCTS_QUERY = 'query Products($boostedVehicleId: String, $capacity: Int, $destinations: [InputCoordinate!]!, $hcvContext: InputRVWebCommonHCVContext, $includeRecommended: Boolean = false, $isHcv: Boolean, $isRiderCurrentUser: Boolean, $payment: InputPayment, $paymentProfileUUID: String, $pickup: InputCoordinate!, $pickupFormattedTime: String, $profileType: String, $profileUUID: String, $returnByFormattedTime: String, $stuntID: String, $targetProductType: EnumRVWebCommonTargetProductType) {\n  products(\n    boostedVehicleId: $boostedVehicleId\n    capacity: $capacity\n    destinations: $destinations\n    hcvContext: $hcvContext\n    includeRecommended: $includeRecommended\n    isHcv: $isHcv\n    isRiderCurrentUser: $isRiderCurrentUser\n    payment: $payment\n    paymentProfileUUID: $paymentProfileUUID\n    pickup: $pickup\n    pickupFormattedTime: $pickupFormattedTime\n    profileType: $profileType\n    profileUUID: $profileUUID\n    returnByFormattedTime: $returnByFormattedTime\n    stuntID: $stuntID\n    targetProductType: $targetProductType\n  ) {\n    ...ProductsFragment\n    __typename\n  }\n}\n\nfragment ProductsFragment on RVWebCommonProductsResponse {\n  defaultVVID\n  hourlyTiersWithMinimumFare {\n    ...HourlyTierFragment\n    __typename\n  }\n  intercity {\n    ...IntercityFragment\n    __typename\n  }\n  links {\n    iFrame\n    text\n    url\n    __typename\n  }\n  personalizationID\n  productsUnavailableMessage\n  tiers {\n    ...TierFragment\n    __typename\n  }\n  __typename\n}\n\nfragment BadgesFragment on RVWebCommonProductBadge {\n  backgroundColor\n  color\n  contentColor\n  icon\n  inactiveBackgroundColor\n  inactiveContentColor\n  text\n  __typename\n}\n\nfragment HourlyTierFragment on RVWebCommonHourlyTier {\n  description\n  distance\n  fare\n  fareAmountE5\n  farePerHour\n  minutes\n  packageVariantUUID\n  preAdjustmentValue\n  __typename\n}\n\nfragment IntercityFragment on RVWebCommonIntercityInfo {\n  oneWayIntercityConfig(destinations: $destinations, pickup: $pickup) {\n    ...IntercityConfigFragment\n    __typename\n  }\n  roundTripIntercityConfig(destinations: $destinations, pickup: $pickup) {\n    ...IntercityConfigFragment\n    __typename\n  }\n  __typename\n}\n\nfragment IntercityConfigFragment on RVWebCommonIntercityConfig {\n  description\n  onDemandAllowed\n  reservePickup {\n    ...IntercityTimePickerFragment\n    __typename\n  }\n  returnBy {\n    ...IntercityTimePickerFragment\n    __typename\n  }\n  __typename\n}\n\nfragment IntercityTimePickerFragment on RVWebCommonIntercityTimePicker {\n  bookingRange {\n    maximum\n    minimum\n    __typename\n  }\n  header {\n    subTitle\n    title\n    __typename\n  }\n  __typename\n}\n\nfragment TierFragment on RVWebCommonProductTier {\n  products {\n    ...ProductFragment\n    __typename\n  }\n  title\n  __typename\n}\n\nfragment ProductFragment on RVWebCommonProduct {\n  badges {\n    ...BadgesFragment\n    __typename\n  }\n  cityID\n  currencyCode\n  description\n  detailedDescription\n  discountPrimary\n  displayName\n  estimatedTripTime\n  etaInMin\n  etaMax\n  etaStringShort\n  fares {\n    capacity\n    discountPrimary\n    fare\n    fareAmountE5\n    hasPromo\n    hasRidePass\n    meta\n    preAdjustmentValue\n    suggestedUpfrontTipAmounts {\n      amount {\n        amountE5\n        currencyCode\n        __typename\n      }\n      displayString\n      __typename\n    }\n    __typename\n  }\n  hasPromo\n  hasRidePass\n  hasBenefitsOnFare\n  hourly {\n    tiers {\n      ...HourlyTierFragment\n      __typename\n    }\n    overageRates {\n      ...HourlyOverageRatesFragment\n      __typename\n    }\n    __typename\n  }\n  iconType\n  id\n  is3p\n  isAvailable\n  legalConsent {\n    ...ProductLegalConsentFragment\n    __typename\n  }\n  parentProductUuid\n  preAdjustmentValue\n  productClassificationTypeName\n  productImageUrl\n  productUuid\n  rankedPricingExplainerText\n  reserveEnabled\n  vehicleViewUuid\n  __typename\n}\n\nfragment ProductLegalConsentFragment on RVWebCommonProductLegalConsent {\n  header\n  image {\n    url\n    width\n    __typename\n  }\n  description\n  enabled\n  ctaUrl\n  ctaDisplayString\n  buttonLabel\n  showOnce\n  shouldBlockRequest\n  __typename\n}\n\nfragment HourlyOverageRatesFragment on RVWebCommonHourlyOverageRates {\n  perDistanceUnit\n  perTemporalUnit\n  __typename\n}\n';

export interface UberGoPlace {
  lat: number;
  lng: number;
  name: string;
}

/** Exact request shape the site's own JS sends (captured 24 Oct). */
export function buildUberProductsRequestBody(pickup: UberGoPlace, drop: UberGoPlace): string {
  return JSON.stringify({
    operationName: 'Products',
    query: UBER_PRODUCTS_QUERY,
    variables: {
      includeRecommended: false,
      destinations: [{ latitude: drop.lat, longitude: drop.lng }],
      isHcv: false,
      payment: { uberCashToggleOn: true },
      pickup: { latitude: pickup.lat, longitude: pickup.lng },
      targetProductType: 'ANONYMOUS',
    },
  });
}

export interface UberGoProduct {
  tier: string;
  displayName: string;
  description: string;
  capacity: number | null;
  isAvailable: boolean;
  productUuid: string;
  /** Rupee amount when Uber exposes a guest fare (login-gated today); null = quoted only after login. */
  fare: number | null;
  etaMinutes: number | null;
}

/** Parse a Products graphql response into deduped products (catalog order:
 *  Popular tier first). Returns [] on any shape mismatch -- never throws. */
export function parseUberProductsResponse(body: string | null | undefined): UberGoProduct[] {
  let j: any;
  try { j = JSON.parse(String(body || '')); } catch { return []; }
  const tiers: any[] = j?.data?.products?.tiers;
  if (!Array.isArray(tiers)) return [];
  const seen = new Set<string>();
  const out: UberGoProduct[] = [];
  for (const tier of tiers) {
    for (const p of tier?.products || []) {
      const displayName = String(p?.displayName || '').trim();
      if (!displayName || seen.has(displayName)) continue;
      seen.add(displayName);
      const f = Array.isArray(p?.fares) ? p.fares[0] : null;
      let fare: number | null = null;
      if (f) {
        const m = String(f.fare || '').replace(/[₹,\s]/g, '');
        if (/^\d+(\.\d+)?$/.test(m)) fare = Math.round(Number(m));
        else if (f.fareAmountE5 != null) fare = Math.round(Number(f.fareAmountE5) / 100000);
      }
      const eta = p?.etaInMin != null ? Number(p.etaInMin) : null;
      out.push({
        tier: String(tier?.title || ''),
        displayName,
        description: String(p?.description || '').trim(),
        capacity: f?.capacity != null ? Number(f.capacity) : null,
        isAvailable: p?.isAvailable !== false,
        productUuid: String(p?.productUuid || p?.id || ''),
        fare: fare != null && Number.isFinite(fare) && fare > 0 ? fare : null,
        etaMinutes: eta != null && Number.isFinite(eta) && eta > 0 ? eta : null,
      });
    }
  }
  return out;
}

/** Owner-specified m.uber.com/looking booking format (see server/common/cabDeeplink.ts):
 *  pickup/drop as JSON blobs so the user lands on the pre-filled product-selection. */
export function buildUberGoBookUrl(clientId: string, pickup: UberGoPlace, drop: UberGoPlace): string {
  const q: string[] = [];
  if (clientId) q.push(`client_id=${encodeURIComponent(clientId)}`);
  q.push(`pickup=${encodeURIComponent(JSON.stringify({ latitude: pickup.lat, longitude: pickup.lng, addressLine1: pickup.name.slice(0, 120) }))}`);
  q.push(`drop[0]=${encodeURIComponent(JSON.stringify({ latitude: drop.lat, longitude: drop.lng, addressLine1: drop.name.slice(0, 120) }))}`);
  return `https://m.uber.com/looking/?${q.join('&')}`;
}

/** OWNER 3 Nov: the rider-session Product Selection call, exact payload captured from a live
 *  m.uber.com session (pickup/drop MANUAL_PIN + requestTime 0) posted to /go/product-selection.
 *  MEASURED from our egress without a rider session: HTTP 403 "Missing csrf token." — so this path
 *  needs BOTH the rider cookie and a real csrf token (see uberCsrfToken in cab.ts), never a guess. */
export function buildUberProductSelectionBody(pickup: UberGoPlace, drop: UberGoPlace): string {
  return JSON.stringify({
    pickup: { latitude: pickup.lat, longitude: pickup.lng, source: 'MANUAL_PIN' },
    drop: [{ latitude: drop.lat, longitude: drop.lng, source: 'MANUAL_PIN' }],
    requestTime: 0,
  });
}

/**
 * Parse the Product Selection answer. Tolerates BOTH shapes we have evidence for:
 *  - rider-session shape: { data: { products: [ { displayName, fareString, etaString } ] } }
 *  - Apollo shape:        { data: { products: { tiers: [...] } } }  (same as the anonymous query)
 * fareString is a LOCALIZED string ("₹374.01", "₹110-130"): a range takes its midpoint and
 * anything without a positive number stays unpriced — never estimated.
 */
export function parseUberProductSelectionResponse(body: string | null | undefined): UberGoProduct[] {
  let j: any;
  try { j = JSON.parse(String(body || '')); } catch { return []; }
  const products = j?.data?.products ?? j?.products;
  if (products && !Array.isArray(products) && Array.isArray(products.tiers)) return parseUberProductsResponse(body);
  if (!Array.isArray(products)) return [];
  const money = (v: unknown): number | null => {
    const nums = (String(v ?? '').match(/[\d,.]+/g) || [])
      .map((x: string) => Number(x.replace(/,/g, '')))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    if (!nums.length) return null;
    return Math.round(nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0]);
  };
  const seen = new Set<string>();
  const out: UberGoProduct[] = [];
  for (const p of products) {
    const displayName = String(p?.displayName || p?.title || '').trim();
    if (!displayName || seen.has(displayName)) continue;
    seen.add(displayName);
    const eta = Number((String(p?.etaString ?? '').match(/(\d+)/) || [])[1] || p?.etaInMin || 0);
    out.push({
      tier: String(p?.tier || ''),
      displayName,
      description: String(p?.description || p?.subtitle || '').trim(),
      capacity: p?.capacity != null ? Number(p.capacity) : null,
      isAvailable: p?.isAvailable !== false,
      productUuid: String(p?.productUuid || p?.id || ''),
      fare: money(p?.fareString ?? p?.fare ?? p?.priceString ?? p?.price),
      etaMinutes: Number.isFinite(eta) && eta > 0 ? eta : null,
    });
  }
  return out;
}
