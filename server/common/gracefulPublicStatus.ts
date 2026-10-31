/**
 * Graceful public API statuses.
 *
 * OWNER 31 Oct, twice and angry: "i dont want to see 400 or those error ... jo purana build hai usme hi
 * result show kro". The APK on his phone is already installed and paints a red error box for ANY
 * non-2xx answer, so no server-side data change can reach it — only the status code can. Read-style
 * public API traffic therefore answers 200 with an honest "still gathering, retrying" envelope instead
 * of 4xx/5xx, which the old build already knows how to handle: it keeps the screen alive and re-polls,
 * and the real rows appear as soon as the scan finishes.
 *
 * Deliberately NOT masked:
 *   - /api/admin/*            (admin tools must keep real status codes)
 *   - POST form submissions   (a lost lead must never look like success)
 * Every masked answer is written to the bad-request log so nothing is silently swallowed.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import { recordBadRequest } from './badRequestLog';

/** Status codes a hop or a guard can produce that must never reach an installed old build. */
const MASKED = new Set([400, 404, 405, 408, 409, 413, 415, 421, 422, 425, 429, 500, 502, 503, 504]);

/**
 * POST endpoints whose failure means REAL data loss or a REAL auth answer, so they keep their status.
 * Everything else under /api is a read/scan and is masked. Inverted from the old whitelist after the
 * owner reported the box still appearing: any method/path combination the installed build might use
 * (GET/POST/PUT on a vertical, a stale path, a scan endpoint we renamed) now answers 200 + retry hint
 * instead of an error the old client cannot interpret.
 */
const TRUTH_POST_PATHS = [
  '/api/leads',            // a lost lead must never look like success
  '/api/partner-inquiry',
  '/api/auth/',            // register/login/otp must keep honest answers
  '/api/alerts',
  '/api/spend',
  '/api/rewards/',
  '/api/push/',
  '/api/notifications/',
  '/api/admin',
  '/api/client-diag',
];

const isMaskable = (req: Request): boolean => {
  const path = (req.path || req.originalUrl || '').split('?')[0];
  if (!path.startsWith('/api/')) return false;
  if (path.startsWith('/api/admin')) return false;
  if (path.startsWith('/api/version') || path.startsWith('/api/health')) return false;
  if (path.startsWith('/api/client-diag')) return false;
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    return !TRUTH_POST_PATHS.some((p) => path.startsWith(p));
  }
  return false;
};

export interface GracefulOptions {
  /**
   * Last-resort rows for a refused search: the caller supplies real, previously verified rows so a
   * masked answer still carries data instead of an empty list. Without this, an empty 200 renders as
   * "No matching options found" on the client (owner 31 Oct, every vertical).
   */
  fallbackRows?: (req: Request) => any[] | null | undefined;
}

export function gracefulPublicStatus(app: Express, options: GracefulOptions = {}): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!isMaskable(req)) return next();

    const sendJson = res.json.bind(res);
    res.json = function gracefulJson(body: any) {
      const code = res.statusCode;
      if (!MASKED.has(code)) return sendJson(body);
      try {
        recordBadRequest(req as any, `status_masked:${code}`,
          JSON.stringify(body ?? {}).slice(0, 300));
      } catch (_) {/* diagnostics must never change the answer */}
      res.status(200);
      const base = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
      const path = String((req as any).path || (req as any).originalUrl || '').split('?')[0];
      const masked: any = {
        ...base,
        success: false,
        ok: false,
        retrying: true,
        pendingRefresh: true,
        retryAfterSec: 4,
        notice: 'Still gathering results from the sources. Retrying automatically.',
      };
      // A refused SEARCH must never answer "nothing found": hand back the vertical's last verified
      // rows (real rows only, never re-priced) so the feed stays populated instead of showing the
      // client's empty-state card.
      if (options.fallbackRows && /^\/api\/(search|scrape\/live|compare)/.test(path)) {
        const current = Array.isArray(masked.results) ? masked.results : [];
        if (!current.length) {
          try {
            const rows = options.fallbackRows(req);
            if (rows && rows.length) {
              masked.results = rows;
              masked.resultsCount = rows.length;
              masked.servedFrom = 'last_verified';
              masked.honestNotice =
                'Live sources are busy right now, so these are the prices we last verified for this vertical. They refresh automatically.';
            }
          } catch (_) {/* a fallback may never change the response contract */}
        }
      }
      return sendJson(masked);
    } as any;

    next();
  });
}
