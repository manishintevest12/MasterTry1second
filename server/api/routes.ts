/**
 * API routes: end-to-end backend wiring.
 * Legacy-compatible endpoints (/api/scrape/live, /api/scan/url, /api/catalogue,
 * /api/provenance) now run through the real orchestrator — fabricated deals are gone.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import type { VerticalId } from '../types';
import { runSearch, type SearchInput } from '../search/searchOrchestrator';
import { sourcesStatusReport } from '../sources/registry';
import { getAllHealth } from '../sources/health';
import { authMiddleware, requireAuth, loginUser, registerUser, SESSION_TTL_SEC } from '../auth/authService';
import { requestAdminOtp, verifyAdminOtp } from '../auth/otpService';
import { verifyFirebaseIdToken } from '../auth/firebaseAuth';
import crypto from 'crypto';

import {
  claimSpinEligibility, eligibleSpinCount, executeSpin, getSpinResult,
  registerReferral, submitFulfilmentDetails, validPointBalance,
} from '../rewards/rewardsEngine';
import { resolveRedirect } from '../affiliate/affiliateNetwork';
import { getStore } from '../common/db';
import { runMigrations, resetToFileStore } from '../common/db';
import { initCache, cacheStats } from '../common/cache';
import { assertProductionReadiness, settings } from '../common/settings';
import { loadSourcesFromDb } from '../sources/registry';
import { scrapeLiveUrl } from '../../src/server/realDataAcquisition';
import { getCatalogueState, recordProvenance, saveItemToCatalogue } from '../../src/server/catalogueStore';
import { log } from '../common/logger';

export const apiRouter = Router();

// ============ System ============
apiRouter.get('/health', async (_req: Request, res: Response) => {
  const store = getStore();
  const missing = assertProductionReadiness();
  res.json({
    status: 'online',
    engine: 'Try1Second Independent Metasearch Engine v1.0',
    dataSource: store.kind === 'mysql' ? 'mysql' : 'file-fallback (set MYSQL_URL for production)',
    l2Cache: settings.redisUrl ? 'redis' : 'disabled (set REDIS_URL on KVM4)',
    searchApi: settings.searchApi.enabled ? 'optional-adapter-enabled' : 'optional-adapter-disabled',
    productionWarnings: missing,
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get('/status', (_req, res) => {
  res.json({
    success: true,
    sources: sourcesStatusReport(),
    health: getAllHealth(),
    cache: cacheStats(),
  });
});

// ============ Search pipeline (Section 6) ============
apiRouter.post('/search', async (req, res) => {
  const input: SearchInput = {
    query: String(req.body.query || '').slice(0, 300),
    vertical: req.body.vertical,
    pincode: req.body.pincode,
    city: req.body.city,
    locality: req.body.locality,
    lat: req.body.lat,
    lng: req.body.lng,
  };
  if (!input.query?.trim()) return res.status(400).json({ success: false, error: 'A search query is required.' });
  const response = await runSearch(input);
  res.json({ success: response.results.length > 0 || response.state.servedFrom !== 'unavailable', ...response });
});

/** Legacy-compatible endpoint used by the existing frontend. */
apiRouter.post('/scrape/live', async (req, res) => {
  const input: SearchInput = {
    query: String(req.body.query || ''),
    vertical: req.body.vertical,
    pincode: req.body.pincode,
    city: req.body.city,
    locality: req.body.locality,
  };
  if (!input.query?.trim()) {
    return res.json({ results: [], honestNotice: 'No query provided', latencyMs: 0 });
  }
  const response = await runSearch(input);
  // Map to the legacy shape; honestNotice is surfaced instead of fabricated deals
  res.json({
    results: response.results.map((o) => ({
      id: o.id,
      vertical: o.vertical,
      title: o.title,
      subtitle: `${o.vendor} · ${o.freshnessStatus}`,
      category: o.vertical,
      provider: o.vendor,
      providerLogo: '',
      primaryPrice: o.prices.effectivePrice ?? o.prices.mandatoryTotal,
      originalPrice: o.prices.listPrice,
      unit: 'per unit',
      currency: o.prices.currency,
      sellerQuotes: [],
      sellerUrl: o.affiliate?.deepLink || o.sellerUrl,
      availability: o.availability,
      isLiveScraped: o.freshnessStatus === 'LIVE_VERIFIED',
      freshnessStatus: o.freshnessStatus,
      matchState: o.matchState,
      evidence: {
        sourceId: o.provenance.sourceId,
        sourceMethod: o.provenance.sourceMethod,
        fetchedAt: o.provenance.fetchedAt,
      },
    })),
    honestNotice: response.state.honestNotice,
    sourcesAttempted: response.state.sourcesAttempted,
    sourcesSucceeded: response.state.sourcesSucceeded,
    sourcesFailed: response.state.sourcesFailed,
    servedFrom: response.state.servedFrom,
    resultsCount: response.results.length,
    latencyMs: response.latencyMs,
  });
});

/** Legacy single-URL live scan — real HTTP + cheerio only. */
apiRouter.post('/scan/url', async (req, res) => {
  const url = String(req.body.url || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ success: false, error: 'A valid http(s) URL is required.' });
  const scan = await scrapeLiveUrl(url);
  const catalogueItem = {
    id: `scan-${Date.now()}`,
    vertical: scan.vertical,
    title: scan.title,
    category: scan.category,
    provider: scan.sourceDomain,
    primaryPrice: scan.extractedPrice,
    sellerQuotes: scan.sellerQuotes,
    isLiveScraped: true,
    scrapedTimestamp: new Date().toISOString(),
    scrapedLatencyMs: scan.latencyMs,
  };
  saveItemToCatalogue(catalogueItem as any);
  res.json({ success: true, item: catalogueItem, rawScan: scan });
});

// ============ Catalogue & provenance ============
apiRouter.get('/catalogue', async (_req, res) => {
  try {
    const rows = await getStore().query<any>(
      `SELECT id, vertical, title, vendor, seller, mandatory_total, effective_price, currency, availability,
              freshness_status, validation_status, fetched_at, source_id
       FROM offers ORDER BY fetched_at DESC LIMIT 200`,
    );
    res.json({ success: true, total: rows.length, items: rows, lastSavedAt: new Date().toISOString() });
  } catch {
    const legacy = getCatalogueState();
    res.json({ success: true, total: legacy.items.length, items: legacy.items, lastSavedAt: legacy.lastSavedAt });
  }
});

apiRouter.get('/provenance', async (_req, res) => {
  try {
    const rows = await getStore().query<any>(
      `SELECT offer_id, source_id, source_method, source_url, fetched_at, extracted_fields, evidence_hash
       FROM source_evidence ORDER BY id DESC LIMIT 200`,
    );
    res.json({ success: true, totalLogs: rows.length, logs: rows });
  } catch {
    const legacy = getCatalogueState();
    res.json({ success: true, totalLogs: legacy.provenanceLogs.length, logs: legacy.provenanceLogs });
  }
});

// ============ Affiliate redirect endpoint (Section 15) ============
apiRouter.get('/go', async (req, res) => {
  const dest = String(req.query.url || '');
  if (!dest) return res.status(400).json({ success: false, error: 'Missing destination' });
  const decision = await resolveRedirect(dest, { offerId: req.query.offerId as string | undefined });
  if (!decision.allowed) return res.status(400).json({ success: false, error: `Refused: ${decision.reason}` });
  res.json({ success: true, clickId: decision.clickId, redirectUrl: decision.destination, viaNetwork: decision.viaNetwork });
});

// ============ Auth ============
apiRouter.post('/auth/register', async (req, res) => {
  const r = await registerUser(String(req.body.email || ''), String(req.body.password || ''), req.body.displayName);
  if (!r.ok) return res.status(400).json({ success: false, error: r.error });
  res.json({ success: true, userId: r.userId });
});

apiRouter.post('/auth/login', async (req, res) => {
  const r = await loginUser(String(req.body.email || ''), String(req.body.password || ''));
  if (!r.ok) return res.status(401).json({ success: false, error: r.error });
  res.json({ success: true, token: r.token, user: r.user });
});

// ============ Firebase Google sign-in (main-site users) ============
apiRouter.post('/auth/firebase', async (req, res) => {
  if (!settings.firebaseProjectId) {
    return res.status(503).json({ success: false, error: 'Google sign-in is not configured (set FIREBASE_PROJECT_ID)' });
  }
  const idToken = String(req.body?.idToken || '');
  if (!idToken) return res.status(400).json({ success: false, error: 'Missing Google ID token' });

  const claims = await verifyFirebaseIdToken(idToken);
  if (!claims) return res.status(401).json({ success: false, error: 'Google sign-in could not be verified' });

  const store = getStore();
  let rows = await store.query<any>('SELECT id, email, display_name, role FROM users WHERE email = ?', [claims.email]);
  if (rows.length === 0) {
    await store.execute('INSERT INTO users (email, password_hash, display_name, role, firebase_uid) VALUES (?, NULL, ?, ?, ?)', [
      claims.email, claims.displayName || null, 'user', claims.uid,
    ]);
    rows = await store.query<any>('SELECT id, email, display_name, role FROM users WHERE email = ?', [claims.email]);
  }
  const row = rows[0];
  const token = crypto.randomBytes(32).toString('hex');
  await store.execute('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)', [
    token, Number(row.id), new Date(Date.now() + SESSION_TTL_SEC * 1000).toISOString().slice(0, 19).replace('T', ' '),
  ]);
  res.json({ success: true, token, user: { id: Number(row.id), email: row.email, role: row.role, displayName: row.display_name || claims.displayName || undefined } });
});

// Who am I? — restores a session after page reload
apiRouter.get('/auth/me', authMiddleware, requireAuth, async (req, res) => {
  const user = (req as any).user;
  res.json({ success: true, user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName || undefined } });
});

// ============ Admin email-OTP login (Resend) ============
apiRouter.post('/auth/otp/request', async (req, res) => {
  const r = await requestAdminOtp(String(req.body.email || ''));
  if (!r.ok) return res.status(429).json({ success: false, error: r.error });
  // Generic success (enumeration-safe); delivery problems are surfaced only as a generic retry message.
  res.json({ success: true, message: 'If the address is an admin account, a login code has been sent.' });
});

apiRouter.post('/auth/otp/verify', async (req, res) => {
  const r = await verifyAdminOtp(String(req.body.email || ''), String(req.body.code || ''));
  if (!r.ok) return res.status(401).json({ success: false, error: r.error });
  const email = r.email!;
  const store = getStore();
  let rows = await store.query<any>('SELECT id, email, display_name, role FROM users WHERE email = ?', [email]);
  // Bootstrap: the configured ADMIN_EMAIL becomes the admin account on first OTP login.
  if (rows.length === 0 && settings.adminEmails.includes(email)) {
    await store.execute('INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)', [
      email, `otp-only$${crypto.randomBytes(16).toString('hex')}`, 'Owner Admin', 'admin',
    ]);
    rows = await store.query<any>('SELECT id, email, display_name, role FROM users WHERE email = ?', [email]);
  }
  if (rows.length === 0 || rows[0].role !== 'admin') return res.status(403).json({ success: false, error: 'Not an admin account' });
  const u = rows[0];
  const token = crypto.randomBytes(32).toString('hex');
  await store.execute('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)', [
    token, Number(u.id), new Date(Date.now() + SESSION_TTL_SEC * 1000).toISOString().slice(0, 19).replace('T', ' '),
  ]);
  res.json({ success: true, token, user: { id: Number(u.id), email: u.email, role: u.role, displayName: u.display_name || undefined } });
});

// ============ Rewards: referrals & spins (Section 18) ============
apiRouter.use(authMiddleware);

apiRouter.get('/rewards/me', requireAuth, async (req, res) => {
  const user = (req as any).user;
  res.json({
    success: true,
    validPoints: await validPointBalance(user.id),
    availableEligibilities: await eligibleSpinCount(user.id),
    pointsPerSpinEligibility: 100,
    rules: {
      oneValidReferral: 'exactly one point',
      eligibility: '100 valid points grant one spin eligibility',
      resultVisibility: 'spin results are visible only to you',
      noCashbackWallet: true,
      noCashbackWithdrawal: true,
      noPointsToCash: true,
    },
  });
});

apiRouter.post('/rewards/referral', requireAuth, async (req, res) => {
  const user = (req as any).user;
  const refereeId = Number(req.body.refereeId || 0);
  if (!refereeId) return res.status(400).json({ success: false, error: 'refereeId is required' });
  const r = await registerReferral(user.id, refereeId);
  if (!r.ok) return res.status(400).json({ success: false, error: r.error });
  res.json({ success: true, awarded: r.awarded });
});

apiRouter.post('/rewards/eligibility/claim', requireAuth, async (req, res) => {
  const user = (req as any).user;
  const r = await claimSpinEligibility(user.id);
  if (!r.ok) return res.status(400).json({ success: false, error: r.error });
  res.json({ success: true, eligibilityId: r.eligibilityId });
});

apiRouter.post('/rewards/spin', requireAuth, async (req, res) => {
  const user = (req as any).user;
  const outcome = await executeSpin(user.id, req.body.idempotencyKey || undefined);
  if (outcome.status === 'NO_ELIGIBILITY') {
    return res.status(400).json({ success: false, error: 'No spin eligibility available (100 valid points required per spin)' });
  }
  if (outcome.status === 'NO_PRIZES') {
    return res.status(503).json({ success: false, error: 'No prizes currently configured with inventory. Your eligibility is preserved.' });
  }
  if (outcome.status === 'ERROR') {
    return res.status(500).json({ success: false, error: 'Spin failed — eligibility preserved, safe to retry' });
  }
  res.json({ success: true, status: outcome.status, spinId: outcome.spinId, prize: outcome.prize });
});

apiRouter.get('/rewards/spin/:spinId', requireAuth, async (req, res) => {
  const user = (req as any).user;
  const r = await getSpinResult(user.id, Number(req.params.spinId));
  if (r.status === 'FORBIDDEN') return res.status(403).json({ success: false, error: 'This spin belongs to another user' });
  if (r.status === 'NOT_FOUND') return res.status(404).json({ success: false, error: 'Spin not found' });
  res.json({ success: true, prize: r.prize });
});

apiRouter.post('/rewards/fulfilment', requireAuth, async (req, res) => {
  const user = (req as any).user;
  const r = await submitFulfilmentDetails(user.id, Number(req.body.spinId || 0), {
    name: String(req.body.name || ''),
    phone: String(req.body.phone || ''),
    location: String(req.body.location || ''),
  });
  if (!r.ok) return res.status(400).json({ success: false, error: r.error });
  res.json({ success: true, message: 'Fulfilment details submitted (visible only to prize fulfilment admins)' });
});

// ============ Bootstrap for the server entrypoint ============
export async function bootstrapBackend(): Promise<void> {
  try {
    const migrations = await runMigrations();
    if (migrations.applied.length > 0) log.info('Bootstrap', `Applied migrations: ${migrations.applied.join(', ')}`);
  } catch (err: any) {
    // Bad credentials / DB down must not 503 the whole site: degrade to the file store.
    log.error('Bootstrap', `MySQL migrations failed — falling back to file store until DB env vars are fixed: ${err.code || ''} ${err.message}`);
    resetToFileStore();
  }
  const loaded = await loadSourcesFromDb();
  log.info('Bootstrap', `Sources loaded (db: ${loaded.dbKind}, overlay rows: ${loaded.loaded})`);
  await initCache();
}
