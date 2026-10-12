/**
 * BankBazaar lender-wise loan-rate table parser. Verified live: each loan page
 * (/home-loan.html, /car-loan.html, /education-loan.html, ...) renders a table whose
 * header is "Bank Name | Interest Rate | Processing Fee | ..." and one row per lender.
 * We emit one INDICATIVE offer per lender row with the published rate range.
 * The "price" for a loan offer is the lowest published rate (percent) so the standard
 * lowest-first ranking surfaces the cheapest lender; it is never a rupee amount.
 */
import { createHash } from 'crypto';
import * as cheerio from 'cheerio';
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export function parseRateRange(text: string): { min?: number; max?: number } {
  const nums = [...text.matchAll(/(\d{1,2}(?:\.\d{1,2})?)\s*%/g)].map((m) => Number(m[1])).filter((n) => n > 0 && n < 60);
  if (!nums.length) return {};
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

export function parseBankBazaarLoans(html: string, source: SourceConfig, pageUrl: string, loanType: string): RawSourceItem[] {
  const $ = cheerio.load(html);
  const fingerprint = createHash('sha256').update(html.slice(0, 50000)).digest('hex');
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  $('table').each((_, table) => {
    const rows = $(table).find('tr').toArray().map((tr) => $(tr).find('th,td').toArray().map((c) => $(c).text().replace(/\s+/g, ' ').trim()));
    if (rows.length < 3) return;
    const header = rows[0].map((h) => h.toLowerCase());
    const bankIdx = header.findIndex((h) => /bank|lender|name/.test(h));
    const rateIdx = header.findIndex((h) => /interest/.test(h));
    if (bankIdx < 0 || rateIdx < 0) return; // not a lender-rate table
    const feeIdx = header.findIndex((h) => /processing/.test(h));
    const tenureIdx = header.findIndex((h) => /tenure|amount/.test(h));
    for (const r of rows.slice(1)) {
      const lender = (r[bankIdx] || '').trim();
      const rateText = r[rateIdx] || '';
      const { min, max } = parseRateRange(rateText);
      if (!lender || min === undefined || seen.has(lender.toLowerCase())) continue;
      seen.add(lender.toLowerCase());
      const fee = feeIdx >= 0 ? (r[feeIdx] || '').slice(0, 140) : '';
      out.push(newRawItem(source, {
        title: lender.slice(0, 160),
        price: min, // lowest published p.a. rate (percent) — drives lowest-first ranking
        currency: 'INR',
        seller: lender.replace(/\s*(home|car|education|personal|business)?\s*loans?\s*$/i, '').trim() || lender,
        sellerUrl: pageUrl,
        availability: 'in_stock',
        attributes: {
          loan_type: loanType,
          interest_rate: rateText.slice(0, 120),
          interest_rate_min: String(min),
          ...(max !== undefined ? { interest_rate_max: String(max) } : {}),
          ...(fee ? { processing_fee: fee } : {}),
          ...(tenureIdx >= 0 && r[tenureIdx] ? { tenure_or_amount: r[tenureIdx].slice(0, 140) } : {}),
          rate_type: 'indicative',
          source_note: 'Published indicative rate range; final rate depends on lender approval',
        },
        evidence: {
          sourceUrl: pageUrl,
          sourceReference: `${loanType}:${lender}`,
          rawFingerprint: fingerprint,
          extractedFields: ['title', 'interest_rate', ...(fee ? ['processing_fee'] : [])],
        },
      }));
    }
  });
  return out.slice(0, 40);
}
