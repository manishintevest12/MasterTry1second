/** AggregatorService / SyncManager — iterates every registered provider,
 *  fetches concurrently with strict error isolation (one network's 429/crash
 *  never blocks the others), then runs batch upsert + smart dedup.
 */
import { getStore, runMigrations } from '../common/db';
import { log } from '../common/logger';
import { AdmitadProvider } from './providers/admitad';
import { VCommissionProvider } from './providers/vcommission';
import { CuelinksProvider } from './providers/cuelinks';
import { OptimiseProvider } from './providers/optimise';
import { DirectMerchantProvider } from './providers/directMerchant';
import type { BaseAffiliateProvider } from './baseProvider';
import type { ProviderSyncOutcome, UnifiedAffiliateOffer } from './types';
import { upsertOffers, expirePastOffers } from './store';

const PROVIDERS: BaseAffiliateProvider[] = [
  new VCommissionProvider(), // already live
  new AdmitadProvider(),      // activates when ADMITAD_* env vars are set
  new CuelinksProvider(),
  new OptimiseProvider(),
  new DirectMerchantProvider(),
];

export function registeredProviders(): Array<{ id: string; label: string; configured: boolean }> {
  return PROVIDERS.map((p) => ({ id: p.id, label: p.label, configured: p.isConfigured() }));
}

/** Smart dedup: same merchant + same coupon_code across networks → keep higher
 *  commission; otherwise unique per (network_source, network_offer_id). */
export function dedupOffers(offers: UnifiedAffiliateOffer[]): UnifiedAffiliateOffer[] {
  const byKey = new Map<string, UnifiedAffiliateOffer>();
  for (const o of offers) {
    const compound = `${o.network_source}|${o.network_offer_id}`;
    if (!byKey.has(compound)) byKey.set(compound, o);
  }
  const smart = new Map<string, UnifiedAffiliateOffer>();
  for (const o of byKey.values()) {
    if (!o.coupon_code) continue;
    const key = `${o.merchant_name.toLowerCase()}|${o.coupon_code.toLowerCase()}`;
    const prev = smart.get(key);
    if (!prev || ((o.commission ?? 0) > (prev.commission ?? 0))) smart.set(key, o);
  }
  return [...byKey.values()].filter((o) => {
    if (!o.coupon_code) return true;
    const winner = smart.get(`${o.merchant_name.toLowerCase()}|${o.coupon_code.toLowerCase()}`);
    return winner ? winner.network_source === o.network_source && winner.network_offer_id === o.network_offer_id : true;
  });
}

export async function syncAllAffiliates(opts: { limit?: number } = {}): Promise<ProviderSyncOutcome[]> {
  await runMigrations();
  const outcomes: ProviderSyncOutcome[] = await Promise.all(PROVIDERS.map(async (p) => {
    try {
      if (!p.isConfigured()) return { provider: p.id, ok: true, offers: 0, error: 'not configured (skipped)' };
      const res = await p.fetchOffers({ limit: opts.limit });
      const upserted = await upsertOffers(dedupOffers(res.offers));
      for (const w of res.warnings) log.warn('Affiliate', w);
      return { provider: p.id, ok: true, offers: upserted };
    } catch (e: any) {
      // Error isolation: log + report, never reject the batch.
      log.warn('Affiliate', `Sync failed for ${p.id} (isolated)`, { error: String(e?.message || e).slice(0, 160) });
      return { provider: p.id, ok: false, offers: 0, error: String(e?.message || e).slice(0, 160) };
    }
  }));
  const expired = await expirePastOffers();
  log.info('Affiliate', 'Sync complete', { outcomes, expired });
  return outcomes;
}

/** Shared-hosting-friendly scheduler: called from the server bootstrap. */
export function startAffiliateScheduler(intervalMs = 6 * 60 * 60 * 1000): NodeJS.Timeout {
  const t = setInterval(() => { syncAllAffiliates().catch(() => undefined); }, intervalMs);
  t.unref?.();
  return t;
}
