/**
 * CardInsider credit-card parser (browserless, curl_cffi chrome). Verified live 14 Oct 2026:
 *  - Issuer index pages (cardinsider.com/<bank-slug>/) are SSR and link every card review page.
 *  - Each card page is SSR with labelled facts: Joining Fee, Renewal Fee, Rewards Rate, Welcome
 *    Benefits, Domestic/International Lounge, Forex Markup, Interest Rates, Fuel Surcharge Waiver,
 *    Best Suitable For, plus the card image and an editorial rating.
 * Nothing is invented: a field the page does not state stays undefined. CardInsider is the
 * DATA source only; the apply deeplink targets the issuing bank's own card page.
 */
import { createHash } from 'crypto';
import type { RawSourceItem, SourceConfig } from '../../types';
import { newRawItem } from '../../sources/contract';

export interface CardFacts {
  name: string;
  bank: string;
  network?: string;
  joiningFee?: string;
  joiningFeeInr?: number;
  annualFee?: string;
  annualFeeInr?: number;
  rewardRate?: string;
  welcomeBenefit?: string;
  domesticLounge?: string;
  intlLounge?: string;
  forexMarkup?: string;
  apr?: string;
  aprMax?: number;
  fuelWaiver?: string;
  bestFor?: string;
  rating?: number;
  imageUrl?: string;
  cardUrl: string;
}

const NA = /^(n\/?a|not applicable|nil|none|-+)$/i;
const clean = (s: string) => s.replace(/&amp;/g, '&').replace(/&#8217;|&rsquo;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** "₹1,000 + GST" -> 1000 ; "First Year Free" / "Lifetime Free" / "Nil" -> 0 ; unknown -> undefined. */
export function feeToInr(fee?: string): number | undefined {
  if (!fee) return undefined;
  if (/lifetime\s*free|life\s*time\s*free|^nil$|^free$|no (joining|annual|renewal) fee/i.test(fee)) return 0;
  const m = /(?:₹|rs\.?\s?)\s*([\d,]+(?:\.\d+)?)/i.exec(fee);
  if (m) return Number(m[1].replace(/,/g, ''));
  return undefined;
}

/** Split page into text lines (labels and values alternate in CardInsider's markup). */
function linesOf(html: string): string[] {
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/gi, ' ');
  return body.replace(/<[^>]+>/g, '\n').split('\n').map(clean).filter(Boolean);
}

/** Value following the FIRST exact label occurrence at/after `from`. */
function valueAfter(lines: string[], label: string, from = 0, to = lines.length): string | undefined {
  const i = lines.findIndex((l, k) => k >= from && k < to && l.toLowerCase() === label.toLowerCase());
  if (i < 0 || i + 1 >= lines.length) return undefined;
  const v = lines[i + 1];
  if (!v || NA.test(v)) return undefined;
  return v;
}

export function detectNetwork(text: string): string | undefined {
  if (/rupay/i.test(text)) return 'RuPay';
  if (/diners/i.test(text)) return 'Diners Club';
  if (/american express|\bamex\b/i.test(text)) return 'American Express';
  if (/mastercard|master card/i.test(text)) return 'Mastercard';
  if (/\bvisa\b/i.test(text)) return 'Visa';
  return undefined;
}

/** Highest annual percentage out of "3.75% Per Month (45% Annually)" style strings. */
function parseApr(interest?: string): { apr?: string; aprMax?: number } {
  if (!interest) return {};
  const ann = /(\d{1,2}(?:\.\d+)?)\s*%\s*(?:p\.?a\.?|annually|per annum|annual)/i.exec(interest) || /\((\d{1,2}(?:\.\d+)?)\s*%\s*annual/i.exec(interest);
  if (ann) return { apr: `${ann[1]}%`, aprMax: Number(ann[1]) };
  const mo = /(\d{1,2}(?:\.\d+)?)\s*%\s*(?:per\s*month|p\.?m\.?|monthly)/i.exec(interest);
  if (mo) { const a = Math.round(Number(mo[1]) * 12 * 10) / 10; return { apr: `${a}%`, aprMax: a }; }
  return {};
}

/** "5% Cashback ... 1% Cashback ..." -> "1–5%" (min–max of stated percentages), else undefined. */
export function rewardRange(rate?: string): string | undefined {
  if (!rate) return undefined;
  const nums = [...rate.matchAll(/(\d{1,2}(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1])).filter((n) => n > 0 && n <= 30);
  if (!nums.length) return undefined;
  const lo = Math.min(...nums), hi = Math.max(...nums);
  return lo === hi ? `${hi}%` : `${lo}–${hi}%`;
}

export function parseCardInsiderCard(html: string, cardUrl: string): CardFacts | null {
  const lines = linesOf(html);
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  let name = h1 ? clean(h1[1].replace(/<[^>]+>/g, ' ')) : '';
  name = name.replace(/\s*[-–—|:]\s*(review|apply).*$/i, '').replace(/\s+review.*$/i, '').trim();
  if (!name || !/card/i.test(name)) return null;
  const feesFrom = Math.max(0, lines.findIndex((l) => /^fees and$/i.test(l)));
  const joining = valueAfter(lines, 'Joining Fee', feesFrom) || valueAfter(lines, 'Joining Fee');
  const renewal = valueAfter(lines, 'Renewal Fee', feesFrom) || valueAfter(lines, 'Renewal Fee') || valueAfter(lines, 'Annual Fee');
  if (!joining && !renewal) return null; // not a card review page
  const rewardsFrom = Math.max(0, lines.findIndex((l) => /^rewards and$/i.test(l)));
  // Benefits block ends where the fees block starts; labels outside it (site menu) must never be read.
  const rewardsTo = feesFrom > rewardsFrom ? feesFrom : lines.length;
  const rewardRate = valueAfter(lines, 'Rewards Rate', rewardsFrom, rewardsTo) || valueAfter(lines, 'Reward Rate', rewardsFrom, rewardsTo);
  const interest = valueAfter(lines, 'Interest Rates', feesFrom) || valueAfter(lines, 'Interest Rate', feesFrom);
  const { apr, aprMax } = parseApr(interest);
  const ratingM = /(\d(?:\.\d)?)\s*\/\s*5/.exec(lines.slice(0, 80).join(' '));
  const img = [...html.matchAll(/https:\/\/cardinsider\.com\/wp-content\/uploads\/[^"'\s)]+?\.(?:webp|png|jpg|jpeg)/gi)]
    .map((m) => m[0]).filter((u) => !/-\d{2,4}x\d{2,4}\./.test(u))[0];
  const bankSlug = /cardinsider\.com\/([a-z0-9-]+)\//i.exec(cardUrl)?.[1] || '';
  return {
    name,
    bank: BANK_NAMES[bankSlug] || bankSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    network: detectNetwork(name) || detectNetwork(valueAfter(lines, 'Card Network') || ''),
    joiningFee: joining, joiningFeeInr: feeToInr(joining),
    annualFee: renewal, annualFeeInr: feeToInr(renewal),
    rewardRate, welcomeBenefit: valueAfter(lines, 'Welcome Benefits', rewardsFrom, rewardsTo) || valueAfter(lines, 'Welcome Benefits'),
    domesticLounge: valueAfter(lines, 'Domestic Lounge', rewardsFrom, rewardsTo), intlLounge: valueAfter(lines, 'International Lounge', rewardsFrom, rewardsTo),
    forexMarkup: valueAfter(lines, 'Forex Markup', feesFrom) || valueAfter(lines, 'Forex Markup'),
    apr, aprMax, fuelWaiver: valueAfter(lines, 'Fuel Surcharge Waiver', feesFrom),
    bestFor: valueAfter(lines, 'Best Suitable For'),
    rating: ratingM ? Number(ratingM[1]) : undefined,
    imageUrl: img, cardUrl,
  };
}

export const BANK_NAMES: Record<string, string> = {
  'hdfc-bank': 'HDFC Bank', 'axis-bank': 'Axis Bank', 'sbi-card': 'SBI Card', 'icici-bank': 'ICICI Bank',
  'kotak-mahindra-bank': 'Kotak Mahindra Bank', 'idfc-first-bank': 'IDFC FIRST Bank', 'au-bank': 'AU Small Finance Bank',
  'indusind-bank': 'IndusInd Bank', 'yes-bank': 'YES Bank', 'bank-of-baroda': 'Bank of Baroda', 'american-express': 'American Express',
  'standard-chartered': 'Standard Chartered', 'hsbc': 'HSBC', 'rbl-bank': 'RBL Bank', 'federal-bank': 'Federal Bank',
  'indian-bank': 'Indian Bank', 'pnb': 'Punjab National Bank', 'bobcard': 'BOBCARD', 'onecard': 'OneCard',
};

/** Card review links on an issuer index page: <slug>/<card>-credit-card/ only (guides and tools excluded). */
export function parseIssuerIndex(html: string, bankSlug: string): string[] {
  const re = new RegExp(`https://cardinsider\\.com/${bankSlug}/([a-z0-9-]+)/`, 'gi');
  const out = new Set<string>();
  for (const m of html.matchAll(re)) {
    const slug = m[1];
    if (!/credit-card$/.test(slug)) continue;
    if (/^(best|check|credit-card|hdfc-bank-credit-cards|how|add-on|.*-vs-.*|.*lifetime-free.*|.*forex.*|.*lounge.*|.*customer-care.*|.*bill-payment.*|.*pin-generation.*|.*eligibility.*|.*application-status.*|.*limit.*|.*login.*)/.test(slug)) continue;
    out.add(m[0]);
  }
  return [...out];
}

/** Issuing banks' own card pages (apply deeplink = price-owning site per owner policy). */
export function bankCardUrl(bankSlug: string, cardName: string): string {
  const q = encodeURIComponent(cardName);
  const BASE: Record<string, string> = {
    'hdfc-bank': 'https://www.hdfc.bank.in/credit-cards',
    'sbi-card': 'https://www.sbicard.com/en/personal/credit-cards.page',
    'axis-bank': 'https://www.axis.bank.in/cards/credit-card',
    'icici-bank': 'https://www.icici.bank.in/personal-banking/cards/credit-card',
    'idfc-first-bank': 'https://www.idfcfirst.bank.in/credit-card',
    'kotak-mahindra-bank': 'https://www.kotak.com/en/personal-banking/cards/credit-cards.html',
    'indusind-bank': 'https://www.indusind.bank.in/in/en/personal/cards/credit-card.html',
    'au-bank': 'https://www.aubank.in/personal-banking/credit-cards',
    'yes-bank': 'https://www.yesbank.in/personal-banking/yes-individual/cards/credit-cards',
    'bank-of-baroda': 'https://www.bobcard.co.in/credit-cards',
    'american-express': 'https://www.americanexpress.com/in/credit-cards/',
    'standard-chartered': 'https://www.sc.com/in/credit-cards/',
    'rbl-bank': 'https://www.rblbank.com/product/cards/credit-cards',
    'hsbc': 'https://www.hsbc.co.in/credit-cards/',
  };
  return BASE[bankSlug] || `https://cardinsider.com/${bankSlug}/`;
}

export function cardToRawItem(c: CardFacts, source: SourceConfig, bankSlug: string, fingerprintSeed: string): RawSourceItem {
  const attrs: Record<string, any> = {
    bank: c.bank,
    ...(c.network ? { network: c.network } : {}),
    ...(c.joiningFee ? { joining_fee: c.joiningFee } : {}),
    ...(c.joiningFeeInr !== undefined ? { joining_fee_inr: String(c.joiningFeeInr) } : {}),
    ...(c.annualFee ? { annual_fee: c.annualFee } : {}),
    ...(c.annualFeeInr !== undefined ? { annual_fee_inr: String(c.annualFeeInr) } : {}),
    ...(c.rewardRate ? { reward_rate_text: c.rewardRate.slice(0, 220) } : {}),
    ...(rewardRange(c.rewardRate) ? { reward_rate: rewardRange(c.rewardRate) } : {}),
    ...(c.welcomeBenefit ? { welcome_benefit: c.welcomeBenefit.slice(0, 160) } : {}),
    ...(c.domesticLounge ? { domestic_lounge: c.domesticLounge.slice(0, 160) } : {}),
    ...(c.intlLounge ? { international_lounge: c.intlLounge.slice(0, 160) } : {}),
    ...(c.forexMarkup ? { forex_markup: c.forexMarkup } : {}),
    ...(c.apr ? { apr: c.apr } : {}),
    ...(c.fuelWaiver ? { fuel_waiver: c.fuelWaiver.slice(0, 200) } : {}),
    ...(c.bestFor ? { best_for: c.bestFor } : {}),
    ...(c.rating !== undefined ? { rating: String(c.rating) } : {}),
    ...(c.imageUrl ? { image_url: c.imageUrl } : {}),
    card_page: c.cardUrl,
    price_basis: 'annual (renewal) fee published for the card; rewards and APR as stated by the issuer',
    data_note: `Fees, rewards and APR as published (via CardInsider review of the issuer's terms), observed ${new Date().toISOString().slice(0, 10)}; final eligibility and charges are decided by the bank on application`,
  };
  return newRawItem(source, {
    title: c.name.slice(0, 200),
    seller: c.bank,
    sellerUrl: bankCardUrl(bankSlug, c.name),
    currency: 'INR',
    price: c.annualFeeInr, // comparable metric: yearly fee (0 = lifetime free). undefined when the page does not state it
    attributes: attrs,
    evidence: {
      sourceUrl: c.cardUrl,
      sourceReference: `${bankSlug}:${c.name}`,
      rawFingerprint: createHash('sha256').update(fingerprintSeed.slice(0, 40000)).digest('hex'),
      extractedFields: ['name', 'bank', ...(c.joiningFee ? ['joining_fee'] : []), ...(c.annualFee ? ['annual_fee'] : []), ...(c.rewardRate ? ['reward_rate'] : []), ...(c.apr ? ['apr'] : [])],
    },
  });
}
