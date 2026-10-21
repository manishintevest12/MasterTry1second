/**
 * Account vertical worker (India). One worker for savings / current / demat
 * bank-account searches (the engine's vertical id is 'banking'; the UI tab is
 * 'account' and routes.ts maps it). Sources:
 *   - BankBazaar savings / current / demat tables (query-routed)
 *   - Paisabazaar savings highest-rate table
 *   - Zerodha's own charges page (demat)
 *   - Groww's own pricing page (demat)
 * All figures are published, indicative rates/charges — never an approved offer.
 *
 * Self-healing (owner standing rule): every task retries once after a 2.5s
 * cooldown on transient 5xx/timeout, and reports honest failure classes
 * otherwise — one failing source never blocks the others.
 */
import { registerVerticalWorker, looksLikeChallenge, type VerticalWorker, type WorkerTaskContext } from '../verticalWorker';
import {
  parseBankBazaarSavings, parseBankBazaarCurrent, parseBankBazaarDemat,
  parsePaisabazaarSavings, parseZerodhaCharges, parseGrowwCharges,
} from '../parsers/bankbazaarAccounts';
import { AcquisitionError } from '../../common/httpClient';
import type { RawSourceItem } from '../../types';

const SAVINGS_URL = 'https://www.bankbazaar.com/savings-account.html';
const CURRENT_URL = 'https://www.bankbazaar.com/current-account.html';
const DEMAT_URL = 'https://www.bankbazaar.com/demat-account.html';
const PAISA_URL = 'https://www.paisabazaar.com/savings-account/';
const ZERODHA_URL = 'https://zerodha.com/charges';
const GROWW_URL = 'https://groww.in/pricing';

type AccountType = 'savings' | 'current' | 'demat';

export function accountTypeOf(ctx: WorkerTaskContext): AccountType {
  const q = `${ctx.query.rawQuery || ''} ${ctx.query.entityName || ''}`.toLowerCase();
  if (/demat|trading|share market|stock|broker|invest/.test(q)) return 'demat';
  if (/current|business account|msme|firm account/.test(q)) return 'current';
  return 'savings';
}

/** One fetch + parse, with a single retry on transient server errors (self-healing). */
async function acquire(
  ctx: WorkerTaskContext, url: string, parse: (body: string) => RawSourceItem[], label: string,
): Promise<RawSourceItem[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await ctx.fetch(url, { timeoutMs: 20_000 });
      if (r.status !== 200) {
        if (looksLikeChallenge(r.body)) throw new AcquisitionError('ACCESS_CHALLENGE', `${label} presented a challenge page`);
        if (r.status >= 500 || r.status === 429) {
          lastErr = new AcquisitionError('SERVER_ERROR', `${label} HTTP ${r.status}${attempt === 0 ? ' (will retry)' : ''}`, r.status);
          await new Promise((res) => setTimeout(res, 2500));
          continue;
        }
        throw new AcquisitionError('FORBIDDEN', `${label} HTTP ${r.status}`, r.status);
      }
      const items = parse(r.body);
      if (!items.length) throw new AcquisitionError('EMPTY_RESPONSE', `${label} page carried no publishable account data`);
      return items;
    } catch (e) {
      if (e instanceof AcquisitionError && ['ACCESS_CHALLENGE', 'FORBIDDEN', 'EMPTY_RESPONSE'].includes(e.failureClass)) throw e;
      lastErr = e;
      await new Promise((res) => setTimeout(res, 2500)); // transient network/timeout: one retry
    }
  }
  throw lastErr instanceof AcquisitionError ? lastErr : new AcquisitionError('SERVER_ERROR', `${label} failed after retry: ${String(lastErr).slice(0, 120)}`);
}

export const accountWorker: VerticalWorker = {
  vertical: 'banking',
  tasks: [
    {
      sourceId: 'w_account_bankbazaar',
      name: 'Account worker: BankBazaar bank-wise account tables',
      priority: 10,
      run: async (ctx) => {
        const type = accountTypeOf(ctx);
        const url = type === 'demat' ? DEMAT_URL : type === 'current' ? CURRENT_URL : SAVINGS_URL;
        const parse = (body: string) => type === 'demat'
          ? parseBankBazaarDemat(body, ctx.source, url)
          : type === 'current'
            ? parseBankBazaarCurrent(body, ctx.source, url)
            : parseBankBazaarSavings(body, ctx.source, url);
        return acquire(ctx, url, parse, 'BankBazaar');
      },
    },
    {
      sourceId: 'w_account_paisabazaar',
      name: 'Account worker: Paisabazaar savings highest-rate table',
      priority: 12,
      run: async (ctx) => acquire(ctx, PAISA_URL,
        (body) => parsePaisabazaarSavings(body, ctx.source, PAISA_URL), 'Paisabazaar'),
    },
    {
      sourceId: 'w_account_zerodha',
      name: 'Account worker: Zerodha published demat charges',
      priority: 14,
      run: async (ctx) => acquire(ctx, ZERODHA_URL,
        (body) => parseZerodhaCharges(body, ctx.source, ZERODHA_URL), 'Zerodha'),
    },
    {
      sourceId: 'w_account_groww',
      name: 'Account worker: Groww published demat charges',
      priority: 16,
      run: async (ctx) => acquire(ctx, GROWW_URL,
        (body) => parseGrowwCharges(body, ctx.source, GROWW_URL), 'Groww'),
    },
  ],
};

registerVerticalWorker(accountWorker);
