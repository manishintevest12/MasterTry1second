/**
 * Graceful public API statuses.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import { recordBadRequest } from './badRequestLog';

const MASKED = new Set([400, 404, 405, 408, 409, 413, 415, 421, 422, 425, 429, 500, 502, 503, 504]);

const TRUTH_POST_PATHS = [
  '/api/leads',
  '/api/partner-inquiry',
  '/api/auth/',
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
  fallbackRows?: (req: Request) => any[] | null | undefined;
}

export function gracefulPublicStatus(app: Express, options: GracefulOptions = {}): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!isMaskable(req)) return next();

    const sendJson = res.json.bind(res);
    res.json = function gracefulJson(body: any) {
      if (res.headersSent || res.writableEnded) return res;

      const code = res.statusCode;
      if (!MASKED.has(code)) return sendJson(body);
      try {
        recordBadRequest(req as any, `status_masked:${code}`, JSON.stringify(body ?? {}).slice(0, 300));
      } catch (_) {
        // diagnostics must never change the answer
      }
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
      if (options.fallbackRows && /^\/api\/(search|scrape\/live|compare)/.test(path)) {
        const current = Array.isArray(masked.results) ? masked.results : [];
        if (!current.length) {
          try {
            const rows = options.fallbackRows(req);
            if (rows && rows.length) {
              masked.results = rows;
              masked.resultsCount = rows.length;
              masked.servedFrom = 'last_verified';
              masked.honestNotice = 'Live sources are busy right now, so these are the prices we last verified for this vertical. They refresh automatically.';
            }
          } catch (_) {
            // a fallback may never change the response contract
          }
        }
      }
      return sendJson(masked);
    } as any;

    next();
  });
}
