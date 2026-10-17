/**
 * Generic "published rates page" parser — loans & insurance verticals.
 *
 * Many Indian lender/insurer pages publish their rate tables as server-rendered
 * HTML tables plus JSON-LD (FinancialProduct / Product) blocks. This parser
 * extracts ONLY what the page actually says: interest-rate ranges, processing
 * fees, loan amounts, sum insured, plan names, starting premiums. Nothing is
 * invented — a field the page does not state stays absent.
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export interface RateFacts {
  rateMin?: number;
  rateMax?: number;
  processingFee?: string;
  loanAmount?: string;
  tenure?: string;
  sumInsured?: string;
  startingPremium?: string;
  planName?: string;
  imageUrl?: string;
}

/** All JSON-LD blocks in the page, parsed. Malformed blocks are skipped. */
export function jsonLdBlocks(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try { out.push(JSON.parse(m[1].trim())); } catch { /* skip malformed */ }
  }
  return out;
}

/** Flatten nested JSON-LD (@graph, itemListElement) into a single list. */
export function flattenLd(nodes: any[]): any[] {
  const out: any[] = [];
  const walk = (n: any) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    out.push(n);
    if (Array.isArray(n['@graph'])) n['@graph'].forEach(walk);
    if (Array.isArray(n.itemListElement)) n.itemListElement.forEach((e: any) => walk(e.item || e));
  };
  nodes.forEach(walk);
  return out;
}

/**
 * Extract a rate range from page text/JSON-LD. A page stating
 * "10.50% - 16% p.a." yields { rateMin: 10.5, rateMax: 16 }.
 * Looks for the "X% ... Y% p.a." pattern; single rates become min=max.
 */
export function extractRateRange(text: string): { min?: number; max?: number } {
  // Range without a required "p.a." suffix: lender pages increasingly publish
  // "9.99% - 24.00%" in plain table cells (HDFC rack-rate table, 13 Oct 2026).
  const ranged = /(\d{1,2}(?:\.\d{1,2})?)\s*%\s*(?:to|–|-|—|till|upto|up to)\s*(\d{1,2}(?:\.\d{1,2})?)\s*%/i.exec(text);
  if (ranged) return { min: Number(ranged[1]), max: Number(ranged[2]) };
  const single = /(?:starting (?:at|from|as low as)|from|as low as|at)\s*(\d{1,2}(?:\.\d{1,2})?)\s*%\s*(?:p\.?\s?a\.?|per annum)/i.exec(text)
    || /(\d{1,2}(?:\.\d{1,2})?)\s*%\s*p\.?\s?a\.?/i.exec(text);
  if (single) { const v = Number(single[1]); return { min: v, max: v }; }
  return {};
}

/** Extract real og:image URL from HTML if present and valid https. */
export function extractOgImage(html: string): string | undefined {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (!m) return undefined;
  const url = m[1].replace(/&amp;/g, '&').trim();
  if (url.startsWith('https://')) return url;
  return undefined;
}

/** Processing fee text, e.g. "Processing Fee: Upto 2.50% of the loan amount". */
export function extractProcessingFee(text: string): string | undefined {
  const m = /processing fee[^<]{0,120}?((?:upto|up to)?\s*\d{1,2}(?:\.\d+)?\s*%[^<]{0,60})/i.exec(text);
  return m ? m[1].trim() : undefined;
}

/** Loan amount range text, e.g. "₹50,000 to ₹40 lakh". */
export function extractLoanAmount(text: string): string | undefined {
  const m = /(?:loan amount[^<]{0,80}?)((?:₹|rs\.?\s?)?\d[\d,\.]{1,11}\s*(?:to|-|–|upto|up to)\s*(?:₹|rs\.?\s?)?[\d,\.]{1,11}\s*(?:lakh|lakhs|crore|cr)?)/i.exec(text);
  return m ? m[1].trim() : undefined;
}

/** Tenure text, e.g. "up to 6 years (72 months)". */
export function extractTenure(text: string): string | undefined {
  const m = /(?:tenure|repayment[^<]{0,40}?)((?:up to\s*)?\d{1,2}\s*(?:years?|months?)\s*(?:\(\d{1,3}\s*months?\))?)/i.exec(text);
  return m ? m[1].trim() : undefined;
}

/** Build ONE honest rate offer from whatever facts the page actually published. */
export function buildRateOffer(
  source: SourceConfig,
  opts: {
    seller: string;
    sellerUrl: string;
    pageUrl: string;
    loanType?: string;
    insuranceType?: string;
    planName?: string;
    facts: RateFacts;
    evidenceNote: string;
    extraAttributes?: Record<string, any>;
  },
): RawSourceItem {
  const attrs: Record<string, any> = {
    ...(opts.loanType ? { loan_type: opts.loanType } : {}),
    ...(opts.insuranceType ? { insurance_type: opts.insuranceType } : {}),
    ...(opts.planName ? { plan_name: opts.planName } : {}),
    ...(opts.facts.rateMin !== undefined ? { interest_rate: String(opts.facts.rateMin) } : {}),
    ...(opts.facts.rateMin !== undefined ? { interest_rate_min: String(opts.facts.rateMin) } : {}),
    ...(opts.facts.rateMin !== undefined ? { rate_type: 'indicative' } : {}),
    ...(opts.facts.sumInsured ? { quote_type: 'indicative' } : {}),
    ...(opts.facts.rateMax !== undefined ? { interest_rate_max: String(opts.facts.rateMax) } : {}),
    ...(opts.facts.processingFee ? { processing_fee: opts.facts.processingFee } : {}),
    ...(opts.facts.loanAmount ? { loan_amount: opts.facts.loanAmount } : {}),
    ...(opts.facts.tenure ? { tenure: opts.facts.tenure } : {}),
    ...(opts.facts.sumInsured ? { sum_insured: opts.facts.sumInsured } : {}),
    ...(opts.facts.startingPremium ? { starting_premium: opts.facts.startingPremium } : {}),
    ...(opts.facts.imageUrl ? { image_url: opts.facts.imageUrl } : {}),
    price_basis: opts.facts.rateMin !== undefined ? 'published annual interest-rate range, indicative — never an approved offer' : 'published plan information',
    data_note: opts.evidenceNote,
    ...(opts.extraAttributes || {}),
  };
  const bits = [
    opts.planName,
    opts.facts.rateMin !== undefined ? `${opts.facts.rateMin}${opts.facts.rateMax && opts.facts.rateMax !== opts.facts.rateMin ? `–${opts.facts.rateMax}` : ''}% p.a.` : '',
    opts.facts.sumInsured ? `Cover ${opts.facts.sumInsured}` : '',
  ].filter(Boolean);
  const title = bits.join(' · ') || `${opts.seller} published rates`;
  return newRawItem(source, {
    title,
    seller: opts.seller,
    sellerUrl: opts.sellerUrl,
    currency: 'INR',
    price: undefined, // a published rate/premium schedule is not a single purchasable price
    attributes: attrs,
    evidence: {
      sourceUrl: opts.pageUrl,
      extractedFields: Object.keys(attrs),
    },
  });
}

/** Collect every percentage rate mentioned in JSON-LD rate/interestRate fields. */
export function ldRates(html: string): number[] {
  const vals: number[] = [];
  for (const node of flattenLd(jsonLdBlocks(html))) {
    for (const key of ['interestRate', 'annualPercentageRate', 'rate']) {
      const raw = node[key];
      const num = typeof raw === 'string' ? parseFloat(raw.replace(/[^\d.]/g, '')) : Number(raw);
      if (Number.isFinite(num) && num > 0 && num < 100) vals.push(num);
    }
  }
  return vals;
}
