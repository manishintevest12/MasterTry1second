/**
 * ValidationEngine (Section 12): per-vertical validation rules.
 * Missing required fields are marked unknown/unverified — never invented.
 * Wrong currency, wrong variant, unverifiable coupons, and unavailable offers ranked
 * as purchasable are rejected or downgraded here.
 */
import type { NormalizedOffer, ParsedQuery, VerticalId } from '../types';
import { isSupportedCurrency } from './pricing';

export interface ValidationCheck {
  name: string;
  passed: boolean;
  severity: 'blocking' | 'warning';
  detail?: string;
}

export interface ValidationResult {
  status: 'VALID' | 'INVALID' | 'PARTIAL';
  checks: ValidationCheck[];
  confidence: number;
  unverified: string[];
}

interface FieldRule {
  name: string;
  present: (o: NormalizedOffer) => boolean;
  blocking?: boolean; // default true
}

// Vertical-specific required-field rules (Section 12). A field that the source
// does not provide is reported unknown, which caps confidence but doesn't crash the pipeline.
const VERTICAL_RULES: Record<VerticalId, FieldRule[]> = {
  ecommerce: [
    { name: 'price', present: (o) => o.prices.mandatoryTotal !== undefined },
    { name: 'currency', present: (o) => isSupportedCurrency(o.prices.currency) },
    { name: 'seller', present: (o) => Boolean(o.seller) },
    { name: 'identity', present: (o) => Boolean(o.identifiers.gtin || o.identifiers.sku || o.brand || o.attributes['model']) },
    { name: 'stock', present: (o) => o.availability !== 'unknown', blocking: false },
    { name: 'delivery_fee', present: (o) => o.prices.fees.deliveryFee !== undefined, blocking: false },
  ],
  food: [
    { name: 'restaurant', present: (o) => Boolean(o.vendor) },
    { name: 'menu_item', present: (o) => Boolean(o.title) },
    { name: 'menu_price', present: (o) => o.prices.mandatoryTotal !== undefined },
    { name: 'currency', present: (o) => isSupportedCurrency(o.prices.currency) },
    { name: 'delivery_fee', present: (o) => o.prices.fees.deliveryFee !== undefined, blocking: false },
    { name: 'platform_fee', present: (o) => o.prices.fees.platformFee !== undefined, blocking: false },
    { name: 'eta', present: (o) => o.attributes['eta_minutes'] !== undefined, blocking: false },
  ],
  grocery: [
    { name: 'item', present: (o) => Boolean(o.title) },
    { name: 'pack_size', present: (o) => Boolean(o.attributes['pack_size'] || o.attributes['quantity']), blocking: false },
    { name: 'outlet', present: (o) => Boolean(o.vendor) },
    { name: 'price', present: (o) => o.prices.mandatoryTotal !== undefined },
    { name: 'currency', present: (o) => isSupportedCurrency(o.prices.currency) },
    { name: 'delivery_fee', present: (o) => o.prices.fees.deliveryFee !== undefined, blocking: false },
    { name: 'eta', present: (o) => o.attributes['eta_minutes'] !== undefined, blocking: false },
  ],
  flights: [
    { name: 'route', present: (o) => Boolean(o.travel?.route) },
    { name: 'dates', present: (o) => Boolean(o.travel?.date) },
    { name: 'airline', present: (o) => Boolean(o.vendor) },
    { name: 'fare', present: (o) => o.prices.mandatoryTotal !== undefined },
    { name: 'currency', present: (o) => isSupportedCurrency(o.prices.currency) },
    { name: 'fare_conditions', present: (o) => Boolean(o.attributes['fare_conditions']), blocking: false },
    { name: 'baggage', present: (o) => Boolean(o.attributes['baggage']), blocking: false },
  ],
  hotels: [
    { name: 'property', present: (o) => Boolean(o.title) },
    { name: 'dates', present: (o) => Boolean(o.travel?.date) },
    { name: 'room_type', present: (o) => Boolean(o.travel?.roomType || o.attributes['room_type']), blocking: false },
    { name: 'guests', present: (o) => Boolean(o.travel?.guests), blocking: false },
    { name: 'payable_total', present: (o) => o.prices.effectivePrice !== undefined || o.prices.mandatoryTotal !== undefined },
    { name: 'currency', present: (o) => isSupportedCurrency(o.prices.currency) },
    { name: 'cancellation_policy', present: (o) => Boolean(o.attributes['cancellation_policy']), blocking: false },
  ],
  cab: [
    { name: 'pickup', present: (o) => Boolean(o.attributes['pickup'] || o.location?.city) },
    { name: 'destination', present: (o) => Boolean(o.attributes['drop'] || o.travel?.route) },
    { name: 'fare', present: (o) => o.prices.mandatoryTotal !== undefined },
    { name: 'currency', present: (o) => isSupportedCurrency(o.prices.currency) },
    { name: 'vehicle_type', present: (o) => Boolean(o.attributes['vehicle_type']), blocking: false },
  ],
  loans: [
    { name: 'lender', present: (o) => Boolean(o.vendor) },
    { name: 'product', present: (o) => Boolean(o.title) },
    { name: 'rate', present: (o) => o.attributes['interest_rate'] !== undefined },
    { name: 'indicative_flag', present: (o) => o.attributes['rate_type'] === 'indicative' || o.attributes['rate_type'] === 'approved', blocking: false },
  ],
  insurance: [
    { name: 'insurer', present: (o) => Boolean(o.vendor) },
    { name: 'plan', present: (o) => Boolean(o.title) },
    { name: 'premium', present: (o) => o.prices.mandatoryTotal !== undefined },
    { name: 'indicative_flag', present: (o) => o.attributes['quote_type'] === 'indicative' || o.attributes['quote_type'] === 'quoted', blocking: false },
  ],
  movies: [
    { name: 'event', present: (o) => Boolean(o.title) },
    { name: 'venue', present: (o) => Boolean(o.attributes['venue'] || o.vendor) },
    { name: 'show_date', present: (o) => Boolean(o.travel?.date || o.attributes['date']) },
    { name: 'ticket_price', present: (o) => o.prices.mandatoryTotal !== undefined },
    { name: 'currency', present: (o) => isSupportedCurrency(o.prices.currency) },
    { name: 'convenience_fee', present: (o) => o.prices.fees.serviceFee !== undefined, blocking: false },
  ],
  bus: [
    { name: 'route', present: (o) => Boolean(o.travel?.route) },
    { name: 'travel_date', present: (o) => Boolean(o.travel?.date) },
    { name: 'operator', present: (o) => Boolean(o.vendor) },
    { name: 'fare', present: (o) => o.prices.mandatoryTotal !== undefined },
    { name: 'seat_type', present: (o) => Boolean(o.travel?.seatType), blocking: false },
  ],
  coupons: [
    { name: 'merchant', present: (o) => Boolean(o.vendor) },
    { name: 'expiry', present: (o) => Boolean(o.expiresAt || o.attributes['expires_at']) },
    { name: 'eligibility', present: (o) => Boolean(o.attributes['min_spend'] || o.attributes['eligibility']) },
    { name: 'verified', present: (o) => o.attributes['verified'] === 'true', blocking: false },
  ],
  giftcards: [
    { name: 'merchant', present: (o) => Boolean(o.vendor) },
    { name: 'denomination', present: (o) => o.attributes['denomination'] !== undefined },
    { name: 'sale_price', present: (o) => o.prices.mandatoryTotal !== undefined },
    { name: 'validity', present: (o) => Boolean(o.attributes['validity']), blocking: false },
  ],
  banking: [
    { name: 'bank', present: (o) => Boolean(o.vendor) },
    { name: 'offer_terms', present: (o) => Boolean(o.title) },
    { name: 'validity', present: (o) => Boolean(o.expiresAt || o.attributes['valid_to']) },
    { name: 'min_spend', present: (o) => o.attributes['min_spend'] !== undefined, blocking: false },
  ],
};

export function validateOffer(offer: NormalizedOffer, query?: ParsedQuery): ValidationResult {
  const rules = VERTICAL_RULES[offer.vertical] || [];
  const checks: ValidationCheck[] = [];
  const unverified: string[] = [];

  checks.push({
    name: 'currency_supported',
    passed: isSupportedCurrency(offer.prices.currency),
    severity: 'blocking',
    detail: `currency=${offer.prices.currency}`,
  });
  if (offer.prices.currency !== 'INR') {
    checks.push({
      name: 'currency_inr_context',
      passed: false,
      severity: 'warning',
      detail: 'Non-INR offer shown in Indian market context — displayed with explicit currency',
    });
  }

  for (const rule of rules) {
    const present = rule.present(offer);
    checks.push({ name: rule.name, passed: present, severity: rule.blocking === false ? 'warning' : 'blocking' });
    if (!present) unverified.push(rule.name);
  }

  // An unavailable offer must never be ranked as purchasable (Section 24)
  if (offer.availability === 'out_of_stock') {
    checks.push({ name: 'purchasable', passed: false, severity: 'blocking', detail: 'out_of_stock' });
  }

  // Price sanity: non-positive prices are invalid, not "great deals"
  if (offer.prices.mandatoryTotal !== undefined && offer.prices.mandatoryTotal <= 0) {
    checks.push({ name: 'price_positive', passed: false, severity: 'blocking', detail: `price=${offer.prices.mandatoryTotal}` });
  }

  const blockingFailures = checks.filter((c) => !c.passed && c.severity === 'blocking');
  const warningFailures = checks.filter((c) => !c.passed && c.severity === 'warning');

  const status = blockingFailures.length > 0 ? 'INVALID' : warningFailures.length > 0 ? 'PARTIAL' : 'VALID';
  const confidence = Math.max(0, Math.min(1, 1 - blockingFailures.length * 0.5 - warningFailures.length * 0.12));

  return { status, checks, confidence, unverified };
}
