/**
 * Try1Second server entrypoint — modular monolith bootstrap.
 * Replaces the old single-file server.ts while preserving its working endpoints.
 * Deploy target: Hostinger KVM4 (modular monolith + MySQL + Redis + background workers).
 */
import path from 'path';
import fs from 'fs';
import express, { type Request, type Response } from 'express';
// Gzip all text responses (JS/CSS/JSON/API) — the #1 PageSpeed item missing on
// Hostinger: Apache does not compress proxied Node output, so Express must.
import compression from 'compression';

// Bundle-safe: resolve dist/ from the process working directory (the app root on Hostinger / KVM4).
// Falls back to the source-relative path when running unbundled via tsx.
const __dirname = process.cwd();

export async function createApp(): Promise<express.Express> {
  const app = express();
  app.use(compression()); // gzip BEFORE routes so API JSON + static both compress
  app.use(express.json({ limit: '256kb' }));

  // Canonical host redirect (17 Oct, PageSpeed TTFB fix). Live measurements:
  // https://try1second.com/ (non-www) answers in 0.8-2.6s on Hostinger's edge
  // while https://www.try1second.com/ answers in ~0.25s consistently. PageSpeed
  // was run against the non-www host, so the slow TTFB poisoned FCP/LCP/SI.
  // A 301 here (≈50ms) moves every non-www hit onto the fast www route.
  app.use((req, res, next) => {
    const host = (req.headers.host || '').toLowerCase();
    if (host === 'try1second.com' || /^try1second\.com:\d+$/.test(host)) {
      res.redirect(301, `https://www.try1second.com${req.originalUrl || req.url}`);
      return;
    }
    next();
  });

  const { settings } = await import('./common/settings');
  const { apiRouter, bootstrapBackend } = await import('./api/routes');
  const { adminRouter } = await import('./admin/adminRoutes');
  const { bootstrapDealsSync } = await import('./deals/bootstrap');
  const { startWorkers } = await import('./workers/refreshWorker');
  const { affiliateRouter, bootstrapAffiliateSync } = await import('./affiliate/api');
  const { log } = await import('./common/logger');

  // Core API
  // SELF-HEALING WATCHDOG (owner rule, 21 Oct): if the event loop gets starved
  // (the "site up but everything hangs" production wedge), exit cleanly once and
  // let the hPanel supervisor restart the app — a 10s blip beats a wedged server.
  const { startLoopWatchdog } = await import('./common/loopWatchdog');
  startLoopWatchdog();
  app.use('/api', apiRouter);
  app.use('/api/admin', adminRouter);
  bootstrapDealsSync();
  app.use('/api/v1', affiliateRouter); // unified affiliate offers aggregator

  // Programmatic SEO layer (owner 25 Oct): robots.txt + auto sitemap served from
  // the shared corpus; the SPA shell itself is enhanced per-path in server.ts.
  const { registerSeoRoutes } = await import('./seo/sitemap');
  registerSeoRoutes(app as any);

  // Validate + migrate durable storage, load source config, start L2 cache + workers
  await bootstrapBackend();
  if (settings.env !== 'test') {
    // SINGLETON BACKGROUND (fix for the double-instance boot seen in production logs,
    // 13 Oct): the app supervisor can start two instances; only the lock holder runs
    // the refresh workers, affiliate sync and boot-warm. Everyone still serves HTTP.
    const { runSingleton } = await import('./common/singleton');
    const startBackgroundDuties = async () => {
      startWorkers();
      bootstrapAffiliateSync();
      // CATALOGUE RETENTION (owner fix, 21 Oct — "database size limit reached"):
      // hourly bounded pruning + boot-time compaction keeps the shared-hosting
      // database from filling with dead offers/evidence/health rows again.
      import('./catalogue/prune').then(({ startCatalogueRetention }) => startCatalogueRetention()).catch(() => undefined);
      // Instant first paint: pre-warm the most popular searches in the background
      // so page-load searches hit warm cache (Section 8 cron-warmer).
      import('./cron/warm').then(({ bootWarm }) => bootWarm()).catch(() => undefined);
    };
    const owned = await runSingleton('background', startBackgroundDuties);
    // SELF-HEAL (owner 23 Oct — "loader ke 3-2-1 hone pr bhi results bahut late"):
    // production served every vertical COLD because the instance that won the
    // background lock at boot had died/been reaped and the survivors NEVER retried
    // (runSingleton ran once, at boot). GET_LOCK auto-releases when its holder
    // dies, so a periodic re-attempt lets a surviving instance take over within
    // <=12 min — keep-warm can never silently die forever again.
    if (!owned) {
      const takeover = setInterval(() => {
        void runSingleton('background', startBackgroundDuties).then((now) => {
          if (now) {
            clearInterval(takeover);
            log.info('Bootstrap', 'Background lock takeover: this instance now runs the keep-warm workers');
          }
        }).catch(() => undefined);
      }, 12 * 60_000);
      if (takeover.unref) takeover.unref();
    }
  }

  // Monetizable exit interstitial (owner 23 Oct): GET /redirect?k=<signed token>
  // serves the standalone "Connecting to the cheapest store..." page (4s
  // countdown + AdSense above the fold). Mounted BEFORE the static SPA so the
  // SPA fallback never swallows it.
  const { redirectRouteHandler } = await import('./redirect/interstitial');
  app.get('/redirect', redirectRouteHandler);

  // Production static frontend (vite build output) — KVM4 serves `dist/`
  const dist = path.resolve(__dirname, 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, {
      // index.html names the current hashed bundle, so it must never be cached;
      // hashed /assets/* files are immutable and safe to cache for a year.
      index: false, // '/' falls through to the SEO-enhanced catch-all below
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-store, must-revalidate');
        else if (/[\\/]assets[\\/]/.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }));
    // PROGRAMMATIC SEO (owner 25 Oct): per-URL shell rewrite — unique
    // title/description/canonical/JSON-LD + prerendered content in #root.
    const { enhanceHtml } = await import('./seo/render');
    const baseHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
    app.get('*', (req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store, must-revalidate');
      const acc = String(req.headers.accept || '');
      const isAsset = /\.[a-z0-9]{2,5}$/i.test(req.path.replace(/\/$/, ''));
      const wantsShell = acc === '' || acc.includes('text/html') || acc.includes('*/*');
      if (isAsset || !wantsShell) { res.sendFile(path.join(dist, 'index.html')); return; }
      res.send(enhanceHtml(baseHtml, req.path));
    });
  } else if (settings.isProduction) {
    log.warn('Bootstrap', 'dist/ not found — build the frontend with `npm run build` before serving');
  }

  return app;
}

// NOTE: no auto-listen here. `server.ts` is the single entrypoint: it builds the app,
// mounts the Vite dev middleware (dev) or serves dist/ (prod), and listens once.
// (A previous auto-listen at import time caused a double-bind / EADDRINUSE crash.)
export default createApp;
