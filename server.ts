/**
 * Try1Second — server entrypoint (thin wrapper).
 * The full backend now lives in server/ (modular monolith). This file preserves
 * `npm run dev` / `npm start` and mounts Vite dev middleware in development.
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { boot } from './server/multiCore.js';
import { listenWithKeepAlive } from './server/httpServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startPrimary() {
  const { createApp } = await import('./server/index.js');
  const app = await createApp();

  if (process.env.NODE_ENV !== 'production') {
    // Dev: mount Vite middlewares after the API routes
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const dist = path.resolve(__dirname, 'dist');
    if (fs.existsSync(dist)) {
      const express = (await import('express')).default;
      app.use(express.static(dist, {
      // index.html must never be cached (it names the current hashed bundle);
      // hashed /assets/* files are immutable and safe to cache for a year.
      setHeaders: (res: any, filePath: string) => {
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-store, must-revalidate');
        else if (/[\\/]assets[\\/]/.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        // OWNER 24 Nov (Lighthouse mobile 63: "Use efficient cache lifetimes - 453 KiB"): the hashed
        // /assets/* files were already immutable, but every image, font and icon in public/ went out with
        // NO cache lifetime, so a repeat visit re-downloaded all of them. They are content-addressed by
        // filename here, so a month plus stale-while-revalidate is safe and the byte saving is immediate.
        else if (/\.(?:png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf)$/i.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=2592000, stale-while-revalidate=86400');
        }
      },
    }));
      app.get('*', (_req: any, res: any) => { res.setHeader('Cache-Control', 'no-store, must-revalidate'); res.sendFile(path.join(dist, 'index.html')); });
    }
  }

  const PORT = Number(process.env.PORT || 3000);
  // Same listener as production (server/httpServer.ts): keep-alive must outlive the
  // edge's proxy window or requests die as 'Connection reset by peer'.
  listenWithKeepAlive(app, PORT);
}

// Multi-core is opt-in via WEB_CONCURRENCY (see server/multiCore.ts): unset = one worker.
boot(startPrimary).catch((e) => {
  console.error('[Try1Second] Server failed to start:', e);
  process.exit(1);
});
