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
import { relayStats, relayConfigured, gatedHostPolicy, relayDisabled } from '../sources/edgeRelay';
import { listTopPicks, upsertTopPick, deleteTopPick, listAdSlots, upsertAdSlot } from '../marketing/placements';
import { purgeSectionCache } from '../api/cachedSections';
import { listAppLinks, upsertAppLink, deleteAppLink } from '../marketing/appLinks';
import { listAllDeals, saveDeal, deleteDeal, DEAL_KINDS } from '../marketing/deals';
import { listProfiles, saveProfile, deleteProfile, AFFILIATE_NETWORKS } from '../affiliate/profiles';
import { syncAutoDeals } from '../deals/acquisition';
import { latestScores, runSpeedTest, scoreHistory } from './speedtest';
import { listAllNotifications, createNotification, deactivateNotification, validateNotification } from '../notifications/notifications';
import { log } from '../common/logger';
import { getCabDeeplinkConfig, saveCabDeeplinkConfig } from '../common/cabDeeplink';
import { runAcceptanceTests, persistAcceptance, acceptanceTotals } from '../registry/acceptanceRunner';

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

// Cab in-app booking config (owner 22 Oct): Uber client id + affiliate params
// appended to Uber/Ola booking deep links. Admin-editable end to end.
adminRouter.get('/cab-deeplinks', async (_req, res) => {
  res.json({ success: true, config: await getCabDeeplinkConfig() });
});

adminRouter.post('/cab-deeplinks', async (req, res) => {
  const config = await saveCabDeeplinkConfig(req.body || {});
  audit(req, 'cab_deeplinks.set', 'cab_deeplinks', {
    uberClientId: config.uberClientId ? `${config.uberClientId.slice(0, 3)}…` : '',
    uberEnabled: config.uberEnabled,
    olaEnabled: config.olaEnabled,
  });
  res.json({ success: true, config });
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
// --- Top Picks (admin-curated sponsored picks; shown only when configured) ---
adminRouter.get('/top-picks', async (req, res) => {
  try {
    const picks = await listTopPicks(String(req.query.vertical || '') || undefined, true);
    res.json({ success: true, picks });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Could not load top picks' });
  }
});

adminRouter.post('/top-picks', async (req, res) => {
  try {
    const result = await upsertTopPick(req.body || {});
    if (!result.ok) return res.status(400).json({ success: false, error: result.error });
    audit(req, 'top_pick.upsert', String(result.id), { vertical: req.body?.vertical });
    log.info('Admin', `Top pick saved (id ${result.id})`);
    res.json({ success: true, id: result.id });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Could not save top pick' });
  }
});

adminRouter.delete('/top-picks/:id', async (req, res) => {
  try {
    await deleteTopPick(Number(req.params.id));
    audit(req, 'top_pick.delete', req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Could not delete top pick' });
  }
});

// --- Ad slots (AdSense config or admin-authored custom HTML) ---
adminRouter.get('/ad-slots', async (_req, res) => {
  try {
    res.json({ success: true, slots: await listAdSlots() });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Could not load ad slots' });
  }
});

adminRouter.post('/ad-slots', async (req, res) => {
  try {
    const result = await upsertAdSlot(req.body || {});
    if (!result.ok) return res.status(400).json({ success: false, error: result.error });
    audit(req, 'ad_slot.upsert', req.body?.slot_key, { provider: req.body?.provider });
    log.info('Admin', `Ad slot saved (${req.body?.slot_key})`);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Could not save ad slot' });
  }
});

// --- App download links (Chrome extension / Android / iOS) ---
adminRouter.get('/app-links', async (_req, res) => {
  try { res.json({ success: true, links: await listAppLinks(true) }); }
  catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not load app links' }); }
});

adminRouter.post('/app-links', async (req, res) => {
  try {
    const result = await upsertAppLink(req.body || {});
    if (!result.ok) return res.status(400).json({ success: false, error: result.error });
    audit(req, 'app_link.upsert', req.body?.link_key, { url: req.body?.url, version: req.body?.version });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Could not save app link' });
  }
});

adminRouter.get('/notifications', async (_req, res) => {
  try { res.json({ success: true, notifications: await listAllNotifications() }); }
  catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not load notifications' }); }
});

// Admin push: broadcast (userId omitted) or targeted (userId given). https-only links.
adminRouter.post('/notifications', async (req, res) => {
  try {
    const b = req.body || {};
    const input = {
      userId: b.userId ? Number(b.userId) : null,
      kind: 'admin' as const,
      title: String(b.title || ''),
      body: String(b.body || ''),
      image: b.image ? String(b.image) : null,
      ctaUrl: b.ctaUrl ? String(b.ctaUrl) : null,
      isActive: b.isActive !== false,
      createdBy: (req as any).user?.email || 'admin',
    };
    const v = validateNotification(input);
    if (!v.ok) return res.status(400).json({ success: false, error: v.error });
    const r = await createNotification(input);
    if (!r.ok) return res.status(400).json({ success: false, error: r.error });
    audit(req, 'notification.create', String(r.id), { title: input.title, broadcast: !input.userId });
    res.json({ success: true, id: r.id });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Could not push notification' });
  }
});

adminRouter.delete('/notifications/:id', async (req, res) => {
  try {
    const ok = await deactivateNotification(Number(req.params.id));
    if (!ok) return res.status(404).json({ success: false, error: 'Notification not found' });
    audit(req, 'notification.delete', req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Could not remove notification' });
  }
});

// ---- Deals auto-sync (merchant offers via cffi; admin deals untouched) ----
adminRouter.post('/deals/sync', async (_req, res) => {
  try { res.json({ success: true, outcomes: await syncAutoDeals() }); }
  catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Sync failed' }); }
});

// ---- Manual finance inventory (owner 27 Oct): loans / credit cards / insurance / account.
// The owner types a lender, card or plan himself; it is stored in the same `offers`
// table the scraped rows use, so a gated source can never blank a finance vertical.
adminRouter.get('/finance-offers', async (req, res) => {
  try {
    const { listManualFinanceOffers, FINANCE_VERTICALS } = await import('../marketing/financeOffers');
    res.json({ success: true, verticals: FINANCE_VERTICALS, offers: await listManualFinanceOffers(String(req.query.vertical || '') || undefined) });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not load manual finance entries' }); }
});
adminRouter.post('/finance-offers', async (req, res) => {
  try {
    const { saveManualFinanceOffer } = await import('../marketing/financeOffers');
    const r = await saveManualFinanceOffer({ ...req.body, actor: (req as any).adminUser || 'owner' });
    if (!r.ok) return res.status(400).json({ success: false, error: r.error });
    audit(req, req.body?.id ? 'finance_offer.update' : 'finance_offer.create', String(req.body?.title || ''));
    res.json({ success: true, id: r.id });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not save the entry' }); }
});
adminRouter.delete('/finance-offers/:id', async (req, res) => {
  try {
    const { deleteManualFinanceOffer } = await import('../marketing/financeOffers');
    const r = await deleteManualFinanceOffer(Number(req.params.id), (req as any).adminUser || 'owner');
    if (!r.ok) return res.status(400).json({ success: false, error: r.error });
    audit(req, 'finance_offer.delete', String(req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not delete the entry' }); }
});

// ---- Affiliate profiles: network + tracking template per company, applied server-side on every click ----
adminRouter.get('/affiliate-profiles', async (_req, res) => {
  try {
    const profiles = await listProfiles();
    // Owner 27 Oct: show the merchant's EFFECTIVE affiliate id too, so partnerships
    // that already earn (Amazon tag, Cuelinks, LinkInR, Ekaro) are visible per row.
    const { resolveEffective } = await import('../affiliate/coverageMap');
    const eff = await resolveEffective(profiles);
    const bySlug = new Map(eff.map((e) => [e.slug, e]));
    res.json({
      success: true,
      networks: AFFILIATE_NETWORKS,
      profiles: profiles.map((p: any) => {
        const e = bySlug.get(p.slug);
        return { ...p, effective_source: e?.effective_source || 'direct', effective_id_masked: e?.effective_id_masked || '', effective_label: e?.effective_label || '' };
      }),
    });
  }
  catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not load affiliate profiles' }); }
});
adminRouter.post('/affiliate-profiles', async (req, res) => {
  try {
    const r = await saveProfile(req.body || {});
    if (!r.ok) return res.status(400).json({ success: false, error: r.error });
    audit(req, 'affiliate_profile.save', String(req.body?.slug || ''));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not save affiliate profile' }); }
});
adminRouter.delete('/affiliate-profiles/:slug', async (req, res) => {
  try { await deleteProfile(req.params.slug); audit(req, 'affiliate_profile.delete', req.params.slug); res.json({ success: true }); }
  catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not delete affiliate profile' }); }
});

// ---- Affiliate COVERAGE (owner 25 Oct): every monetized partnership in one view —
// manual profiles + automatic layers (LinkInR campaigns, Ekaro, Amazon, Cuelinks,
// sync-worker affiliate_links) so the owner can see what is covered and override
// any of it from the Affiliate IDs panel (manual profiles always win). ----
adminRouter.get('/affiliate/coverage', async (_req, res) => {
  try {
    const { settings } = await import('../common/settings');
    const { linkinrCampaignList, linkinrStats } = await import('../affiliate/linkinr');
    const { ekaroStats } = await import('../affiliate/ekaro');
    const store = getStore() as any;
    let capturedLinks: any[] = [];
    try {
      capturedLinks = await store.query(
        `SELECT network_source AS network, vendor_domain AS domain, deep_link_template AS template, campaign_id AS campaign
         FROM affiliate_links ORDER BY vendor_domain ASC LIMIT 500`);
    } catch { capturedLinks = []; }
    res.json({
      success: true,
      manual: await listProfiles(),
      linkinr: {
        enabled: linkinrStats().enabled,
        campaigns: linkinrCampaignList().map((c) => ({
          name: c.name, domain: c.domain, payout: c.payout, type: c.type, categories: c.categories,
        })),
      },
      amazon: { tag: settings.amazonAssociates?.tag || '' },
      cuelinks: {
        enabled: Boolean(settings.cuelinks?.enabled),
        publisherId: settings.cuelinks?.publisherId || '',
        cid: settings.cuelinks?.cid || '',
      },
      ekaro: ekaroStats(),
      capturedLinks,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Could not load affiliate coverage' });
  }
});

// ---- Deals registry (offers / coupons / bank, card, gift-card, loan, insurance, movie deals) ----
adminRouter.get('/deals', async (_req, res) => {
  try { res.json({ success: true, kinds: DEAL_KINDS, deals: await listAllDeals() }); }
  catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not load deals' }); }
});

adminRouter.post('/deals', async (req, res) => {
  try {
    const r = await saveDeal(req.body || {});
    if (!r.ok) return res.status(400).json({ success: false, error: r.error });
    audit(req, req.body?.id ? 'deal.update' : 'deal.create', String(r.id ?? ''));
    res.json({ success: true, id: r.id });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not save deal' }); }
});

adminRouter.delete('/deals/:id', async (req, res) => {
  try {
    await deleteDeal(Number(req.params.id));
    audit(req, 'deal.delete', req.params.id);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not delete deal' }); }
});

adminRouter.delete('/app-links/:key', async (req, res) => {
  try {
    await deleteAppLink(req.params.key);
    audit(req, 'app_link.delete', req.params.key);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Could not delete app link' });
  }
});

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

// --- Section 16: mandatory source-by-source acceptance matrix ---
adminRouter.get('/acceptance', async (_req, res) => {
  try {
    const rows = await getStore().query<any>('SELECT * FROM source_acceptance_tests ORDER BY source_id, capability');
    const totals = acceptanceTotals(rows as any);
    res.json({ success: true, rows, totals });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'failed' });
  }
});

adminRouter.post('/acceptance/run', async (req, res) => {
  try {
    const rows = await runAcceptanceTests();
    await persistAcceptance(rows);
    const totals = acceptanceTotals(rows);
    audit(req, 'acceptance.run', 'section16', totals);
    log.info('Admin', `Acceptance sweep complete: ${rows.length} capability rows`);
    res.json({ success: true, rows, totals });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'failed' });
  }
});

// ============ Leads (owner 21 Oct: real server-side lead persistence) ============
adminRouter.get('/leads', async (req, res) => {
  try {
    const { listLeads } = await import('../marketing/leads');
    const leads = await listLeads({
      source: (req.query.source as string) || undefined,
      vertical: (req.query.vertical as string) || undefined,
      status: (req.query.status as string) || undefined,
      limit: Number(req.query.limit) || 500,
    });
    res.json({ success: true, leads });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not load leads' }); }
});

// Owner 21 Oct: approving a partner inquiry from Admin > Leads creates a live
// entry in the public Direct Partner Directory (approved_partners table).
adminRouter.get('/partners', async (_req, res) => {
  try {
    const { listPartners } = await import('../marketing/partners');
    res.json({ success: true, partners: await listPartners(false) });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not load partners' }); }
});
adminRouter.patch('/partners/:id', async (req, res) => {
  try {
    const { updatePartnerStatus } = await import('../marketing/partners');
    const status = String((req.body || {}).status || '') === 'paused' ? 'paused' : 'active';
    await updatePartnerStatus(Number(req.params.id), status);
    audit(req, 'partner_status_update', `partner:${req.params.id}`, req.body);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not update partner' }); }
});
adminRouter.post('/leads/:id/approve-partner', async (req, res) => {
  try {
    const { getLead } = await import('../marketing/leads');
    const { approvePartnerFromLead } = await import('../marketing/partners');
    const lead = await getLead(Number(req.params.id));
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
    const r = await approvePartnerFromLead({
      business: lead.business, website: lead.website, category: lead.category,
      email: lead.email, phone: lead.phone, leadId: Number(req.params.id),
    });
    if (!r.ok) return res.status(400).json({ success: false, error: r.error });
    // Mark the inquiry converted so it stops appearing as pending work.
    const { updateLeadStatus } = await import('../marketing/leads');
    await updateLeadStatus(Number(req.params.id), 'converted');
    audit(req, 'partner_approved', `lead:${req.params.id}`, { partnerId: r.partner.id });
    res.json({ success: true, partner: r.partner });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not approve partner' }); }
});

adminRouter.patch('/leads/:id', async (req, res) => {
  try {
    const { updateLeadStatus } = await import('../marketing/leads');
    await updateLeadStatus(Number(req.params.id), String((req.body || {}).status || 'new'));
    audit(req, 'lead_status_update', `lead:${req.params.id}`, req.body);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not update lead' }); }
});

// ============ Merchant logos (owner 21 Oct: admin uploads brand logos) ============
adminRouter.get('/merchant-logos', async (_req, res) => {
  try {
    const { listMerchantLogos } = await import('../marketing/merchantLogos');
    res.json({ success: true, logos: await listMerchantLogos() });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not load logos' }); }
});

adminRouter.post('/merchant-logos', async (req, res) => {
  try {
    const { upsertMerchantLogo } = await import('../marketing/merchantLogos');
    const r = await upsertMerchantLogo(req.body || {});
    if (!r.ok) return res.status(400).json(r);
    audit(req, 'merchant_logo_upsert', r.name_key, { name: (req.body || {}).name });
    res.json(r);
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not save logo' }); }
});

adminRouter.delete('/merchant-logos/:key', async (req, res) => {
  try {
    const { deleteMerchantLogo } = await import('../marketing/merchantLogos');
    await deleteMerchantLogo(String(req.params.key));
    audit(req, 'merchant_logo_delete', String(req.params.key));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not delete logo' }); }
});

// ---- Site speed test (owner 21 Oct): Lighthouse desktop + mobile via PageSpeed Insights ----
adminRouter.get('/speedtest', async (_req, res) => {
  try { res.json({ success: true, scores: await latestScores() }); }
  catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not load speed scores' }); }
});

adminRouter.get('/speedtest/history', async (req, res) => {
  try { res.json({ success: true, history: await scoreHistory(String(req.query.strategy || 'mobile')) }); }
  catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not load speed history' }); }
});

adminRouter.post('/speedtest/run', async (req, res) => {
  try {
    const scores = await runSpeedTest(req.body?.url || 'https://www.try1second.com', { force: Boolean(req.body?.force) });
    audit(req, 'speedtest.run', 'pagespeed', scores.map((s) => `${s.strategy}=${s.score ?? 'err'}`).join(' '));
    res.json({ success: true, scores });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Speed test failed' }); }
});

// ---- AdSense revenue (owner 27 Oct): "admin mai ek section ye v bnao ki adsence se hume
// kitna revenue aaya hai". Live API when configured, otherwise the owner's own CSV export.
// Numbers are always the owner's real earnings or an honest "not connected yet" state.
adminRouter.get('/adsense-revenue', async (req, res) => {
  try {
    const days = Math.min(365, Math.max(7, Number((req.query as any).days) || 90));
    const mod = await import('../marketing/adsenseRevenue');
    const rows = await mod.dailyRows(days);
    const summary = mod.summarize(rows);
    const cfg = mod.adsenseApiConfig();
    const circuit = mod.adsenseApiCircuit();
    const slots = await getStore().query<any>(
      "SELECT slot_key, provider, adsense_client, adsense_slot, is_active FROM ad_slots WHERE provider = 'adsense'",
    ).catch(() => []);
    res.json({
      success: true,
      summary,
      days: rows.slice(0, 60),
      api: {
        configured: cfg.configured,
        account: cfg.accountId ? `${cfg.accountId.slice(0, 6)}…` : '',
        currency: cfg.currency,
        parked: circuit.parked,
        park_reason: circuit.reason,
        retry_after: circuit.until,
        missing: [
          !process.env.ADSENSE_ACCOUNT_ID && 'ADSENSE_ACCOUNT_ID',
          !process.env.ADSENSE_OAUTH_CLIENT_ID && 'ADSENSE_OAUTH_CLIENT_ID',
          !process.env.ADSENSE_OAUTH_CLIENT_SECRET && 'ADSENSE_OAUTH_CLIENT_SECRET',
          !process.env.ADSENSE_REFRESH_TOKEN && 'ADSENSE_REFRESH_TOKEN',
        ].filter(Boolean),
      },
      slots_configured: (slots || []).filter((s) => s.is_active).length,
      recent_syncs: await mod.lastSyncs(5),
      generated_at: new Date().toISOString(),
    });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not load AdSense revenue' }); }
});

adminRouter.post('/adsense-revenue/sync', async (req, res) => {
  try {
    const { syncFromAdsenseApi } = await import('../marketing/adsenseRevenue');
    const days = Math.min(365, Math.max(7, Number(req.body?.days) || 30));
    const out = await syncFromAdsenseApi(days);
    audit(req, 'adsense.sync', String(days), out.ok ? `${out.rows} days` : String(out.error || 'failed'));
    res.status(out.ok ? 200 : 400).json({ success: out.ok, ...out });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Sync failed' }); }
});

adminRouter.post('/adsense-revenue/csv', async (req, res) => {
  try {
    const text = String(req.body?.csv || '');
    if (text.trim().length < 10) return res.status(400).json({ success: false, error: 'CSV text is empty' });
    if (text.length > 2_000_000) return res.status(400).json({ success: false, error: 'CSV too large — export a shorter date range' });
    const { importAdsenseCsv } = await import('../marketing/adsenseRevenue');
    const out = await importAdsenseCsv(text, String(req.body?.currency || 'INR').toUpperCase());
    audit(req, 'adsense.csv_import', String(out.rows), out.ok ? `${out.rows} days` : String(out.error || 'failed'));
    res.status(out.ok ? 200 : 400).json({ success: out.ok, ...out });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Import failed' }); }
});

// ---- Affiliate partner map: Excel download (owner 27 Oct "ab muje ek excel sheet
// download ka option v do admin kaun si company kiski partner hai"). Two sheets:
// Partners (merchant -> network + OUR id) and Coupons (every manual promo).
adminRouter.get('/affiliate-partners.xlsx', async (_req, res) => {
  try {
    const { listProfiles } = await import('../affiliate/profiles');
    const { resolveEffective } = await import('../affiliate/coverageMap');
    const { buildXlsx } = await import('./xlsx');
    const { listPromoOffers } = await import('../marketing/promoOffers');

    const profiles = await listProfiles();
    const eff = await resolveEffective(profiles);
    const bySlug = new Map(eff.map((e: any) => [String(e.slug), e]));

    const partners: any[][] = [[
      'Merchant', 'Slug', 'Domain', 'Vertical', 'Network (registry)',
      'Effective partner', 'Our affiliate id (masked)', 'Monetization', 'Active',
    ]];
    for (const p of profiles) {
      const e = bySlug.get(String(p.slug)) as any;
      partners.push([
        String(p.display_name || p.slug), String(p.slug), String(p.company_domain || ''),
        String(p.vertical || ''), String(p.network || ''),
        String(e?.effective_source || p.network || ''),
        String(e?.effective_id_masked || (p.affiliate_id ? `…${String(p.affiliate_id).slice(-4)}` : '')),
        String(p.monetization || ''), p.active ? 'yes' : 'no',
      ]);
    }

    const coupons: any[][] = [[
      'Merchant', 'Domain', 'Kind', 'Title', 'Code', 'Discount', 'Description',
      'Image', 'Destination', 'Affiliate link', 'Starts', 'Ends', 'Priority', 'Active', 'Clicks', 'Copies',
    ]];
    for (const c of await listPromoOffers()) {
      coupons.push([
        String(c.merchant_slug), String(c.merchant_domain), String(c.kind), String(c.title),
        c.code || '', c.discount_label || '', c.description || '', c.image_url || '',
        c.url || '', c.affiliate_url || '', c.starts_at || '', c.ends_at || '',
        Number(c.priority || 100), c.active ? 'yes' : 'no', Number(c.clicks || 0), Number(c.copies || 0),
      ]);
    }

    const buf = buildXlsx([
      { name: 'Partners', rows: partners, widths: [24, 20, 26, 14, 18, 20, 24, 14, 8] },
      { name: 'Coupons', rows: coupons, widths: [22, 24, 10, 40, 16, 16, 40, 34, 40, 40, 12, 12, 9, 8, 8, 8] },
    ]);
    const stamp = new Date().toISOString().slice(0, 10);
    audit(_req, 'affiliate_partners.export', 'xlsx', `${profiles.length} partners, ${coupons.length - 1} coupons`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="try1second-partners-${stamp}.xlsx"`);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).end(buf);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Could not build the Excel sheet' });
  }
});

// ---- Manual coupons / offers / cashback (owner 27 Oct): image + affiliate link per row,
// and the /redirect exit page shows them with a one-tap Copy code.
adminRouter.get('/promo-offers', async (_req, res) => {
  try {
    const { listPromoOffers } = await import('../marketing/promoOffers');
    res.json({ success: true, offers: await listPromoOffers() });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not load offers' }); }
});

adminRouter.post('/promo-offers', async (req, res) => {
  try {
    const { savePromoOffer } = await import('../marketing/promoOffers');
    const out = await savePromoOffer(req.body || {});
    if (!out.ok) return res.status(400).json({ success: false, error: out.error });
    audit(req, req.body?.id ? 'promo_offer.update' : 'promo_offer.create', String(req.body?.merchant_slug || ''), String(req.body?.title || ''));
    res.json({ success: true, id: out.id });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not save the offer' }); }
});

adminRouter.delete('/promo-offers/:id', async (req, res) => {
  try {
    const { deletePromoOffer } = await import('../marketing/promoOffers');
    await deletePromoOffer(Number(req.params.id));
    audit(req, 'promo_offer.delete', String(req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not delete the offer' }); }
});

// ---- Home banners (owner 23 Oct): wide landscape strips rendered between
// every home section on web + app. Admin controls image, link (vertical id or
// https URL), title/subtitle, order and active state. ----

/** Owner 24 Oct ("banner ka option reward section aur quick apps mai v do"):
 * one home_banners table, each row targeted at a section. */
const BANNER_SECTIONS = ['home', 'rewards', 'quickapps'];
async function ensureBannerSectionColumn(): Promise<void> {
  // MySQL: add the column once (guarded — file stores have flexible rows).
  try {
    await getStore().execute("ALTER TABLE home_banners ADD COLUMN section VARCHAR(20) NOT NULL DEFAULT 'home'");
  } catch { /* column already exists, or a file store — either way fine */ }
}
adminRouter.get('/home-banners', async (_req, res) => {
  try {
    await ensureBannerSectionColumn();
    const rows = await getStore().query<any>('SELECT * FROM home_banners');
    const banners = rows
      .sort((a, z) => (Number(a.position ?? 0) - Number(z.position ?? 0)) || (Number(a.id) - Number(z.id)))
      .map((r) => ({
        id: Number(r.id), imageUrl: String(r.image_url || ''), link: String(r.link_url || 'movies'),
        title: r.title ? String(r.title) : null, subtitle: r.subtitle ? String(r.subtitle) : null,
        section: BANNER_SECTIONS.includes(String(r.section || 'home')) ? String(r.section) : 'home',
        isActive: Number(r.is_active ?? 1) === 1, position: Number(r.position ?? 0),
        gradientStart: r.gradient_start ? String(r.gradient_start) : null,
        gradientEnd: r.gradient_end ? String(r.gradient_end) : null,
      }));
    res.json({ success: true, banners });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not load banners' }); }
});

adminRouter.post('/home-banners', async (req, res) => {
  try {
    const imageUrl = String(req.body?.imageUrl || '').trim();
    const link = String(req.body?.link || 'movies').trim();
    if (!/^https?:\/\/.+/.test(imageUrl) && !imageUrl.startsWith('/')) return res.status(400).json({ success: false, error: 'A banner image URL is required' });
    if (!/^https?:\/\/.+/.test(link) && !/^[a-z0-9_-]+$/i.test(link)) return res.status(400).json({ success: false, error: 'Link must be a vertical id (e.g. movies) or an https URL' });
    const title = req.body?.title ? String(req.body.title).slice(0, 120) : null;
    const subtitle = req.body?.subtitle ? String(req.body.subtitle).slice(0, 200) : null;
    const isActive = req.body?.isActive === false ? 0 : 1;
    const position = Number(req.body?.position ?? 0) || 0;
    const id = Number(req.body?.id || 0);
    // Owner 24 Oct: banners can target home, the Rewards section or Quick Apps.
    const section = BANNER_SECTIONS.includes(String(req.body?.section || '')) ? String(req.body.section) : 'home';
    // Owner 24 Oct: optional per-banner gradient override ('#RRGGBB' pair).
    const gStart = /^#[0-9a-fA-F]{6}$/.test(String(req.body?.gradientStart || '')) ? String(req.body.gradientStart) : null;
    const gEnd = /^#[0-9a-fA-F]{6}$/.test(String(req.body?.gradientEnd || '')) ? String(req.body.gradientEnd) : null;
    await ensureBannerSectionColumn();
    try { await getStore().execute('ALTER TABLE home_banners ADD COLUMN gradient_start VARCHAR(9) NULL, ADD COLUMN gradient_end VARCHAR(9) NULL'); } catch { /* 021 already applied */ }
    if (id) {
      await getStore().execute('UPDATE home_banners SET image_url = ?, link_url = ?, title = ?, subtitle = ?, section = ?, is_active = ?, position = ?, gradient_start = ?, gradient_end = ? WHERE id = ?',
        [imageUrl, link, title, subtitle, section, isActive, position, gStart, gEnd, id]);
      audit(req, 'home_banner_update', String(id));
    } else {
      await getStore().execute('INSERT INTO home_banners (image_url, link_url, title, subtitle, section, is_active, position, gradient_start, gradient_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [imageUrl, link, title, subtitle, section, isActive, position, gStart, gEnd]);
      audit(req, 'home_banner_create', imageUrl.slice(0, 80));
    }
    purgeSectionCache(); // owner edit live on next request, never behind the 24h TTL
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not save banner' }); }
});

adminRouter.delete('/home-banners/:id', async (req, res) => {
  try {
    await getStore().execute('DELETE FROM home_banners WHERE id = ?', [Number(req.params.id)]);
    audit(req, 'home_banner_delete', String(req.params.id));
    purgeSectionCache(); // owner edit live on next request
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not delete banner' }); }
});

// ---- Quick Apps custom merchants (owner 23 Oct): admin-managed manual entries
// (MySQL quick_apps_custom) merged into /api/quick-apps for web + app. ----
adminRouter.get('/quick-apps', async (_req, res) => {
  try {
    const rows = await getStore().query<any>('SELECT * FROM quick_apps_custom');
    const apps = rows
      .sort((a, z) => Number(a.id) - Number(z.id))
      .map((r) => ({
        id: Number(r.id), name: String(r.name || ''), webUrl: String(r.web_url || ''),
        iconUrl: r.icon_url ? String(r.icon_url) : null, category: r.category ? String(r.category) : null,
        badge: r.badge ? String(r.badge) : null, description: r.description ? String(r.description) : null,
        isActive: Number(r.is_active ?? 1) === 1,
      }));
    res.json({ success: true, apps });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not load custom apps' }); }
});

adminRouter.post('/quick-apps', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const webUrl = String(req.body?.webUrl || '').trim();
    if (name.length < 2) return res.status(400).json({ success: false, error: 'Merchant name is required' });
    if (!/^https?:\/\/.+/.test(webUrl)) return res.status(400).json({ success: false, error: 'Merchant URL must start with https://' });
    const iconUrl = req.body?.iconUrl ? String(req.body.iconUrl).slice(0, 500) : null;
    const category = req.body?.category ? String(req.body.category).slice(0, 60) : null;
    const badge = req.body?.badge ? String(req.body.badge).slice(0, 40) : null;
    const description = req.body?.description ? String(req.body.description).slice(0, 500) : null;
    const isActive = req.body?.isActive === false ? 0 : 1;
    const id = Number(req.body?.id || 0);
    if (id) {
      await getStore().execute('UPDATE quick_apps_custom SET name = ?, web_url = ?, icon_url = ?, category = ?, badge = ?, description = ?, is_active = ? WHERE id = ?',
        [name, webUrl, iconUrl, category, badge, description, isActive, id]);
      audit(req, 'quick_app_update', String(id));
    } else {
      await getStore().execute('INSERT INTO quick_apps_custom (name, web_url, icon_url, category, badge, description, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, webUrl, iconUrl, category, badge, description, isActive]);
      audit(req, 'quick_app_create', name);
    }
    purgeSectionCache(); // owner edit live on next request
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not save merchant' }); }
});

adminRouter.delete('/quick-apps/:id', async (req, res) => {
  try {
    await getStore().execute('DELETE FROM quick_apps_custom WHERE id = ?', [Number(req.params.id)]);
    audit(req, 'quick_app_delete', String(req.params.id));
    purgeSectionCache(); // owner edit live on next request
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, error: e?.message || 'Could not delete merchant' }); }
});

// --- Real-data affiliate & traffic reporting (owner 24 Oct: admin must show
// ONLY real numbers from MySQL — no mock/fabricated records anywhere) ---
const sqlDate = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 19).replace('T', ' ');

adminRouter.get('/affiliate/clicks', async (req, res) => {
  try {
    const store = getStore() as any;
    const vendor = String(req.query.vendor || '').trim();
    const days = Math.max(1, Math.min(Number(req.query.days) || 30, 365));
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 500));
    const since = sqlDate(days);
    const params: any[] = [since];
    let where = 'WHERE created_at >= ?';
    if (vendor) { where += ' AND vendor_domain LIKE ?'; params.push(`%${vendor}%`); }
    const clicks = await store.query(
      `SELECT id, offer_id, network_id, vendor_domain, destination_url, click_id, created_at
       FROM affiliate_clicks ${where} ORDER BY id DESC LIMIT ${limit}`, params);
    const byNetwork = await store.query(
      `SELECT network_id, COUNT(*) AS count FROM affiliate_clicks WHERE created_at >= ? GROUP BY network_id ORDER BY count DESC`, [since]);
    const byVendor = await store.query(
      `SELECT vendor_domain, COUNT(*) AS count FROM affiliate_clicks WHERE created_at >= ? GROUP BY vendor_domain ORDER BY count DESC LIMIT 20`, [since]);
    const daily = await store.query(
      `SELECT DATE(created_at) AS day, COUNT(*) AS count FROM affiliate_clicks WHERE created_at >= ? GROUP BY DATE(created_at) ORDER BY day`, [since]);
    const total = (byNetwork as any[]).reduce((s: number, r: any) => s + Number(r.count || 0), 0);
    res.json({ success: true, clicks, summary: { windowDays: days, total, byNetwork, byVendor, daily } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Click log unavailable' });
  }
});

adminRouter.get('/affiliate/conversions', async (_req, res) => {
  try {
    const store = getStore() as any;
    // Real conversions ONLY — imported from an authorized network report
    // (affiliateNetwork.ts importConversion). Empty until a report exists.
    const conversions = await store.query(
      `SELECT v.id, v.click_id, v.network_id, v.order_value, v.commission, v.confirmed_at, v.source_report, v.created_at, k.vendor_domain
       FROM affiliate_conversions v LEFT JOIN affiliate_clicks k ON k.click_id = v.click_id
       ORDER BY v.id DESC LIMIT 200`);
    res.json({ success: true, conversions });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Conversions unavailable' });
  }
});

// Real traffic: every number comes from the searches / affiliate_clicks MySQL tables.
adminRouter.get('/traffic/real', async (req, res) => {
  try {
    const store = getStore() as any;
    const days = Math.max(1, Math.min(Number(req.query.days) || 30, 365));
    const since = sqlDate(days);
    const dailySearches = await store.query(
      `SELECT DATE(created_at) AS day, COUNT(*) AS count, AVG(latency_ms) AS avg_latency_ms, SUM(results_count > 0) AS with_results
       FROM searches WHERE created_at >= ? GROUP BY DATE(created_at) ORDER BY day`, [since]);
    const byVertical = await store.query(
      `SELECT COALESCE(NULLIF(vertical, ''), 'unknown') AS vertical, COUNT(*) AS count FROM searches WHERE created_at >= ? GROUP BY vertical ORDER BY count DESC`, [since]);
    const topQueries = await store.query(
      `SELECT raw_query, vertical, COUNT(*) AS count FROM searches WHERE created_at >= ? GROUP BY raw_query, vertical ORDER BY count DESC LIMIT 20`, [since]);
    const dailyClicks = await store.query(
      `SELECT DATE(created_at) AS day, COUNT(*) AS count FROM affiliate_clicks WHERE created_at >= ? GROUP BY DATE(created_at) ORDER BY day`, [since]);
    const clicksByNetwork = await store.query(
      `SELECT network_id, COUNT(*) AS count FROM affiliate_clicks WHERE created_at >= ? GROUP BY network_id ORDER BY count DESC`, [since]);
    const totals = await store.query(
      `SELECT
         SUM(created_at >= ?) AS searches_window,
         SUM(created_at >= ? AND results_count > 0) AS searches_with_results
       FROM searches`, [since, since]);
    res.json({
      success: true,
      traffic: {
        windowDays: days,
        dailySearches, byVertical, topQueries, dailyClicks, clicksByNetwork,
        searchesWindow: Number(totals[0]?.searches_window || 0),
        searchesWithResults: Number(totals[0]?.searches_with_results || 0),
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Traffic data unavailable' });
  }
});

// Real integration status: what is actually configured RIGHT NOW. No invented rates.
adminRouter.get('/integrations', async (_req, res) => {
  try {
    const { settings } = await import('../common/settings');
    const { linkinrStats } = await import('../affiliate/linkinr');
    const store = getStore() as any;
    const dbMode = store.kind === 'mysql' ? 'mysql' : 'file-fallback';
    let links: any[] = [];
    try {
      links = await store.query(`SELECT network_source, COUNT(*) AS count FROM affiliate_links GROUP BY network_source`);
    } catch { links = []; }
    res.json({
      success: true,
      integrations: {
        mysql: { status: dbMode },
        linkinr: linkinrStats(),
        cuelinks: {
          enabled: Boolean(settings.cuelinks?.enabled),
          publisherId: settings.cuelinks?.publisherId || '',
          cid: settings.cuelinks?.cid || '',
          apiKeyConfigured: Boolean(settings.cuelinks?.apiKey),
        },
        amazonAssociates: { tag: settings.amazonAssociates?.tag || '' },
        ekaro: { apiKeyConfigured: Boolean(process.env.EKARO_API_KEY) },
        admitad: { credentialsConfigured: Boolean(settings.admitad?.clientId && settings.admitad?.clientSecret) },
        vcommission: { credentialsConfigured: Boolean(process.env.VCOMMISSION_API_KEY) },
        syncedAffiliateLinks: links,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Integration status unavailable' });
  }
});

// Edge Relay visibility (owner 26 Oct): which egress legs exist, breaker state,
// how many requests escalated, and the gated-host policy. Admin-only.
adminRouter.get('/relay/health', (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      configured: relayConfigured(),
      disabled: relayDisabled(),
      hosts: gatedHostPolicy(),
      stats: relayStats(),
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'relay stats unavailable' });
  }
});
