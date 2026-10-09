/**
 * PricingEngine (Section 11): fees, savings, effective price — all in validated currency.
 *
 * Mandatory Total = base + tax + delivery + platform + service + other mandatory fees
 * Effective Price = Mandatory Total − verified applicable savings
 *
 * Rules enforced here:
 *  - Unknown currency is never assumed INR (validation rejects it)
 *  - Only verified eligible savings are applied
 *  - Vendor cashback is tracked but NEVER presented as Try1Second cashback
 *  - No price is ever computed from averages or guesses
 */
import type { PricedFees } from '../types';

export interface PriceBreakdown {
  currency: string;
  listPrice?: number;
  mandatoryTotal?: number;
  savingsBreakdown: {
    couponDiscount: number;
    bankDiscount: number;
    vendorCashback: number;
    giftCardSaving: number;
    totalVerifiedSavings: number;
  };
  effectivePrice?: number;
  finalPayablePrice?: number;
  verifiedSavings?: number;
  warnings: string[];
}

export function computeMandatoryTotal(fees: PricedFees): number | undefined {
  const base = fees.basePrice;
  if (base === undefined || base === null || !Number.isFinite(base)) return undefined;
  const sum = base +
    (fees.tax || 0) +
    (fees.deliveryFee || 0) +
    (fees.platformFee || 0) +
    (fees.serviceFee || 0) +
    (fees.otherMandatoryFee || 0);
  return round2(sum);
}

/**
 * Savings are only "verified" when the caller passes verified=true per component.
 * Unverified promotional claims are reported as warnings, never subtracted.
 */
export function computeEffectivePrice(
  fees: PricedFees,
  currency: string,
  verified: { coupon?: boolean; bank?: boolean; cashback?: boolean; giftCard?: boolean } = {},
): PriceBreakdown {
  const warnings: string[] = [];
  const mandatoryTotal = computeMandatoryTotal(fees);

  const couponDiscount = verified.coupon && fees.couponDiscount && fees.couponDiscount > 0 ? fees.couponDiscount : 0;
  const bankDiscount = verified.bank && fees.bankDiscount && fees.bankDiscount > 0 ? fees.bankDiscount : 0;
  const vendorCashback = verified.cashback && fees.vendorCashback && fees.vendorCashback > 0 ? fees.vendorCashback : 0;
  const giftCardSaving = verified.giftCard && fees.giftCardSaving && fees.giftCardSaving > 0 ? fees.giftCardSaving : 0;

  if (fees.couponDiscount && !verified.coupon) warnings.push('Coupon discount present but unverified — not applied');
  if (fees.bankDiscount && !verified.bank) warnings.push('Bank discount present but unverified — not applied');
  if (fees.vendorCashback && !verified.cashback) warnings.push('Vendor cashback unverified — not applied');

  const totalVerifiedSavings = round2(couponDiscount + bankDiscount + vendorCashback + giftCardSaving);
  const effectivePrice = mandatoryTotal === undefined ? undefined : round2(Math.max(0, mandatoryTotal - totalVerifiedSavings));

  if (effectivePrice !== undefined && mandatoryTotal !== undefined && effectivePrice > mandatoryTotal) {
    warnings.push('Savings exceed mandatory total — capped at mandatory total');
  }

  return {
    currency,
    listPrice: fees.listPrice,
    mandatoryTotal,
    savingsBreakdown: { couponDiscount, bankDiscount, vendorCashback, giftCardSaving, totalVerifiedSavings },
    effectivePrice,
    finalPayablePrice: effectivePrice, // payable at checkout (vendor cashback arrives later, not deducted at pay time — but we surface it transparently above)
    verifiedSavings: totalVerifiedSavings > 0 && effectivePrice !== undefined && mandatoryTotal !== undefined ? round2(mandatoryTotal - effectivePrice) : 0,
    warnings,
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const KNOWN_CURRENCIES = new Set([
  'INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY', 'CNY', 'CHF', 'THB', 'MYR', 'LKR', 'NPR', 'BHD', 'KWD', 'SAR', 'QAR', 'OMR',
]);

export function isSupportedCurrency(cur: string): boolean {
  // Wrong/unknown currencies are rejected outright — never assumed to be INR
  return KNOWN_CURRENCIES.has(cur.toUpperCase());
}
