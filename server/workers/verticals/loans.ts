/**
 * Loans worker (India). Pulls lender-wise published interest-rate tables.
 * Only runs for loans searches. Loan type is inferred from the query
 * (home / car / education / business / LAP / personal), default personal.
 * Rates are labelled INDICATIVE — never presented as an approved offer.
 */
import { registerVerticalWorker, looksLikeChallenge, type VerticalWorker } from '../verticalWorker';
import { parseBankBazaarLoans } from '../parsers/bankbazaarLoans';
import { AcquisitionError } from '../../common/httpClient';

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
  ],
};
registerVerticalWorker(loansWorker);
