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
    app.use(express.static(dist));
    app.get('*', (_req: any, res: any) => res.sendFile(path.join(dist, 'index.html')));
  }
  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, () => console.log(`[Try1Second] Independent metasearch engine running on port ${PORT}`));
}

start().catch((e) => {
  console.error('[try1second] FATAL: server failed to start:', e);
  process.exit(1);
});
