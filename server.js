// Hostinger hPanel Node.js app entry point (Passenger runs this file directly).
// Runs the precompiled plain-JS bundle (server.cjs): no tsx / TypeScript needed on the host.
// Falls back to the TypeScript sources via tsx only if the bundle is missing (local dev).
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
const dir = path.dirname(fileURLToPath(import.meta.url));
const bundle = path.join(dir, 'server.cjs');

if (fs.existsSync(bundle)) {
  createRequire(import.meta.url)(bundle);
} else {
  import('tsx/esm')
    .then(() => import('./server.ts'))
    .catch((e) => {
      console.error('[try1second] FATAL: server.cjs missing and tsx fallback failed:', e);
      process.exit(1);
    });
}
