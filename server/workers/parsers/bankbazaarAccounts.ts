/**
 * Bank-account parsers (India). Savings / current / demat account facts
 * published as static tables on BankBazaar, Paisabazaar and the brokers'
 * own pricing pages. All rows are INDICATIVE published figures — never an
 * approved offer. Verified live 21 Oct 2026 (plain browserless HTTP 200).
 *
 * Price conventions (comparable value per row):
 *   savings  -> highest published interest slab (% p.a.; higher is better)
 *   current  -> monthly average balance requirement (₹; lower is better)
 *   demat    -> annual maintenance charge (₹/yr; lower is better; ₹0 stays 0)
 */
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

const today = () => new Date().toISOString().slice(0, 10);

function rateSlabs(text: string): { min?: number; max?: number } {
  const nums = [...text.matchAll(/(\d{1,2}(?:\.\d{1,2})?)\s*%/g)].map((m) => Number(m[1])).filter((n) => n > 0 && n < 15);
  if (!nums.length) return {};
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

/** "Rs.75,000" | "Rs.1 lakh (quarterly)" | "₹ 0" -> number of rupees. */
function rupees(text: string): number | undefined {
  const lakh = /(\d+(?:\.\d+)?)\s*(?:lakh|lac)/i.exec(text);
  if (lakh) return Math.round(Number(lakh[1]) * 100_000);
  const m = /(?:₹|rs\.?\s*)\s*([\d,]+(?:\.\d+)?)/i.exec(text.replace(/&#8377;/g, '₹'));
  if (!m) return undefined;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

/** BankBazaar savings page: rows "<a href=...>State Bank of India</a> | 2.50% p.a. to 4.85% p.a." */
export function parseBankBazaarSavings(html: string, source: SourceConfig, pageUrl: string): RawSourceItem[] {
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    if (cells.length < 2) continue;
    const name = cells[0];
    if (!name || !/bank/i.test(name) || name.length > 60) continue;
    const { min, max } = rateSlabs(cells[1]);
    if (max === undefined) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const href = /<a[^>]+href="([^"]+)"[^>]*>/i.exec(row)?.[1];
    const sellerUrl = href ? (href.startsWith('http') ? href : `https://www.bankbazaar.com${href}`) : pageUrl;
    out.push(newRawItem(source, {
      title: `${name} Savings Account`.slice(0, 120),
      price: max, // highest published slab — the number a saver compares on
      currency: 'INR',
      seller: 'BankBazaar',
      sellerUrl,
      availability: 'in_stock',
      attributes: {
        account_type: 'savings',
        interest_rate: String(max),
        interest_rate_min: String(min),
        interest_rate_max: String(max),
        price_unit: '% p.a. (highest slab)',
        rate_type: 'indicative',
        price_basis: 'published savings interest-rate slabs, indicative — never a guaranteed rate',
        data_note: `Rates published on BankBazaar's savings-account rate table, observed ${today()}`,
      },
      evidence: { sourceUrl: pageUrl, extractedFields: ['interest_rate_min', 'interest_rate_max', 'account_type'] },
    }));
  }
  return out;
}

/** BankBazaar current-account page: rows "HDFC Bank | Rs.75,000 | 10 times the MAB". */
export function parseBankBazaarCurrent(html: string, source: SourceConfig, pageUrl: string): RawSourceItem[] {
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    if (cells.length < 2) continue;
    const name = cells[0];
    if (!name || !/bank/i.test(name) || name.length > 60) continue;
    const mab = rupees(cells[1]);
    if (mab === undefined) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(newRawItem(source, {
      title: `${name} Current Account`.slice(0, 120),
      price: mab, // monthly average balance requirement (₹)
      currency: 'INR',
      seller: 'BankBazaar',
      sellerUrl: pageUrl,
      availability: 'in_stock',
      attributes: {
        account_type: 'current',
        min_balance: String(mab),
        price_unit: 'monthly average balance',
        ...(cells[2] ? { deposit_limit: cells[2].slice(0, 100) } : {}),
        price_basis: 'published monthly-average-balance requirement, indicative',
        data_note: `MAB published on BankBazaar's current-account table, observed ${today()}`,
      },
      evidence: { sourceUrl: pageUrl, extractedFields: ['min_balance', 'account_type'] },
    }));
  }
  return out;
}

/** BankBazaar demat page: "Charge Type | Typical Range | Notes" table (one summary row). */
export function parseBankBazaarDemat(html: string, source: SourceConfig, pageUrl: string): RawSourceItem[] {
  const out: RawSourceItem[] = [];
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  const attrs: Record<string, string> = {
    account_type: 'demat',
    price_basis: 'published general demat charges, indicative',
    data_note: `Charges published on BankBazaar's demat-account guide, observed ${today()}`,
  };
  let sawChargeTable = false;
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim());
    if (cells.length < 2) continue;
    const label = cells[0];
    if (/^charge type/i.test(label)) { sawChargeTable = true; continue; }
    if (!sawChargeTable) continue;
    if (/account opening/i.test(label)) attrs.account_opening_fee = cells[1].slice(0, 80);
    else if (/annual maintenance|\bAMC\b/i.test(label)) attrs.amc = cells[1].slice(0, 80);
    else if (/transaction charge/i.test(label)) attrs.transaction_charge = cells[1].slice(0, 80);
    else if (/pledge/i.test(label)) attrs.pledge_charge = cells[1].slice(0, 80);
    else if (/delivery instruction/i.test(label)) attrs.dis_charge = cells[1].slice(0, 80);
    if (cells[2] && /BSDA/i.test(cells[2])) attrs.bsda_note = cells[2].slice(0, 160);
  }
  if (!attrs.account_opening_fee && !attrs.amc) return []; // page carried no publishable charge
  return [newRawItem(source, {
    title: 'Basic Demat Account (across brokers)',
    currency: 'INR',
    seller: 'BankBazaar',
    sellerUrl: pageUrl,
    availability: 'in_stock',
    attributes: attrs,
    evidence: { sourceUrl: pageUrl, extractedFields: Object.keys(attrs) },
  })];
}

/** Paisabazaar savings page: rows "<a>Bank of India</a> | 4.85% | Above Rs. 2500 Crore". */
export function parsePaisabazaarSavings(html: string, source: SourceConfig, pageUrl: string): RawSourceItem[] {
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim());
    if (cells.length < 2) continue;
    const name = cells[0];
    if (!name || !/bank/i.test(name) || name.length > 60) continue;
    const { max } = rateSlabs(cells[1]);
    if (max === undefined) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const href = /<a[^>]+href="([^"]+)"[^>]*>/i.exec(row)?.[1];
    const sellerUrl = href ? (href.startsWith('http') ? href : `https://www.paisabazaar.com${href}`) : pageUrl;
    out.push(newRawItem(source, {
      title: `${name} Savings Account`.slice(0, 120),
      price: max,
      currency: 'INR',
      seller: 'Paisabazaar',
      sellerUrl,
      availability: 'in_stock',
      attributes: {
        account_type: 'savings',
        interest_rate: String(max),
        interest_rate_max: String(max),
        price_unit: '% p.a. (highest slab)',
        rate_type: 'indicative',
        ...(cells[2] ? { balance_requirement: cells[2].slice(0, 100) } : {}),
        price_basis: 'published highest savings interest slab, indicative — never a guaranteed rate',
        data_note: `Highest rate published on Paisabazaar's savings-account table, observed ${today()}`,
      },
      evidence: { sourceUrl: pageUrl, extractedFields: ['interest_rate_max', 'account_type'] },
    }));
  }
  return out;
}

/** Zerodha's own charges page: "₹500 Demat AMC ... Free for first year*". */
export function parseZerodhaCharges(html: string, source: SourceConfig, pageUrl: string): RawSourceItem[] {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&#8377;/g, '₹').replace(/\s+/g, ' ');
  const m = /₹\s*(\d{2,5})[^₹]{0,80}Demat AMC/i.exec(text) || /Demat AMC[^₹]{0,80}₹\s*(\d{2,5})/i.exec(text);
  const amc = m ? Number(m[1]) : undefined;
  const freeFirstYear = /free for first year/i.test(text);
  if (amc === undefined && !freeFirstYear) return []; // page carried no publishable charge
  return [newRawItem(source, {
    title: 'Zerodha Demat Account',
    price: amc, // AMC per year from the second year (₹ per year, lower is better)
    currency: 'INR',
    seller: 'Zerodha',
    sellerUrl: pageUrl,
    availability: 'in_stock',
    attributes: {
      account_type: 'demat',
      ...(amc !== undefined ? { amc: `₹${amc} per year${freeFirstYear ? ' (free first year)' : ''}` } : {}),
      account_opening_fee: '₹0 (equity account)',
      price_unit: 'demat AMC per year',
      price_basis: 'published on Zerodha\'s own charges page, indicative',
      data_note: `Demat charges published on Zerodha's charges page, observed ${today()}`,
    },
    evidence: { sourceUrl: pageUrl, extractedFields: ['amc', 'account_type'] },
  })];
}

/** Groww's own pricing page: "Account Maintenance Charges ₹ 0". */
export function parseGrowwCharges(html: string, source: SourceConfig, pageUrl: string): RawSourceItem[] {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&#8377;/g, '₹').replace(/\s+/g, ' ');
  const m = /Account Maintenance Charges[^₹0-9]{0,30}(₹|Rs\.?\s*)\s*([\d,]+)/i.exec(text) || /Account Maintenance Charges[^"]{0,10}"amount":"(\d+)"/i.exec(text);
  const amount = m ? Number((m[2] ?? m[1]).replace(/,/g, '')) : undefined;
  const brokerage = /equity brokerage[^₹]{0,10}₹\s*([\d.]+)/i.exec(text);
  if (amount === undefined && !brokerage) return [];
  return [newRawItem(source, {
    title: 'Groww Demat Account',
    price: amount, // ₹0 AMC means genuinely zero — price stays 0/undefined, honest
    currency: 'INR',
    seller: 'Groww',
    sellerUrl: pageUrl,
    availability: 'in_stock',
    attributes: {
      account_type: 'demat',
      amc: `₹${amount ?? 0} per year`,
      account_opening_fee: '₹0',
      ...(brokerage ? { brokerage: `₹${brokerage[1]} or 0.1% per executed order, whichever is lower` } : {}),
      price_unit: 'demat AMC per year',
      price_basis: 'published on Groww\'s own pricing page, indicative',
      data_note: `Demat charges published on Groww's pricing page, observed ${today()}`,
    },
    evidence: { sourceUrl: pageUrl, extractedFields: ['amc', 'account_type'] },
  })];
}
