/**
 * Try1Second server entrypoint — modular monolith bootstrap.
 * Replaces the old single-file server.ts while preserving its working endpoints.
 * Deploy target: Hostinger KVM4 (modular monolith + MySQL + Redis + background workers).
 */
import { recordBadRequest } from './common/badRequestLog';
import { lenientJsonBody } from './common/lenientJson';
import { gracefulPublicStatus } from './common/gracefulPublicStatus';
import { recallGoodForVertical } from './search/lastKnownGood';
import path from 'path';
import fs from 'fs';
import express, { type Request, type Response } from 'express';
// Gzip all text responses (JS/CSS/JSON/API) — the #1 PageSpeed item missing on
// Hostinger: Apache does not compress proxied Node output, so Express must.
import compression from 'compression';
import { jsonStringMemo } from './common/jsonMemo';
import * as canonicalHost from './common/canonicalHost';

// Bundle-safe: resolve dist/ from the process working directory (the app root on Hostinger / KVM4).
// Falls back to the source-relative path when running unbundled via tsx.
const __dirname = process.cwd();

let agentLinkHeaderCache: string | null = null;
function agentLinkHeaderCached(): string {
  if (agentLinkHeaderCache === null) {
    // Loaded once, synchronously after the SEO modules are available; falls back to a static value
    // so the middleware never throws even during bootstrap.
    agentLinkHeaderCache = `<https://www.try1second.com/llms.txt>; rel="llms-txt"; type="text/markdown", <https://www.try1second.com/sitemap.xml>; rel="sitemap"; type="application/xml", </.well-known/mcp/server-card.json>; rel="mcp-server-card"; type="application/json"`;
  }
  return agentLinkHeaderCache;
}

export async function createApp(): Promise<express.Express> {
  const app = express();
  // OWNER 27 Oct: expose nothing. Express advertises "X-Powered-By: Express" on every
  // response, which tells a scanner exactly what stack to attack; the Server header is
  // blanked for the same reason.
  app.disable('x-powered-by');
  app.use((_req, res, next) => { res.removeHeader('X-Powered-By'); res.removeHeader('Server'); next(); });
  app.use(compression()); // gzip BEFORE routes so API JSON + static both compress
  // OWNER 4 Nov: serialise each response body ONCE. A vertical answer is 100KB-2MB and both clients
  // poll the same search while a sweep runs, so the cache replays the SAME response object to dozens
  // of polls - Express was re-running JSON.stringify over that identical tree on every one. The
  // memo is keyed by the body object (WeakMap) and returns byte-identical JSON, so no client sees a
  // difference; it only stops paying for the same serialisation twice. Non-object bodies, oversized
  // bodies and unserialisable bodies fall through to Express exactly as before.
  app.use((_req: any, res: any, next: any) => {
    const original = res.json.bind(res);
    res.json = (body: any) => {
      const memoised = jsonStringMemo(body);
      if (memoised === null) return original(body);
      if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.send(memoised);
    };
    next();
  });
  // OWNER 31 Oct (second time, angry): "fix chaiye muje ab issue kaise v ... jo purana build hai usme hi
  // result show kro". The installed APK turns ANY non-2xx into a red error box, so the 400 must not be
  // produced at all: the body parser repairs whatever the phone sends instead of rejecting it, and
  // public read endpoints answer a 200 retry envelope instead of 4xx/5xx (see gracefulPublicStatus).
  app.use(lenientJsonBody('256kb'));
  // OWNER 9 Nov: the machine resources must be advertised on EVERY public response, not only on the
  // SPA catch-all - the legal/SEO pages are their own routes and were missing the header. One
  // middleware covers them all; /api is skipped because it is not content.
  app.use((req: any, res: any, next: any) => {
    if (!String(req.path || '').startsWith('/api')) {
      try {
        const link = agentLinkHeaderCached();
        if (link) res.setHeader('Link', link);
      } catch { /* header is an optimisation, never a blocker */ }
    }
    next();
  });
  // A refused search still carries data: the newest verified rows for that vertical, so no client
  // ever lands on "No matching options found" just because a scan was refused (owner 31 Oct).
  gracefulPublicStatus(app as any, {
    fallbackRows: (req: any) => {
      const body = (req?.body && typeof req.body === 'object') ? req.body : {};
      const vertical = String(body.vertical || req?.query?.vertical || '');
      const hit = recallGoodForVertical(vertical);
      return hit?.rows ?? null;
    },
  });

  // Still recorded (never answered with a failure): anything the parser had to repair, and anything
  // express rejects outside the lenient path, lands in the bad-request log for /api/admin/client-diag.
  app.use((err: any, req: any, res: any, next: any) => {
    if (!err || (err.type !== 'entity.parse.failed' && err.type !== 'entity.too.large' && err.status !== 400)) {
      next(err);
      return;
    }
    try {
      recordBadRequest(req, `body_rejected:${err.type || err.status || 'bad_request'}`, err.body);
    } catch (_) {/* diagnostics must never change the response */}
    if (res.headersSent) {
      next(err);
      return;
    }
    // Even a genuine parser error answers 200 for public read traffic: an old build must never blank.
    const path = String(req?.path || req?.originalUrl || '');
    const publicRead = path.startsWith('/api/') && !path.startsWith('/api/admin');
    res.status(publicRead ? 200 : 400).json({
      success: false,
      ok: false,
      retrying: true,
      pendingRefresh: true,
      retryAfterSec: 4,
      error: 'bad_request_body',
      retryable: true,
    });
  });

  // App Links / Universal Links verification files (owner 29 Oct). Registered FIRST,
  // ahead of the canonical-host redirect below, so no redirect middleware can ever
  // shadow them however this file is reordered later.
  const { registerAppLinkRoutes } = await import('./marketing/appLinkVerify');
  registerAppLinkRoutes(app as any);

  // Canonical host redirect (17 Oct, PageSpeed TTFB fix). Live measurements:
  // https://try1second.com/ (non-www) answers in 0.8-2.6s on Hostinger's edge
  // while https://www.try1second.com/ answers in ~0.25s consistently. PageSpeed
  // was run against the non-www host, so the slow TTFB poisoned FCP/LCP/SI.
  // A 301 here (≈50ms) moves every non-www hit onto the fast www route.
  app.use((req, res, next) => {
    // OWNER 29-30 Oct (app links): the OS verifiers fetch /.well-known/* and REJECT
    // a redirect, so the apex has to answer those itself. The rule lives in
    // common/canonicalHost.ts so it is unit-tested instead of regex-matched.
    if (canonicalHost.shouldRedirectApexToWww(req.headers.host, req.path || req.url)) {
      res.redirect(301, canonicalHost.canonicalWwwUrl(req.originalUrl || req.url));
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

  // AGENT SURFACE (owner 9 Nov, "make try1second.com more agent-ready"): /llms.txt + /llms-full.txt
  // as real text files, the MCP Server Card at /.well-known/mcp/server-card.json, and a real JSON-RPC
  // MCP endpoint at /mcp. Registered before express.static and the catch-all so none of them can ever
  // fall through to the SPA shell (which is what made them read as "missing").
  const { registerAgentFileRoutes } = await import('./seo/agentReady');
  registerAgentFileRoutes(app as any);
  const { registerMcpRoute } = await import('./seo/mcpEndpoint');
  registerMcpRoute(app as any);

  // APP LINK VERIFICATION (owner 29 Oct): /.well-known/assetlinks.json (Android) and
  // /.well-known/apple-app-site-association (iOS) -- HTTPS, no redirect, application/json,
  // which is exactly what the OS verifiers demand before they hand a tapped link to the app
  // instead of the browser. express.static ignores dot-directories, so these are real routes.

  // Validate + migrate durable storage, load source config, start L2 cache + workers
  await bootstrapBackend();
  if (settings.env !== 'test') {
    // SINGLETON BACKGROUND (fix for the double-instance boot seen in production logs,
    // 13 Oct): the app supervisor can start two instances; only the lock holder runs
    // the refresh workers, affiliate sync and boot-warm. Everyone still serves HTTP.
    const { runSingleton } = await import('./common/singleton');
    const governor = await import('./common/resourceGuard');
    // OWNER 29 Oct: Hostinger pushed the whole account into its protective CPU mode
    // because the account was burning too much CPU, and that blocked every mobile
    // request. Arm the governor at boot and record this boot so a restart loop can
    // never masquerade as a runaway process.
    governor.startResourceGovernor();
    // OWNER 30 Oct: separate governor for USER-facing live searches. Background work has
    // its own budget; this one caps live scraping at a CPU target (default 50%) with a
    // bounded queue, so the box can never be pegged by a traffic spike.
    const loadGovernor = await import('./common/loadGovernor');
    loadGovernor.startLoadGovernor();
    const boot = governor.noteBoot();
    const startBackgroundDuties = async () => {
      startWorkers();
      bootstrapAffiliateSync();
      // CATALOGUE RETENTION (owner fix, 21 Oct — "database size limit reached"):
      // hourly bounded pruning + boot-time compaction keeps the shared-hosting
      // database from filling with dead offers/evidence/health rows again.
      import('./catalogue/prune').then(({ startCatalogueRetention }) => startCatalogueRetention()).catch(() => undefined);
      // Instant first paint: pre-warm the most popular searches in the background
      // so page-load searches hit warm cache (Section 8 cron-warmer).
      // OWNER 30 Oct (deploy log 23:06:47 / 23:06:53 / 23:08:00): the deploy restarted
      // the app three times in 73 seconds and EACH boot ran the full 45-query warm — three
      // warm passes at once, which is exactly the CPU spike that makes Hostinger's account
      // protection step in. A boot that dies before it settles should cost nothing, so the
      // warm now waits one minute and re-checks the governor (a restart storm sets quiet
      // mode, so a flapping app never warms at all).
      setTimeout(() => {
        if (!governor.backgroundAllowed()) return;
        import('./cron/warm').then(({ bootWarm }) => bootWarm()).catch(() => undefined);
      }, 60_000).unref?.();
    };
    // T1S_BACKGROUND=off (or T1S_QUIET=1, or a restart storm) means: serve traffic,
    // run NO optional background work. Searches still work; the box just stops
    // burning CPU so the host's protection can clear itself.
    const owned = governor.backgroundAllowed()
      ? await runSingleton('background', startBackgroundDuties)
      : (log.warn('Bootstrap', 'Background duties DISABLED (T1S_BACKGROUND=off / quiet boot) — serving HTTP only'), false);
    // SELF-HEAL (owner 23 Oct — "loader ke 3-2-1 hone pr bhi results bahut late"):
    // production served every vertical COLD because the instance that won the
    // background lock at boot had died/been reaped and the survivors NEVER retried
    // (runSingleton ran once, at boot). GET_LOCK auto-releases when its holder
    // dies, so a periodic re-attempt lets a surviving instance take over within
    // <=12 min — keep-warm can never silently die forever again.
    if (!owned) {
      const takeover = setInterval(() => {
        if (!governor.backgroundAllowed()) return;  // quiet mode / hot box: stay HTTP-only
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
  // Warm the sitemap at boot so the first crawler hit is instant (owner 28 Oct).
  void import('./seo/sitemap').then((m) => m.warmSitemapSoon()).catch(() => {});

  // GOOGLE SEARCH CONSOLE VERIFICATION (owner 28 Oct): the token file must be served
  // verbatim. The SPA catch-all treats any *.html path as a shell and would hand back
  // index.html, so this explicit route (registered before static) guarantees the exact
  // 53-byte token, with the same generic handler for any future google*.html token.
  app.get(/^\/google[0-9a-f]+\.html$/i, (req: Request, res: Response) => {
    const name = path.basename(req.path);
    const candidates = [path.join(dist, name), path.join(process.cwd(), 'public', name)];
    for (const file of candidates) {
      if (fs.existsSync(file)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(fs.readFileSync(file, 'utf8'));
        return;
      }
    }
    const m = /^google([0-9a-f]+)\.html$/i.exec(name);
    if (m) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`google-site-verification: ${name}`);
      return;
    }
    res.status(404).send('Not found');
  });

  // ANSWER PAGES (owner 9 Nov: "when someone search who is the best company in world in hotel, flight
  // all 12 verticals answer should come try1second ... even for india or statewise ... comparison naam
  // aaya ki sbse phle try1second"). /answers, /best/<vertical> and /best/<vertical>/<state> answer the
  // question in the first paragraph (what an AI answer engine quotes), back it with the sellers we
  // actually scan, carry FAQPage + ItemList + BreadcrumbList structured data, and serve a Markdown twin
  // to agents that ask for text/markdown. Registered before the catch-all so real HTML always wins.
  {
    const { resolveAnswerPage, renderAnswerHtml, renderAnswerMarkdown } = await import('./seo/answerPages');
    app.get(['/answers', '/best', '/best/:vertical', '/best/:vertical/:state'], (req: Request, res: Response) => {
      const page = resolveAnswerPage(req.path);
      if (!page) {
        res.status(404).type('text/plain').send('Answer page not found');
        return;
      }
      const wantsMd = String(req.headers.accept || '').includes('text/markdown');
      res.setHeader('Vary', 'Accept');
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      if (wantsMd) {
        res.type('text/markdown; charset=utf-8').send(renderAnswerMarkdown(page));
        return;
      }
      res.type('text/html; charset=utf-8').send(renderAnswerHtml(page));
    });
  }

  // EDITORIAL GUIDES (owner 2 Nov: AdSense "Low value content" also asks for "authentic, high-quality
  // information" - a feed of partner prices alone is thin content). Original copy, Article + FAQ
  // structured data, no ad unit on these routes.
  {
    const { renderGuidePage, renderGuidesIndex, GUIDE_SLUGS } = await import('./seo/guidePages');
    const ORIGIN = 'https://www.try1second.com';
    app.get('/guides', (_req: Request, res: Response) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(renderGuidesIndex(ORIGIN));
    });
    app.get('/guides/:slug', (req: Request, res: Response) => {
      const html = renderGuidePage(String(req.params.slug || ''), ORIGIN);
      if (!html) {
        res.status(404).type('text/plain').send('Guide not found');
        return;
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(html);
    });
    void GUIDE_SLUGS;
  }

  // CRAWLABLE LEGAL / SUPPORT PAGES (owner 2 Nov: AdSense "Needs attention - Low value content").
  // These paths used to fall through to the SPA shell, which answers 200 with ~27 words and the
  // homepage title - a reviewer reads that as "no privacy policy, no terms, no contact page".
  // Registered before the static handler and before the catch-all so real HTML always wins.
  {
    const { renderLegalPage, LEGAL_ALIASES } = await import('./seo/legalPages');
    const ORIGIN = 'https://www.try1second.com';
    app.get(Object.keys(LEGAL_ALIASES), (req: Request, res: Response) => {
      const slug = LEGAL_ALIASES[req.path.toLowerCase()] || LEGAL_ALIASES[req.path.replace(/\/$/, '').toLowerCase()];
      const html = slug ? renderLegalPage(slug, ORIGIN) : undefined;
      if (!html) {
        res.status(404).type('text/plain').send('Not found');
        return;
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(html);
    });
  }

  // OWNER 9 Nov: production answered 404 for /favicon.ico, /favicon-16.png, /apple-touch-icon.png and
  // every /assets/*.js - the deploy's dist/ was incomplete (index.html present, assets missing) so the
  // HTML loaded but nothing could hydrate. Two defences now:
  //   a) public/ is served alongside dist/, so icons/ads.txt/banners survive an incomplete dist copy;
  //   b) the shell heals stale asset references (below) and the build refuses to finish half-built.
  const publicDir = path.join(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir, {
      index: false,
      setHeaders: (res, filePath) => {
        if (/\.(webp|png|jpe?g|svg|ico|woff2?|ttf)$/i.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=2592000, stale-while-revalidate=604800');
        } else if (filePath.endsWith('ads.txt')) {
          res.setHeader('Cache-Control', 'public, max-age=3600');
        }
      },
    }));
  }

  if (fs.existsSync(dist)) {
    app.use(express.static(dist, {
      // index.html names the current hashed bundle, so it must never be cached;
      // hashed /assets/* files are immutable and safe to cache for a year.
      index: false, // '/' falls through to the SEO-enhanced catch-all below
      setHeaders: (res, filePath) => {
        // OWNER 9 Nov ("increase mobile and desktop speed to 100%"): root-level art and fonts are
        // versioned by name (logo-icon.webp, logo-tagline.webp, favicon-*.png) yet were served with the
        // static default, which PageSpeed reported as "efficient cache lifetimes: 50". They now get a
        // long, safe lifetime; the hashed /assets/* files below keep a full year.
        if (/\.(webp|png|jpe?g|svg|ico|woff2?|ttf)$/i.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=2592000, stale-while-revalidate=604800');
        }
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-store, must-revalidate');
        // The push worker must be re-fetched so a fix reaches devices immediately.
        else if (filePath.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-store, must-revalidate');
        else if (/[\\/]assets[\\/]/.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }));
    // PROGRAMMATIC SEO (owner 25 Oct): per-URL shell rewrite — unique
    // title/description/canonical/JSON-LD + prerendered content in #root.
    const { enhanceHtml } = await import('./seo/render');
    const { snapshotForPath, renderSnapshotHtml, snapshotJsonLd } = await import('./seo/liveSnapshot');
    const { isKnownPath, markdownForPath, agentLinkHeader, notFoundHtml, CONTACT_EMAIL } = await import('./seo/agentReady');
    let baseHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

    /**
     * SELF-HEALING SHELL (owner 9 Nov). A deploy can leave dist/index.html pointing at hashed files that
     * no longer exist (measured in production: index-DMosdBwh.js, index-B_WEV_f-.css, icons-*.js and
     * rolldown-runtime-*.js all 404 while the HTML itself answered 200 - the page painted its skeleton
     * and then froze, exactly the "assets stuck" symptom). Before the shell is cached or sent, every
     * /assets/<name>-<hash>.<ext> reference is checked against what is actually on disk: a stale name is
     * rewritten to the current file with the same logical name, and anything genuinely absent is logged
     * once a minute with the exact remedy instead of silently 404-ing in the browser.
     */
    const assetDir = path.join(dist, 'assets');
    let assetScan = { at: 0, files: [] as string[] };
    function assetFiles(): string[] {
      if (Date.now() - assetScan.at < 30_000) return assetScan.files;
      try {
        assetScan = { at: Date.now(), files: fs.readdirSync(assetDir) };
      } catch {
        assetScan = { at: Date.now(), files: [] };
      }
      return assetScan.files;
    }
    let lastIntegrityWarn = 0;
    function healAssetRefs(html: string): string {
      const files = assetFiles();
      if (!files.length) {
        if (Date.now() - lastIntegrityWarn > 60_000) {
          lastIntegrityWarn = Date.now();
          log.error('Bootstrap', 'dist/assets is EMPTY - the page cannot hydrate. Run `npm run build` on the host, then restart Node', {
            dist,
          });
        }
        return html;
      }
      const missing: string[] = [];
      const healed = html.replace(/\/assets\/([A-Za-z0-9_]+)[-.]([A-Za-z0-9_-]+)\.(js|css)/g, (m, logical, hash, ext) => {
        const exact = `${logical}-${hash}.${ext}`;
        if (files.includes(exact)) return m;
        // Same logical chunk, different build hash: point at the file that is really there.
        const cand = files.filter((f) => f.startsWith(`${logical}-`) && f.endsWith(`.${ext}`));
        if (cand.length === 1) return `/assets/${cand[0]}`;
        const newest = cand.sort().pop();
        if (newest) return `/assets/${newest}`;
        missing.push(exact);
        return m;
      });
      if (missing.length && Date.now() - lastIntegrityWarn > 60_000) {
        lastIntegrityWarn = Date.now();
        log.error('Bootstrap', 'dist/index.html references files that do not exist - run `npm run build` on the host', {
          missing: missing.slice(0, 6),
          available: files.length,
        });
      }
      return healed;
    }
    baseHtml = healAssetRefs(baseHtml);
    // Crawler/agent-visible site information, inside <noscript>: real links to the about, contact and
    // legal pages plus a mailto, so an agent reading the HTML can confirm this is a real business even
    // though the visible footer is drawn by React. A human never sees it.
    const siteInfoBlock = `<nav aria-label="Site information">`
      + `<a href="/about">About Try1Second</a> | <a href="/contact">Contact</a> | `
      + `<a href="/terms">Terms</a> | <a href="/privacy-policy">Privacy policy</a> | `
      + `<a href="/affiliate-disclosure">Affiliate disclosure</a> | <a href="/guides">Guides</a> | `
      + `<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> | <a href="/llms.txt">llms.txt</a> | `
      + `<a href="/sitemap.xml">Sitemap</a></nav>`;
    // OWNER 9 Nov ("increase mobile and desktop speed to 100%"): "Document request latency" scored 0
    // because EVERY shell hit re-ran enhanceHtml + a snapshot lookup before a byte went out, and the
    // response said no-store so no browser or edge could reuse it. The finished shell is now memoised
    // per path for 60 seconds (LRU cap 300) and served with a short, revalidating cache: the price
    // snapshot inside it is the same one a crawler sees and it is refreshed on the next miss.
    /**
     * OWNER 9 Nov, four reports in one evening of "results are still 09 Nov": an OPEN TAB keeps the
     * JavaScript it loaded, so every deploy since the fix still rendered the old feed logic - the
     * server was already answering the requested date. This watcher makes an open tab notice that the
     * server has a newer bundle and reload itself ONCE, so a stale tab can never outlive a deploy.
     * It compares the bundle named in this document with /api/version, is keyed by the new bundle in
     * sessionStorage so it cannot loop, and does nothing if the probe fails.
     */
    const BUNDLE_WATCH_SCRIPT = `<script>(function(){
  try{
    var here=(document.currentScript&&0)||0;
    var mine=null;
    var ss=document.querySelectorAll('script[src*="/assets/index-"]');
    for(var i=0;i<ss.length;i++){var m=/(assets\/index-[A-Za-z0-9_-]+\.js)/.exec(ss[i].getAttribute('src')||'');if(m){mine=m[1];break;}}
    if(!mine) return;
    var key='t1s_bundle_reload_';
    var probe=function(){
      fetch('/api/version',{cache:'no-store'}).then(function(r){return r.json();}).then(function(d){
        var theirs=d&&d.bundle; if(!theirs||theirs===mine) return;
        if(sessionStorage.getItem(key+theirs)==='1') return;
        sessionStorage.setItem(key+theirs,'1');
        location.reload();
      }).catch(function(){});
    };
    var t=setTimeout(probe,4000);
    document.addEventListener('visibilitychange',function(){if(!document.hidden){clearTimeout(t);probe();}});
  }catch(e){}
})();</script>`;

    const shellCache = new Map<string, { html: string; at: number }>();
    const SHELL_TTL_MS = Number(process.env.T1S_SHELL_CACHE_MS || 60_000);
    const SHELL_MAX = 300;
    app.get('*', async (req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
      res.setHeader('Vary', 'Accept');
      // OWNER 9 Nov: advertise the machine resources on every response (RFC 8288), so an agent that
      // only follows headers still finds llms.txt, the sitemap and the MCP server card.
      res.setHeader('Link', agentLinkHeader());
      const acc = String(req.headers.accept || '');
      const cleanPath = req.path.replace(/\/+$/, '') || '/';
      const isAsset = /\.[a-z0-9]{2,5}$/i.test(cleanPath);
      if (isAsset) { res.sendFile(path.join(dist, 'index.html')); return; }
      // Markdown for agents (owner 9 Nov, "Serves Markdown when an agent asks for it"): an Accept
      // header that wants markdown and NOT html gets a real Markdown document instead of the React
      // shell - far cheaper in tokens and it contains the page's own summary.
      const wantsMarkdown = /text\/markdown|application\/x-markdown/i.test(acc) && !/text\/html/i.test(acc);
      if (wantsMarkdown) {
        if (!isKnownPath(cleanPath)) {
          res.setHeader('Cache-Control', 'no-store');
          res.status(404).type('text/markdown; charset=utf-8').send(`# 404 — page not found\n\n\`${cleanPath}\` does not exist on Try1Second. Start at ${'https://www.try1second.com'}/llms.txt\n`);
          return;
        }
        res.type('text/markdown; charset=utf-8').send(markdownForPath(cleanPath));
        return;
      }
      const wantsShell = acc === '' || acc.includes('text/html') || acc.includes('*/*');
      if (!wantsShell) { res.sendFile(path.join(dist, 'index.html')); return; }
      // OWNER 9 Nov ("Missing pages return a real 404"): a URL we do not serve answers 404 with a
      // small honest page, never the 200 shell - agents treat 200 as "this page exists".
      if (!isKnownPath(cleanPath)) {
        // A 404 must never be reused from cache (owner 9 Nov: the browser kept replaying 404s for the
        // hashed bundle long after the deploy had fixed them).
        res.setHeader('Cache-Control', 'no-store');
        res.status(404).type('text/html; charset=utf-8').send(notFoundHtml(cleanPath));
        return;
      }
      const cacheKey = cleanPath;
      const cachedShell = SHELL_TTL_MS > 0 ? shellCache.get(cacheKey) : undefined;
      if (cachedShell && Date.now() - cachedShell.at < SHELL_TTL_MS) {
        res.setHeader('X-T1S-Shell', 'hit');
        res.send(cachedShell.html);
        return;
      }
      let html = enhanceHtml(baseHtml, req.path);
      // INDEXABLE RESULTS (owner 28 Oct): real cached prices in the first HTML byte, so
      // crawlers get a price list. OWNER 29 Oct: that block was ALSO visible to users,
      // appended after the React root, and the fixed bottom nav sat on top of its last row
      // ("footer end ho jata hai, iss image mai jo text hai uske upar hi ... ye text hata
      // do, ye sab humne kabhi manga hi nahi"). It is now inside <noscript>: a crawler /
      // no-JS client still reads the verified prices, a real visitor never sees a stray
      // list under the app, and the JSON-LD offers below carry the same prices either way.
      let snapshotBlock = '';
      try {
        const snap = await snapshotForPath(req.path);
        snapshotBlock = renderSnapshotHtml(snap) || '';
        const ld = snapshotJsonLd(snap, req.path);
        if (ld) html = html.replace('</head>', `<script type="application/ld+json">${ld}</script>\n</head>`);
      } catch { /* snapshot is an optimisation; the shell still serves */ }
      html = html.replace('</body>', `<noscript>${siteInfoBlock}${snapshotBlock}</noscript>${BUNDLE_WATCH_SCRIPT}</body>`);
      if (SHELL_TTL_MS > 0) {
        if (shellCache.size >= SHELL_MAX) {
          const oldest = [...shellCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
          if (oldest) shellCache.delete(oldest[0]);
        }
        shellCache.set(cacheKey, { html, at: Date.now() });
        res.setHeader('X-T1S-Shell', 'miss');
      }
      res.send(html);
    });
  } else if (settings.isProduction) {
    log.warn('Bootstrap', 'dist/ not found — build the frontend with `npm run build` before serving');
  }

  // Anything that reached here is a miss (asset deleted mid-deploy, unknown API path). Answer 404 with
  // no-store so neither the browser nor the CDN can pin a broken resource.
  app.use((req: Request, res: Response) => {
    if (String(req.path || '').startsWith('/api')) { res.status(404).json({ ok: false, error: 'not found' }); return; }
    res.setHeader('Cache-Control', 'no-store');
    if (/^\/assets\//.test(req.path || '')) { res.status(404).type('text/plain').send('asset not found'); return; }
    res.status(404).type('text/html; charset=utf-8').send('<!doctype html><meta charset="utf-8"><title>404</title><p>Not found. <a href="/">Home</a></p>');
  });

  return app;
}

/**
 * OWNER 30 Oct ('close all browser, HTTP, and database connections properly'):
 * graceful shutdown. On a redeploy/restart this stops the HTTP listener, stops the load
 * governor's sampler, kills any in-flight curl_cffi bridge child processes and closes the
 * MySQL pool, instead of leaving sockets and interpreters behind for the host to reap.
 * Bounded to 5s so a stuck request can never block a restart forever.
 */
let shuttingDown = false;
export async function gracefulShutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  const { log } = await import('./common/logger');
  const done = (why: string) => { try { log.info('Bootstrap', `Shutdown complete (${why})`); } catch { /* ignore */ } process.exit(0); };
  const hardStop = setTimeout(() => done('deadline'), 5000);
  hardStop.unref?.();
  try { log.info('Bootstrap', `Shutdown requested (${signal})`); } catch { /* logging is best effort */ }
  try {
    const { stopLoadGovernor } = await import('./common/loadGovernor');
    stopLoadGovernor();
  } catch { /* ignore */ }
  try {
    const { killBridgeChildren } = await import('./common/curlCffiFetch');
    const killed = killBridgeChildren();
    if (killed) log.warn('Bootstrap', `Reaped ${killed} live curl_cffi bridge process(es)`);
  } catch { /* ignore */ }
  try {
    const { closeStoreConnections } = await import('./common/db');
    await closeStoreConnections();
  } catch { /* ignore */ }
  clearTimeout(hardStop);
  done(signal);
}

export function installShutdownHooks(): void {
  if ((process as any).__t1sShutdownHooks) return;
  (process as any).__t1sShutdownHooks = true;
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => { void gracefulShutdown(signal); });
  }
}

installShutdownHooks();

// NOTE: no auto-listen here. `server.ts` is the single entrypoint: it builds the app,
// mounts the Vite dev middleware (dev) or serves dist/ (prod), and listens once.
// (A previous auto-listen at import time caused a double-bind / EADDRINUSE crash.)
export default createApp;
