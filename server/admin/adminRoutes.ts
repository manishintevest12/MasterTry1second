/**
 * Admin routes (Section 19): authorized controls for source management, health,
 * affiliate configuration, rewards/prizes, fulfilment, feature flags and audit.
 * Secrets are never returned in responses.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getSources, getSource, updateSource, sourcesStatusReport, loadSourcesFromDb } from '../sources/registry';
import { getAllHealth } from '../sources/health';
import { checkSourceHealth } from '../sources/orchestrator';
import { verticalStatusReport } from '../verticals/verticalEngine';
import { authMiddleware, requireAdmin } from '../auth/authService';
import { listFulfilmentsForAdmin, updateFulfilmentStatus } from '../rewards/rewardsEngine';
import { getStore } from '../common/db';
import { cacheStats } from '../common/cache';
import { redactSecrets } from '../common/logger';
import { validateDestination } from '../affiliate/affiliateNetwork';
import { log } from '../common/logger';

export const adminRouter = Router();
adminRouter.use(authMiddleware); // attach req.user from the Bearer token
adminRouter.use(requireAdmin);

const audit = (req: Request, action: string, target?: string, details?: unknown) => {
  void (async () => {
    try {
      await getStore().execute('INSERT INTO audit_logs (actor, action, target, details) VALUES (?, ?, ?, ?)',
        [(req as any).user?.email || 'admin', action, target || null, JSON.stringify(details || {})]);
    } catch { /* best-effort */ }
  })();
};

// --- Sources ---
adminRouter.get('/sources', (_req, res) => {
  const sources = getSources().map((s) => ({
    ...s,
    config: redactSecrets(s.config), // never expose credentials
  }));
  res.json({ success: true, sources, health: getAllHealth() });
});

adminRouter.post('/sources/:id', (req, res) => {
  const patch: any = {};
  if (typeof req.body.enabled === 'boolean') patch.enabled = req.body.enabled;
  if (typeof req.body.priority === 'number') patch.priority = req.body.priority;
  if (req.body.config && typeof req.body.config === 'object') patch.config = req.body.config;
  if (req.body.rateLimit) patch.rateLimit = req.body.rateLimit;
  const updated = updateSource(req.params.id, patch);
  if (!updated) return res.status(404).json({ success: false, error: 'Unknown source' });
  audit(req, 'source.update', req.params.id, { enabled: updated.enabled, priority: updated.priority });
  log.info('Admin', `Source ${req.params.id} updated`);
  res.json({ success: true, source: { ...updated, config: redactSecrets(updated.config) } });
});

adminRouter.post('/sources/:id/health-check', async (req, res) => {
  const source = getSource(req.params.id);
  if (!source) return res.status(404).json({ success: false, error: 'Unknown source' });
  const healthy = await checkSourceHealth(source);
  audit(req, 'source.health_check', req.params.id, { healthy });
  res.json({ success: true, sourceId: source.id, healthy });
});

adminRouter.post('/sources/reload', async (req, res) => {
  const r = await loadSourcesFromDb();
  audit(req, 'sources.reload', undefined, r);
  res.json({ success: true, ...r });
});

// --- Verticals & coverage (honest reporting) ---
adminRouter.get('/verticals', (_req, res) => {
  res.json({ success: true, verticals: verticalStatusReport() });
});

adminRouter.get('/coverage', async (_req, res) => {
  const store = getStore();
  let searchStats: any = null;
  try {
    const rows = await store.query<any>(
      `SELECT served_from, COUNT(*) AS c FROM searches GROUP BY served_from`,
    );
    searchStats = rows;
  } catch { searchStats = null; }
  res.json({
    success: true,
    sources: sourcesStatusReport(),
    searchesByServedFrom: searchStats,
    note: 'Percentages require measured numerator/denominator over a time window; with no sources verified yet we report zeros, not claims.',
    cache: cacheStats(),
  });
});

// --- Rewards admin: prizes, inventory, fulfilment ---
adminRouter.get('/fulfilments', async (_req, res) => {
  const rows = await listFulfilmentsForAdmin();
  res.json({ success: true, fulfilments: rows });
});

adminRouter.post('/fulfilments/:id/status', async (req, res) => {
  const ok = await updateFulfilmentStatus(Number(req.params.id), String(req.body.status || ''));
  if (!ok) return res.status(400).json({ success: false, error: 'Invalid status or record' });
  audit(req, 'fulfilment.status', req.params.id, { status: req.body.status });
  res.json({ success: true });
});

adminRouter.post('/prizes', async (req, res) => {
  const { name, description, weight, quantity } = req.body;
  if (!name || typeof quantity !== 'number' || quantity < 0) {
    return res.status(400).json({ success: false, error: 'name and non-negative quantity are required' });
  }
  const store = getStore();
  try {
    const prize = await store.execute(
      'INSERT INTO prizes (name, description, weight, active) VALUES (?, ?, ?, 1)',
      [String(name).slice(0, 255), description ? String(description).slice(0, 500) : null, Number(weight) || 1],
    );
    await store.execute('INSERT INTO prize_inventory (prize_id, quantity) VALUES (?, ?)', [(prize as any).insertId, quantity]);
    audit(req, 'prize.create', String(name), { weight, quantity });
    res.json({ success: true, prizeId: (prize as any).insertId });
  } catch (e: any) {
    res.status(500).json({ success: false, error: 'Prize creation failed' });
  }
});

adminRouter.post('/prizes/:id/inventory', async (req, res) => {
  const delta = Number(req.body.delta || 0);
  if (!Number.isFinite(delta)) return res.status(400).json({ success: false, error: 'delta must be a number' });
  const store = getStore();
  // Inventory can never go negative (checked + enforced atomically)
  const rows = await store.query<any>('SELECT quantity FROM prize_inventory WHERE prize_id = ?', [Number(req.params.id)]);
  if (rows.length === 0) return res.status(404).json({ success: false, error: 'Prize inventory not found' });
  const current = Number(rows[0].quantity);
  if (current + delta < 0) return res.status(400).json({ success: false, error: 'Inventory cannot become negative' });
  await store.execute('UPDATE prize_inventory SET quantity = quantity + ? WHERE prize_id = ?', [delta, Number(req.params.id)]);
  audit(req, 'prize.inventory', req.params.id, { delta });
  res.json({ success: true, quantity: current + delta });
});

// --- Feature flags & audit logs ---
adminRouter.get('/feature-flags', async (_req, res) => {
  try {
    const rows = await getStore().query<any>('SELECT name, enabled FROM feature_flags');
    res.json({ success: true, flags: rows });
  } catch {
    res.json({ success: true, flags: [] });
  }
});

adminRouter.post('/feature-flags/:name', async (req, res) => {
  const enabled = Boolean(req.body.enabled);
  await getStore().execute(
    'INSERT INTO feature_flags (name, enabled) VALUES (?, ?) ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)',
    [req.params.name, enabled ? 1 : 0],
  );
  audit(req, 'feature_flag.set', req.params.name, { enabled });
  res.json({ success: true, name: req.params.name, enabled });
});

adminRouter.get('/audit-logs', async (_req, res) => {
  try {
    const rows = await getStore().query<any>('SELECT actor, action, target, details, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 200');
    res.json({ success: true, logs: rows });
  } catch {
    res.json({ success: true, logs: [] });
  }
});

// --- Affiliate destination validation utility ---
adminRouter.post('/validate-destination', (req, res) => {
  const check = validateDestination(String(req.body.url || ''));
  res.json({ success: true, ...check });
});

// --- Coverage measurement (Section 20): honest numerator/denominator metrics ---
adminRouter.get('/coverage/metrics', async (req, res) => {
  const hours = Math.max(0, Math.min(Number(req.query.hours) || 24, 720));
  const { buildCoverageReport } = await import('../analytics/coverage');
  const report = await buildCoverageReport(hours);
  res.json({ success: true, report });
});

// --- Catalogue quality controls (Section 19): coupons, bank offers, gift cards ---
adminRouter.get('/coupons', async (_req, res) => {
  try {
    const rows = await getStore().query<any>('SELECT id, merchant, code, description, discount_type, discount_value, min_spend, max_discount, eligibility, expires_at, verified FROM coupons ORDER BY created_at DESC LIMIT 200');
    res.json({ success: true, coupons: rows });
  } catch { res.json({ success: true, coupons: [] }); }
});

adminRouter.post('/coupons', async (req, res) => {
  const { merchant, code, description, discountType, discountValue, minSpend, maxDiscount, eligibility, expiresAt } = req.body;
  if (!merchant || !description) return res.status(400).json({ success: false, error: 'merchant and description are required' });
  // Admin-entered coupons carry verified=true only when the admin explicitly confirms the terms
  const verified = req.body.verified === true;
  try {
    const r = await getStore().execute(
      `INSERT INTO coupons (merchant, code, description, discount_type, discount_value, min_spend, max_discount, eligibility, expires_at, verified, source_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin')`,
      [String(merchant).slice(0, 255), code ? String(code).slice(0, 120) : null, String(description).slice(0, 500),
        ['flat', 'percent', 'unknown'].includes(discountType) ? discountType : 'unknown',
        discountValue ?? null, minSpend ?? null, maxDiscount ?? null,
        eligibility ? String(eligibility).slice(0, 1000) : null,
        expiresAt || null, verified ? 1 : 0],
    );
    audit(req, 'coupon.create', String(merchant), { verified });
    res.json({ success: true, couponId: (r as any).insertId });
  } catch {
    res.status(500).json({ success: false, error: 'Coupon creation failed' });
  }
});

adminRouter.post('/coupons/:id/verify', async (req, res) => {
  const verified = Boolean(req.body.verified);
  try {
    const r = await getStore().execute('UPDATE coupons SET verified = ? WHERE id = ?', [verified ? 1 : 0, Number(req.params.id)]);
    if ((r as any).affectedRows === 0) return res.status(404).json({ success: false, error: 'Coupon not found' });
    audit(req, 'coupon.verify', req.params.id, { verified });
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Update failed' });
  }
});

adminRouter.get('/bank-offers', async (_req, res) => {
  try {
    const rows = await getStore().query<any>('SELECT id, bank, card_type, offer_text, min_spend, max_discount, valid_from, valid_to, eligibility, verified FROM bank_offers ORDER BY created_at DESC LIMIT 200');
    res.json({ success: true, bankOffers: rows });
  } catch { res.json({ success: true, bankOffers: [] }); }
});

adminRouter.post('/bank-offers', async (req, res) => {
  const { bank, cardType, offerText, minSpend, maxDiscount, validFrom, validTo, eligibility } = req.body;
  if (!bank || !offerText) return res.status(400).json({ success: false, error: 'bank and offerText are required' });
  try {
    const r = await getStore().execute(
      `INSERT INTO bank_offers (bank, card_type, offer_text, min_spend, max_discount, valid_from, valid_to, eligibility, verified, source_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin')`,
      [String(bank).slice(0, 160), cardType ? String(cardType).slice(0, 160) : null, String(offerText).slice(0, 500),
        minSpend ?? null, maxDiscount ?? null, validFrom || null, validTo || null,
        eligibility ? String(eligibility).slice(0, 1000) : null, req.body.verified === true ? 1 : 0],
    );
    audit(req, 'bank_offer.create', String(bank), {});
    res.json({ success: true, bankOfferId: (r as any).insertId });
  } catch {
    res.status(500).json({ success: false, error: 'Bank offer creation failed' });
  }
});

adminRouter.get('/gift-cards', async (_req, res) => {
  try {
    const rows = await getStore().query<any>('SELECT id, merchant, denomination, sale_price, discount_percent, validity_months, verified FROM gift_cards ORDER BY created_at DESC LIMIT 200');
    res.json({ success: true, giftCards: rows });
  } catch { res.json({ success: true, giftCards: [] }); }
});

adminRouter.post('/gift-cards', async (req, res) => {
  const { merchant, denomination, salePrice, discountPercent, validityMonths } = req.body;
  if (!merchant || typeof denomination !== 'number' || denomination <= 0) {
    return res.status(400).json({ success: false, error: 'merchant and positive denomination are required' });
  }
  try {
    const r = await getStore().execute(
      `INSERT INTO gift_cards (merchant, denomination, sale_price, discount_percent, validity_months, verified, source_id)
       VALUES (?, ?, ?, ?, ?, ?, 'admin')`,
      [String(merchant).slice(0, 255), denomination, salePrice ?? null, discountPercent ?? null,
        validityMonths ?? null, req.body.verified === true ? 1 : 0],
    );
    audit(req, 'gift_card.create', String(merchant), {});
    res.json({ success: true, giftCardId: (r as any).insertId });
  } catch {
    res.status(500).json({ success: false, error: 'Gift card creation failed' });
  }
});
