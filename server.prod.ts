/**
 * Try1Second — production entrypoint (bundled to server.cjs by esbuild).
 * No tsx / TypeScript / ESM loader needed on the host: plain Node runs the bundle.
 */
import path from 'path';
import fs from 'fs';
import express from 'express';
import { createApp } from './server/index';

async function start() {
  const app = await createApp();
  const dist = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, {
      // index.html must never be cached (it names the current hashed bundle);
      // hashed /assets/* files are immutable and safe to cache for a year.
      setHeaders: (res: any, filePath: string) => {
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-store, must-revalidate');
        else if (/[\\/]assets[\\/]/.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }));
    app.get('*', (_req: any, res: any) => { res.setHeader('Cache-Control', 'no-store, must-revalidate'); res.sendFile(path.join(dist, 'index.html')); });
  }
  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, () => console.log(`[Try1Second] Independent metasearch engine running on port ${PORT}`));
}

start().catch((e) => {
  console.error('[try1second] FATAL: server failed to start:', e);
  process.exit(1);
});
