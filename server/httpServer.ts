/**
 * The HTTP listener for both entrypoints (dev `server.ts`, prod `server.prod.ts`).
 *
 * OWNER 29 Oct ("ClientException with SocketException: Connection reset by peer
 * (errno 104) ... url=https://www.try1second.com/api/scrape/live", reported for
 * every vertical). The app talks to the site through Hostinger's LiteSpeed edge,
 * which keeps its own pooled connection to Node alive for up to ~60s and reuses it
 * for the next request. Node's default keepAliveTimeout is 5s, so the edge kept
 * handing requests to sockets Node had already closed; the phone then got a bare
 * TCP reset instead of a JSON answer, which surfaced as that SocketException and
 * killed the search. Node must therefore outlive the proxy's idle window.
 *
 * Settings and why:
 *  - keepAliveTimeout 65s      > edge idle reuse window, so Node never closes a
 *                              socket the proxy is about to use.
 *  - headersTimeout 66s        must exceed keepAliveTimeout, otherwise Node cuts
 *                              the connection while the proxy is still speaking.
 *  - requestTimeout 0          a cold metasearch legitimately runs a few seconds;
 *                              Node must not abort it mid-flight (the proxy's own
 *                              timeout is the honest limit) — and the app-level
 *                              response wall below is what actually bounds a slow
 *                              ANSWER (requestTimeout only covers reading the request).
 *  - maxRequestsPerSocket 0    no per-socket recycling: that is the edge's business.
 *  - clientError handler       a peer that vanishes mid-request is normal on mobile
 *                              networks; it must never escalate to an unhandled error.
 */
import http from 'http';
import type { Express, Request, Response, NextFunction } from 'express';
import { RESPONSE_WALL_MS as WALL_MS } from './common/wallBudget';

export const KEEP_ALIVE_TIMEOUT_MS = 65_000;

/**
 * RESPONSE WALL (owner 21 Nov: host log showed 503s with response times of 2,544 s / 4,539 s / 5,996 s on
 * GET /best/flights/bihar and POST /api/scrape/live).
 *
 * Those are requests that never got an answer at all: Node's `requestTimeout` only bounds how long the CLIENT may
 * take to send a request, so a handler that awaits a slow dependency keeps its socket — and its memory, and its
 * upstream work — for as long as the dependency feels like it. A handful of those saturate the process, and then the
 * edge answers 503 for everything, including the SPA's own JS chunks (25.9 s on a static asset in the same log).
 *
 * Every request now gets a wall. Past it we answer honestly instead of hanging:
 *   - /api/*  -> 200 with `pendingRefresh: true` (the app already treats that as "still scanning, poll again"),
 *                so a slow search degrades into the behaviour the client is built for and never into a 5xx;
 *   - pages   -> 503 with `Retry-After`, because an HTML page has nothing honest to show half-rendered.
 * The wall sits far above the slowest legitimate handler (the API's own hard deadline is 10 s).
 */
export const RESPONSE_WALL_MS = WALL_MS;

/**
 * Does this path belong to the JSON API? OWNER 22 Nov (access logs full of 5xx on /api/search/live,
 * /api/store/currently-showing, /api/home/showcase with response times of 64 s to 783 s): the wall only matched
 * `/api/`, so a bare `/api` and any path the router rewrote slipped past it and could sit on the socket far longer
 * than the edge tolerates - which is exactly how a slow handler becomes a 5xx in the log instead of the honest
 * `pendingRefresh` answer the app is built to poll.
 */
export const isApiRequest = (path: string): boolean => {
  const p = String(path || '');
  return p === '/api' || p.startsWith('/api/');
};

/**
 * A request is an API request if ANY of its paths says so. Inside a mounted router req.path is route-relative
 * ('/search'), which made the wall answer the human 503 page to /api/search — measured on production 23 Nov.
 */
export const requestIsApi = (req: Request): boolean =>
  isApiRequest(req.path) || isApiRequest(req.originalUrl || '') || isApiRequest((req.baseUrl || '') + (req.path || ''));

/** Build the wall for a given budget. Exported so a test can prove the behaviour without waiting 40 s. */
export const makeResponseWall = (wallMs: number) => (req: Request, res: Response, next: NextFunction): void => {
  if (res.writableEnded) return next();
  const timer = setTimeout(() => {
    if (res.writableEnded || res.headersSent) return;
    try {
      if (requestIsApi(req)) {
        res.status(200).json({
          ok: true,
          results: [],
          pendingRefresh: true,
          degraded: true,
          honestNotice: 'Live sources are still scanning. Results appear here automatically in a few seconds.',
          sourcesAttempted: [], sourcesSucceeded: [], sourcesFailed: [],
          servedFrom: 'deadline', resultsCount: 0,
          latencyMs: wallMs,
        });
      } else {
        res.status(503).set('Retry-After', '5').type('text/plain')
          .send('Try1Second is busy right now. Please retry in a few seconds.');
      }
    } catch { /* socket already gone */ }
  }, wallMs);
  if (typeof (timer as any).unref === 'function') (timer as any).unref();
  const clear = () => clearTimeout(timer);
  res.on('finish', clear);
  res.on('close', clear);
  next();
};

/** The wall every request passes through, with the configured budget. */
export const responseWall = makeResponseWall(RESPONSE_WALL_MS);

export const createListener = (app: Express): http.Server => {
  const server = http.createServer(app);
  server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
  server.headersTimeout = KEEP_ALIVE_TIMEOUT_MS + 1_000;
  server.requestTimeout = 0;
  server.maxRequestsPerSocket = 0;
  server.timeout = 0;
  server.on('clientError', (err: NodeJS.ErrnoException, socket: any) => {
    // Answer with a real status when the socket is still writable, then drop it.
    try {
      if (socket?.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    } catch { /* socket already gone */ }
    // ECONNRESET / EPIPE are the phone changing networks, not our bug: stay quiet.
    if (err?.code && err.code !== 'ECONNRESET' && err.code !== 'EPIPE') {
      console.warn('[Try1Second] client error:', err.code);
    }
  });
  return server;
};

/** Bind the app with the keep-alive settings above. */
export const listenWithKeepAlive = (app: Express, port: number, label = 'Try1Second'): http.Server => {
  const server = createListener(app);
  server.listen(port, () => {
    console.log(`[${label}] Independent metasearch engine running on port ${port}`);
  });
  return server;
};
