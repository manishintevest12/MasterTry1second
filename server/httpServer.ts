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
 *                              timeout is the honest limit).
 *  - maxRequestsPerSocket 0    no per-socket recycling: that is the edge's business.
 *  - clientError handler       a peer that vanishes mid-request is normal on mobile
 *                              networks; it must never escalate to an unhandled error.
 */
import http from 'http';
import type { Express } from 'express';

export const KEEP_ALIVE_TIMEOUT_MS = 65_000;

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
