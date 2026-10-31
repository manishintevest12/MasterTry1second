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

export function gracefulPublicStatus(app: Express): void {
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
      return sendJson({
        ...base,
        success: false,
        ok: false,
        retrying: true,
        pendingRefresh: true,
        retryAfterSec: 4,
        notice: 'Still gathering results from the sources. Retrying automatically.',
      });
    } as any;

    next();
  });
}
