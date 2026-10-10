/** GET /api/v1/offers — unified frontend serving layer. */
import { Router } from 'express';
import { listOffers } from './store';
import { registeredProviders, syncAllAffiliates, startAffiliateScheduler } from './aggregator';

export const affiliateRouter = Router();

affiliateRouter.get('/offers', async (req: any, res: any) => {
  try {
    const rows = await listOffers({
      source: req.query.source as string | undefined,
      merchant: req.query.merchant as string | undefined,
      category: req.query.category as string | undefined,
      hasCoupon: req.query.has_coupon === 'true' || req.query.has_coupon === '1',
      search: req.query.search as string | undefined,
      sort: (req.query.sort as any) || undefined,
      limit: Number(req.query.limit) || undefined,
      offset: Number(req.query.offset) || undefined,
    });
    res.json({ success: true, count: rows.length, offers: rows });
  } catch (e: any) {
    res.status(500).json({ success: false, error: String(e?.message || e).slice(0, 160) });
  }
});

/** In-process scheduler bootstrap (every 6h) + an initial sync shortly after boot. */
export async function bootstrapAffiliateSync(): Promise<void> {
  startAffiliateScheduler();
  setTimeout(() => { syncAllAffiliates().catch(() => undefined); }, 30_000).unref?.();
}

affiliateRouter.get('/providers', (_req: any, res: any) => res.json({ success: true, providers: registeredProviders() }));

// Admin-triggered manual sync (protected at the router mount in admin routes if needed)
affiliateRouter.post('/sync', async (_req: any, res: any) => {
  const outcomes = await syncAllAffiliates();
  res.json({ success: true, outcomes });
});
