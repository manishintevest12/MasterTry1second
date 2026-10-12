/**
 * BankBazaar insurance-table parser. Verified live: term/health/car insurance pages
 * render real per-insurer tables — plan names, Claim Settlement Ratio (CSR),
 * network garages / network hospitals. Premiums require a personalized quote flow
 * and are NOT on the page; they stay unknown (never invented).
 */
import { createHash } from 'crypto';
import * as cheerio from 'cheerio';
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export function parseBankBazaarInsurance(html: string, source: SourceConfig, pageUrl: string, insType: string): RawSourceItem[] {
  const $ = cheerio.load(html);
  const fingerprint = createHash('sha256').update(html.slice(0, 50000)).digest('hex');
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  $('table').each((_, table) => {
    const rows = $(table).find('tr').toArray().map((tr) => $(tr).find('th,td').toArray().map((c) => $(c).text().replace(/\s+/g, ' ').trim()));
    if (rows.length < 3) return;
    const header = rows[0].map((h) => h.toLowerCase());
    const insIdx = header.findIndex((h) => /insur|company|provider|bank/.test(h));
    const csrIdx = header.findIndex((h) => /claim settlement|csr/.test(h));
    if (insIdx < 0 || csrIdx < 0) return;
    const planIdx = header.findIndex((h) => /plan|term plan|policy/.test(h));
    const extraIdx = header.findIndex((h) => /garage|hospital/.test(h));
    for (const r of rows.slice(1)) {
      const insurer = (r[insIdx] || '').trim();
      if (!insurer) continue;
      const key = `${insType}:${insurer}`;
      if (seen.has(key)) continue;
      const csrMatch = (r[csrIdx] || '').match(/(\d{1,3}(?:\.\d+)?)\s*%/);
      if (!csrMatch) continue; // a row without a CSR is not a comparison row
      seen.add(key);
      const plan = planIdx >= 0 ? (r[planIdx] || '').trim() : '';
      const extra = extraIdx >= 0 ? (r[extraIdx] || '').trim() : '';
      out.push(newRawItem(source, {
        title: (plan ? `${insurer} — ${plan}` : `${insurer} ${insType}`).slice(0, 200),
        seller: insurer.replace(/\s*(insurance company|co\.?\.? ltd\.?|limited)\s*$/i, '').trim().slice(0, 120),
        sellerUrl: pageUrl,
        currency: 'INR',
        price: Number(csrMatch[1]), // CSR % — the comparable metric users rank insurers by
        attributes: {
          insurance_type: insType,
          claim_settlement_ratio: csrMatch[1],
          ...(extra ? { network: extra.slice(0, 80) } : {}),
          quote_type: 'indicative',
          data_note: 'CSR and network data from BankBazaar insurer tables; personalized premiums need insurer quote flow',
        },
        evidence: {
          sourceUrl: pageUrl,
          sourceReference: key,
          rawFingerprint: fingerprint,
          extractedFields: ['insurer', ...(plan ? ['plan'] : []), 'claim_settlement_ratio', ...(extra ? ['network'] : [])],
        },
      }));
    }
  });
  return out.slice(0, 30);
}
