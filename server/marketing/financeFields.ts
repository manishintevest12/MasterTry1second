/**
 * Per-vertical field sets for the manual finance inventory (owner 18 Nov):
 * "Loans / Credit Cards / Insurance / Accounts, ye sab mai ek hi column hai jb ki website pr ... dekh kya
 * field chaiye uss hisab se backend bnao jiss se hum wo field daal ske aur live kr ske."
 *
 * The four verticals are rendered by DIFFERENT cards on the site, and each card reads a different set of
 * specs, so one shared column list could only ever publish a thin, half-empty entry:
 *   - credit cards  -> src/components/CreditCardCard.tsx reads bank, network, joining fee, annual fee,
 *                      annual fee inr, reward rate, apr, forex markup, lounges, best for, welcome benefit,
 *                      fuel waiver + the annual-fee ring.
 *   - loans         -> ComparisonCard rate card + lead form read loan type, interest rate range, processing
 *                      fee, tenure/amount, foreclosure, disbursal, eligibility (attribute vocabulary of
 *                      server/workers/parsers/bankbazaarLoans.ts).
 *   - insurance     -> the insurance rate card reads insurance type, claim settlement ratio (the number the
 *                      feed ranks on), premium-from, sum insured, network hospitals, waiting period, age.
 *   - accounts      -> the savings/demat card reads account type, interest rate slabs, unit label, minimum
 *                      average balance, debit card perks, charges (bankbazaarAccounts.ts vocabulary).
 *
 * Attributes are stored snake_case, and server/api/routes.ts turns every attribute key into a specs key with
 * spaces (`joining_fee` -> `joining fee`), which is exactly what the cards look up. So a field added here
 * lands on the live card with no second mapping.
 */
import type { FinanceVertical } from './financeOffers';

export type FinanceFieldType = 'text' | 'number' | 'select';

export interface FinanceField {
  /** attribute key written to offers.attributes (snake_case -> specs "with spaces"). */
  key: string;
  label: string;
  placeholder?: string;
  hint?: string;
  type: FinanceFieldType;
  /** for type 'select': the accepted values (stored lowercased). */
  options?: string[];
  required?: boolean;
  /** this field supplies offers.effective_price — the number the feed sorts on and the card shows big. */
  price?: boolean;
  /** this field supplies attributes.unit — the label printed under the big number. */
  unit?: boolean;
  maxLen?: number;
}

const L = (f: FinanceField): FinanceField => ({ maxLen: 160, ...f });

/** The four verticals' own field sets, in the order the form should ask for them. */
export const FINANCE_FIELDS: Record<FinanceVertical, FinanceField[]> = {
  loans: [
    L({ key: 'loan_type', label: 'Loan type', type: 'select', required: true, maxLen: 60,
      options: ['personal loan', 'home loan', 'car loan', 'business loan', 'gold loan', 'education loan'],
      hint: 'Card isi type ki list me jaayegi (personal / home / car …)' }),
    L({ key: 'interest_rate', label: 'Interest rate shown', type: 'text', required: true, unit: true,
      placeholder: '10.25% p.a.', hint: 'Card pe bada number ke neeche yahi label chhapta hai' }),
    L({ key: 'interest_rate_min', label: 'Lowest rate (number)', type: 'number', required: true, price: true,
      placeholder: '10.25', hint: 'Feed isi number par sort hoti hai — sirf number, % nahi' }),
    L({ key: 'interest_rate_max', label: 'Highest rate (number)', type: 'number', placeholder: '14.5' }),
    L({ key: 'processing_fee', label: 'Processing fee', type: 'text', placeholder: '₹1,999 + GST / 0.5%' }),
    L({ key: 'tenure_or_amount', label: 'Tenure / amount', type: 'text', placeholder: '1–5 yrs · ₹50,000–₹7.5L' }),
    L({ key: 'foreclosure_charges', label: 'Foreclosure / prepayment', type: 'text', placeholder: 'Nil after 12 EMIs' }),
    L({ key: 'disbursal_time', label: 'Disbursal time', type: 'text', placeholder: '24 hours' }),
    L({ key: 'eligibility', label: 'Eligibility', type: 'text', placeholder: 'Salaried · ₹25,000/mo · 21–60 yrs' }),
  ],
  creditcards: [
    L({ key: 'bank', label: 'Card issuer (bank)', type: 'text', required: true, placeholder: 'HDFC Bank',
      hint: 'Khali chhodo to "Bank / insurer / broker" wala naam le liya jaayega' }),
    L({ key: 'network', label: 'Card network', type: 'select', maxLen: 40,
      options: ['Visa', 'Mastercard', 'RuPay', 'American Express', 'Diners Club'] }),
    L({ key: 'joining_fee', label: 'Joining fee', type: 'text', required: true, placeholder: '₹99 + GST' }),
    L({ key: 'joining_fee_inr', label: 'Joining fee (number)', type: 'number', placeholder: '99' }),
    // unit: the fee line also labels the entry in the admin list and under the big number if this row ever
    // renders through the generic card (the credit-card card itself prints its own ₹x / yr ring).
    L({ key: 'annual_fee', label: 'Annual / renewal fee', type: 'text', required: true, unit: true, placeholder: '₹99 + GST ya Lifetime Free' }),
    L({ key: 'annual_fee_inr', label: 'Annual fee (number)', type: 'number', price: true, placeholder: '99',
      hint: 'Card par ₹99 / yr ring aur feed sorting isi se banti hai' }),
    L({ key: 'reward_rate', label: 'Reward rate', type: 'text', placeholder: '1–3%' }),
    L({ key: 'apr', label: 'APR', type: 'text', placeholder: '43.2%' }),
    L({ key: 'forex_markup', label: 'Forex markup', type: 'text', placeholder: '3.5%' }),
    L({ key: 'best_for', label: 'Best for', type: 'text', placeholder: 'Shopping / Travel / Fuel' }),
    L({ key: 'welcome_benefit', label: 'Welcome benefit', type: 'text', placeholder: '₹500 Amazon voucher' }),
    L({ key: 'domestic_lounge', label: 'Domestic lounge', type: 'text', placeholder: '2 per quarter' }),
    L({ key: 'international_lounge', label: 'International lounge', type: 'text', placeholder: '1 per year' }),
    L({ key: 'fuel_surcharge_waiver', label: 'Fuel surcharge waiver', type: 'text', placeholder: '1% up to ₹250' }),
    L({ key: 'rating', label: 'Rating (0–5)', type: 'number', placeholder: '4.5' }),
  ],
  insurance: [
    L({ key: 'insurance_type', label: 'Insurance type', type: 'select', required: true, maxLen: 60,
      options: ['health insurance', 'term life insurance', 'motor insurance', 'travel insurance', 'personal accident'],
      hint: 'Health / term / motor / travel — card isi category me dikhega' }),
    L({ key: 'claim_settlement_ratio', label: 'Claim settlement ratio (%)', type: 'number', required: true, price: true,
      placeholder: '98', hint: 'Insurance feed isi % par sort hoti hai (scraped rows bhi yehi dete hain)' }),
    L({ key: 'premium', label: 'Premium from', type: 'text', required: true, unit: true,
      placeholder: 'from ₹499/mo', hint: 'Card par bade number ke neeche yahi line chhapti hai' }),
    L({ key: 'sum_insured', label: 'Sum insured / cover', type: 'text', placeholder: '₹5L–₹1Cr' }),
    L({ key: 'network', label: 'Network hospitals', type: 'text', placeholder: '8,000+ cashless hospitals' }),
    L({ key: 'waiting_period', label: 'Waiting period', type: 'text', placeholder: '30 days' }),
    L({ key: 'age_limit', label: 'Entry age', type: 'text', placeholder: '18–65 yrs' }),
    L({ key: 'policy_term', label: 'Policy term', type: 'text', placeholder: '1 year renewable' }),
  ],
  account: [
    L({ key: 'account_type', label: 'Account type', type: 'select', required: true, maxLen: 60,
      options: ['savings', 'zero-balance savings', 'current', 'demat', 'trading'],
      hint: 'Savings / current / demat — card apni list me jaayega' }),
    L({ key: 'interest_rate', label: 'Rate label shown', type: 'text', required: true, unit: true,
      placeholder: '2.5% p.a. (highest slab)', hint: 'Demat/trading ke liye AMC likh do, jaise "₹300 AMC per year"' }),
    L({ key: 'interest_rate_max', label: 'Rate / charge (number)', type: 'number', required: true, price: true,
      placeholder: '2.5', hint: 'Savings: highest slab % · Demat: AMC rupees' }),
    L({ key: 'interest_rate_min', label: 'Lowest slab (number)', type: 'number', placeholder: '2.5' }),
    L({ key: 'monthly_average_balance', label: 'Monthly average balance', type: 'text', placeholder: '₹10,000' }),
    L({ key: 'debit_card', label: 'Debit card / perks', type: 'text', placeholder: 'Visa Platinum · 5% cashback' }),
    L({ key: 'benefits', label: 'Other benefits', type: 'text', placeholder: 'Free NEFT/RTGS · airport lounge' }),
    L({ key: 'maintenance_charges', label: 'Charges', type: 'text', placeholder: '₹0 with MAB' }),
  ],
};

export function fieldsForVertical(vertical: string): FinanceField[] {
  return (FINANCE_FIELDS as Record<string, FinanceField[]>)[String(vertical || '').trim().toLowerCase()] || [];
}

/** Number coercion that accepts what an owner actually types ("10.25%", "₹1,999", "2.5 p.a."). */
export function financeNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  // "10.25% p.a." -> "10.25." ; trailing separators must not turn a real number into NaN.
  const cleaned = String(v ?? '').replace(/[^0-9.-]/g, '').replace(/[.-]+$/, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export interface AppliedFields {
  ok: boolean;
  error?: string;
  /** attribute bag ready for offers.attributes (snake_case keys, card-ready vocabulary). */
  extras: Record<string, string>;
  /** offers.effective_price when a field is flagged price. */
  price?: number;
  /** attributes.unit (label under the big number). */
  unit?: string;
}

/**
 * Validate one vertical's own fields and turn them into attributes.
 * Only the vertical's declared keys are accepted, so a credit-card field can never leak into a loan row.
 */
export function applyFinanceFields(vertical: string, raw: Record<string, unknown> | null | undefined, opts?: { seller?: string }): AppliedFields {
  const fields = fieldsForVertical(vertical);
  const input = raw && typeof raw === 'object' ? raw : {};
  const extras: Record<string, string> = {};
  let price: number | undefined;
  let unit: string | undefined;

  for (const f of fields) {
    const rawVal = input[f.key];
    let val = rawVal === null || rawVal === undefined ? '' : String(rawVal).trim();

    if (!val) {
      // Credit cards: the issuer is the seller when the owner leaves it blank.
      if (f.key === 'bank' && f.required && opts?.seller) val = String(opts.seller).trim();
      if (!val) {
        if (f.required) return { ok: false, error: `${f.label} required hai`, extras, price, unit };
        continue;
      }
    }

    if (f.type === 'number') {
      const n = financeNumber(val);
      if (n === null) return { ok: false, error: `${f.label}: sirf number daalo`, extras, price, unit };
      if (f.key === 'rating' && (n < 0 || n > 5)) return { ok: false, error: 'Rating 0 se 5 ke beech honi chahiye', extras, price, unit };
      val = String(n);
      if (f.price) price = n;
    }
    if (f.type === 'select' && f.options) {
      const match = f.options.find((o) => o.toLowerCase() === val.toLowerCase());
      if (!match) return { ok: false, error: `${f.label}: ${f.options.join(' / ')} me se chuno`, extras, price, unit };
      val = match;
    }
    const cut = val.slice(0, f.maxLen || 160);
    extras[f.key] = cut;
    if (f.unit) unit = cut;
  }
  return { ok: true, extras, price, unit };
}
