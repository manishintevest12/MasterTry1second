/**
 * Try1Second — server entrypoint (thin wrapper).
 * The full backend now lives in server/ (modular monolith). This file preserves
 * `npm run dev` / `npm start` and mounts Vite dev middleware in development.
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
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
      app.use(express.static(dist));
      app.get('*', (_req: any, res: any) => res.sendFile(path.join(dist, 'index.html')));
    }
  }

  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, () => {
    console.log(`[Try1Second] Independent metasearch engine running on port ${PORT}`);
  });
}

startServer().catch((e) => {
  console.error('[Try1Second] Server failed to start:', e);
  process.exit(1);
});
