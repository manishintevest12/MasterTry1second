/**
 * Insurance worker (India). An insurance search runs ONLY this worker.
 * Real insurer comparison data (Claim Settlement Ratio, network size, plan names)
 * from BankBazaar insurer tables. Personalized premiums are never invented.
 */
import { registerVerticalWorker, looksLikeChallenge, type VerticalWorker } from '../verticalWorker';
import { parseBankBazaarInsurance } from '../parsers/bankbazaarInsurance';
import { AcquisitionError } from '../../common/httpClient';

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
  ],
};
registerVerticalWorker(insuranceWorker);
