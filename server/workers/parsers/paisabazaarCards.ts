/**
 * Paisabazaar credit-card page parser (browserless SSR, verified live 14 Oct 2026).
 * Card pages live at paisabazaar.com/<bank-slug>/<card>-credit-card/ and carry labelled
 * "Joining Fee" / "Annual Fee" rows. Used as an INDEPENDENT second source so the same card
 * can be compared across websites (fee differences are surfaced, never averaged away).
 */
import { createHash } from 'crypto';
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';
import { feeToInr, detectNetwork, bankCardUrl, BANK_NAMES } from './cardInsider';

const clean = (s: string) => s.replace(/&amp;/g, '&').replace(/&#8217;|&rsquo;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export interface PbCard { name: string; bank: string; joiningFee?: string; annualFee?: string; annualFeeInr?: number; imageUrl?: string; network?: string; url: string }

export function parsePaisabazaarCard(html: string, url: string): PbCard | null {
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const name = h1 ? clean(h1[1].replace(/<[^>]+>/g, ' ')) : '';
  if (!name || !/credit card/i.test(name)) return null;
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/gi, ' ');
  const L = body.replace(/<[^>]+>/g, '\n').split('\n').map(clean).filter(Boolean);
  const feesAt = L.findIndex((l) => /^fees\s*&\s*charges$/i.test(l));
  const val = (label: string) => {
    const i = L.findIndex((l, k) => k >= Math.max(0, feesAt - 6) && l.toLowerCase() === label.toLowerCase());
    return i >= 0 ? L[i + 1] : undefined;
  };
  const joining = val('Joining Fee');
  const annual = val('Annual Fee');
  if (!joining && !annual) return null;
  const bankSlug = /paisabazaar\.com\/([a-z0-9-]+)\//i.exec(url)?.[1] || '';
  const imgs = [...html.matchAll(/https:\/\/www\.paisabazaar\.com\/wp-content\/uploads\/[^"'\s)]+\.(?:webp|png|jpg|jpeg)/gi)].map((m) => m[0]);
  const slugWords = name.toLowerCase().split(/\W+/).filter((w) => w.length > 3 && w !== 'credit' && w !== 'card');
  const img = imgs.find((u) => slugWords.some((w) => u.toLowerCase().includes(w))) ;
  return { name, bank: BANK_NAMES[bankSlug] || bankSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), joiningFee: joining, annualFee: annual, annualFeeInr: feeToInr(annual), imageUrl: img, network: detectNetwork(name), url };
}

/** Card review links on a Paisabazaar issuer index: /<bank>/<card>-credit-card/ (guides excluded). */
export function parsePaisabazaarIndex(html: string, bankSlug: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(new RegExp(`https://www\\.paisabazaar\\.com/${bankSlug}/([a-z0-9-]+)/`, 'gi'))) {
    const s = m[1];
    if (!/credit-card$/.test(s) || /^(credit-card|best|how|check|.*fees-charges|.*offers|.*-vs-.*|.*bill-payment.*|.*limit.*|.*login.*|.*customer-care.*|.*eligibility.*)$/.test(s)) continue;
    out.add(m[0]);
  }
  return [...out];
}

export function pbToRawItem(c: PbCard, source: SourceConfig, bankSlug: string, seed: string): RawSourceItem {
  return newRawItem(source, {
    title: c.name.slice(0, 200),
    seller: c.bank,
    sellerUrl: bankCardUrl(bankSlug, c.name),
    currency: 'INR',
    price: c.annualFeeInr,
    attributes: {
      bank: c.bank,
      ...(c.network ? { network: c.network } : {}),
      ...(c.joiningFee ? { joining_fee: c.joiningFee } : {}),
      ...(c.annualFee ? { annual_fee: c.annualFee } : {}),
      ...(c.annualFeeInr !== undefined ? { annual_fee_inr: String(c.annualFeeInr) } : {}),
      ...(c.imageUrl ? { image_url: c.imageUrl } : {}),
      card_page: c.url,
      price_basis: 'annual (renewal) fee published for the card',
      data_note: `Fees as published on Paisabazaar's card page, observed ${new Date().toISOString().slice(0, 10)}; the bank decides final charges on application`,
    },
    evidence: {
      sourceUrl: c.url,
      sourceReference: `${bankSlug}:${c.name}`,
      rawFingerprint: createHash('sha256').update(seed.slice(0, 40000)).digest('hex'),
      extractedFields: ['name', 'bank', ...(c.joiningFee ? ['joining_fee'] : []), ...(c.annualFee ? ['annual_fee'] : [])],
    },
  });
}
