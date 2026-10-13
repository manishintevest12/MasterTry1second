/**
 * Loans worker (India). Pulls lender-wise published interest-rate tables.
 * Only runs for loans searches. Loan type is inferred from the query
 * (home / car / education / business / LAP / personal), default personal.
 * Rates are labelled INDICATIVE — never presented as an approved offer.
 */
import { registerVerticalWorker, looksLikeChallenge, type VerticalWorker } from '../verticalWorker';
import { parseBankBazaarLoans } from '../parsers/bankbazaarLoans';
import { extractRateRange, extractProcessingFee, extractLoanAmount, extractTenure, buildRateOffer } from '../parsers/publishedRates';
import { AcquisitionError } from '../../common/httpClient';

/**
 * Published lender rate pages (browserless SSR, verified live 13 Oct 2026).
 * Each task reads the lender's own public rate page and publishes ONLY the
 * figures that page states. seller = the lender's website (owner policy).
 */
const LENDER_PAGES: Array<{ sourceId: string; seller: string; url: string; loanType: string }> = [
  { sourceId: 'w_loans_paisabazaar', seller: 'Paisabazaar', url: 'https://www.paisabazaar.com/personal-loan/interest-rates/', loanType: 'personal loan' },
  { sourceId: 'w_loans_bajajfinserv', seller: 'Bajaj Finserv', url: 'https://www.bajajfinserv.in/personal-loan-processing-fees-and-interest-rates', loanType: 'personal loan' },
  { sourceId: 'w_loans_hdfc', seller: 'HDFC Bank', url: 'https://www.hdfcbank.com/personal/borrow/popular-loans/personal-loan/interest-rates-and-charges', loanType: 'personal loan' },
  { sourceId: 'w_loans_moneyview', seller: 'Money View', url: 'https://moneyview.in/personal-loan-interest-rates-and-charges', loanType: 'personal loan' },
];

/** Generic task factory: fetch the lender page, extract what it publishes, emit one honest offer. */
function lenderPageTask(cfg: (typeof LENDER_PAGES)[number]) {
  return {
    sourceId: cfg.sourceId,
    name: `Loans worker: ${cfg.seller} published rate page`,
    priority: 20,
    run: async (ctx: any) => {
      const r = await ctx.fetch(cfg.url);
      if (r.status !== 200) throw new AcquisitionError('SERVER_ERROR', `${cfg.seller} HTTP ${r.status}`, r.status);
      const text = r.body.replace(/<[^>]+>/g, ' ');
      const range = extractRateRange(text);
      if (range.min === undefined) throw new AcquisitionError('EMPTY_RESPONSE', `${cfg.seller} page carried no publishable rate`);
      const facts: any = {
        rateMin: range.min,
        rateMax: range.max,
        processingFee: extractProcessingFee(text),
        loanAmount: extractLoanAmount(text),
        tenure: extractTenure(text),
      };
      return [buildRateOffer(ctx.source, {
        seller: cfg.seller,
        sellerUrl: cfg.url,
        pageUrl: cfg.url,
        loanType: cfg.loanType,
        facts,
        evidenceNote: `Published on ${cfg.seller}'s own rates page, observed ${new Date().toISOString().slice(0, 10)}; indicative rates — never an approved offer`,
      })];
    },
  };
}

const PAGES: Array<{ type: string; re: RegExp; url: string }> = [
  { type: 'home loan', re: /home|housing|house|property purchase/i, url: 'https://www.bankbazaar.com/home-loan.html' },
  { type: 'car loan', re: /car|auto|vehicle/i, url: 'https://www.bankbazaar.com/car-loan.html' },
  { type: 'education loan', re: /educat|study|student|abroad/i, url: 'https://www.bankbazaar.com/education-loan.html' },
  { type: 'business loan', re: /business|msme|working capital/i, url: 'https://www.bankbazaar.com/business-loan.html' },
  { type: 'loan against property', re: /against property|lap\b|mortgage/i, url: 'https://www.bankbazaar.com/home-loan/loan-against-property.html' },
  { type: 'personal loan', re: /./, url: 'https://www.bankbazaar.com/personal-loan.html' },
];

export const loansWorker: VerticalWorker = {
  vertical: 'loans',
  tasks: [
    {
      sourceId: 'w_loans_bankbazaar',
      name: 'Loans worker: BankBazaar lender-wise rate tables',
      priority: 10,
      run: async (ctx) => {
        const text = `${ctx.query.rawQuery || ''} ${ctx.query.entityName || ''}`;
        const page = PAGES.find((p) => p.re.test(text)) || PAGES[PAGES.length - 1];
        const r = await ctx.fetch(page.url);
        if (r.status !== 200) throw new AcquisitionError('FORBIDDEN', `BankBazaar HTTP ${r.status}`, r.status);
        const items = parseBankBazaarLoans(r.body, ctx.source, page.url, page.type);
        if (!items.length && looksLikeChallenge(r.body)) throw new AcquisitionError('ACCESS_CHALLENGE', 'BankBazaar presented a challenge page');
        return items;
      },
    },
    ...LENDER_PAGES.map(lenderPageTask),
  ],
};
registerVerticalWorker(loansWorker);
