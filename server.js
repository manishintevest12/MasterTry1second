// Hostinger hPanel Node.js app entry point (Passenger runs this file directly).
// Loads the TypeScript server via tsx so `server.ts` stays the single source of truth.
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
Promise.resolve()
  .then(() => import('tsx/esm'))
  .catch((e) => {
    console.error('[try1second] FATAL: tsx loader unavailable — run `npm install` with tsx in dependencies.', e);
    process.exit(1);
  })
  .then(() => import('./server.ts'))
  .catch((e) => {
    console.error('[try1second] FATAL: server failed to start:', e);
    process.exit(1);
  });
