/**
 * Insurance worker (India). An insurance search runs ONLY this worker.
 * Real insurer comparison data (Claim Settlement Ratio, network size, plan names)
 * from BankBazaar insurer tables. Personalized premiums are never invented.
 */
import { registerVerticalWorker, looksLikeChallenge, type VerticalWorker } from '../verticalWorker';
import { parseBankBazaarInsurance } from '../parsers/bankbazaarInsurance';
import { extractRateRange, buildRateOffer } from '../parsers/publishedRates';
import { AcquisitionError } from '../../common/httpClient';

/**
 * Insurer published plan pages (browserless SSR, verified live 13 Oct 2026).
 * Each task reads the insurer's own health-insurance page and publishes ONLY
 * the plan facts that page states (premium-from figures, sum insured tiers).
 * seller = the insurer's website (owner policy).
 */
const INSURER_PAGES: Array<{ sourceId: string; seller: string; url: string; planName: string }> = [
  { sourceId: 'w_insurance_policybazaar', seller: 'Policybazaar', url: 'https://www.policybazaar.com/health-insurance/', planName: 'Policybazaar health plans' },
  { sourceId: 'w_insurance_acko', seller: 'Acko', url: 'https://www.acko.com/health-insurance/', planName: 'Acko health plans' },
  { sourceId: 'w_insurance_digit', seller: 'Digit', url: 'https://www.godigit.com/health-insurance', planName: 'Digit health plans' },
  { sourceId: 'w_insurance_hdfcergo', seller: 'HDFC Ergo', url: 'https://www.hdfcergo.com/health-insurance', planName: 'HDFC Ergo health plans' },
];

function insurerPageTask(cfg: (typeof INSURER_PAGES)[number]) {
  return {
    sourceId: cfg.sourceId,
    name: `Insurance worker: ${cfg.seller} published plan page`,
    priority: 20,
    run: async (ctx: any) => {
      const r = await ctx.fetch(cfg.url);
      if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `${cfg.seller} HTTP ${r.status}`, r.status);
      const text = r.body.replace(/<[^>]+>/g, ' ');
      // Sum-insured tiers the page states, e.g. "₹5 lakh to ₹1 crore".
      const sumM = /(?:sum insured[^₹]{0,60}?₹\s*[\d,\.]+\s*(?:lakh|lakhs|crore)[^₹]{0,60}?₹\s*[\d,\.]+\s*(?:lakh|lakhs|crore))|(?:₹|rs\.?\s?)?\d[\d,\.]{0,11}\s*(?:lakh|lakhs|crore)\s*(?:to|-|–)\s*(?:₹|rs\.?\s?)?[\d,\.]{0,11}\s*(?:lakh|lakhs|crore)/i.exec(text);
      const premM = /(?:premium[^₹₨]{0,60}?|starting\s*(?:at|from))\s*[₹₨]?\s*\d[\d,]*(?:\.\d+)?\s*(?:per\s*(?:month|year|annum|day)|\/\s*(?:month|year)|p\.?a\.?)/i.exec(text);
      const facts: any = {
        sumInsured: sumM ? sumM[0].trim() : undefined,
        startingPremium: premM ? premM[0].trim() : undefined,
      };
      // Only publish if the page actually stated at least one plan fact.
      if (!facts.sumInsured && !facts.startingPremium) throw new AcquisitionError('EMPTY_RESPONSE', `${cfg.seller} page carried no publishable plan facts`);
      return [buildRateOffer(ctx.source, {
        seller: cfg.seller,
        sellerUrl: cfg.url,
        pageUrl: cfg.url,
        insuranceType: 'health insurance',
        planName: cfg.planName,
        facts,
        evidenceNote: `Plan terms as published on ${cfg.seller}'s own page, observed ${new Date().toISOString().slice(0, 10)}; real premiums depend on age, city and medical history`,
      })];
    },
  };
}

const PAGES: Array<{ type: string; re: RegExp; url: string }> = [
  { type: 'term life insurance', re: /term|life cover/i, url: 'https://www.bankbazaar.com/insurance/term-insurance.html' },
  { type: 'health insurance', re: /health|medical/i, url: 'https://www.bankbazaar.com/insurance/health-insurance.html' },
  { type: 'car insurance', re: /car|motor|four[- ]wheeler/i, url: 'https://www.bankbazaar.com/car-insurance.html' },
  { type: 'insurance', re: /./, url: 'https://www.bankbazaar.com/insurance/health-insurance.html' },
];

export const insuranceWorker: VerticalWorker = {
  vertical: 'insurance',
  tasks: [
    {
      sourceId: 'w_insurance_bankbazaar',
      name: 'Insurance worker: BankBazaar insurer tables (CSR)',
      priority: 10,
      run: async (ctx) => {
        const text = `${ctx.query.rawQuery || ''} ${ctx.query.entityName || ''}`;
        const page = PAGES.find((p) => p.re.test(text)) || PAGES[PAGES.length - 1];
        const r = await ctx.fetch(page.url);
        if (r.status !== 200) throw new AcquisitionError('FORBIDDEN', `BankBazaar HTTP ${r.status}`, r.status);
        const items = parseBankBazaarInsurance(r.body, ctx.source, page.url, page.type);
        if (!items.length && looksLikeChallenge(r.body)) throw new AcquisitionError('ACCESS_CHALLENGE', 'BankBazaar presented a challenge page');
        return items;
      },
    },
    ...INSURER_PAGES.map(insurerPageTask),
  ],
};
registerVerticalWorker(insuranceWorker);
