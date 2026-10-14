/** Bootstrap: initial sync ~45s after boot, then every 6h. Shared-hosting friendly. */
import { syncAutoDeals } from './acquisition';
import { log } from '../common/logger';

export function bootstrapDealsSync(): void {
  const run = () => syncAutoDeals().catch((e) => log.warn('Deals', 'auto sync crashed (isolated)', { error: String(e?.message || e).slice(0, 120) }));
  setTimeout(() => { void run(); }, 45_000).unref?.();
  const t = setInterval(() => { void run(); }, 6 * 60 * 60 * 1000);
  t.unref?.();
}
