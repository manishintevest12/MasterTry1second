// Hostinger hPanel Node.js app entry point (Passenger runs this file directly).
// Loads the TypeScript server via tsx so `server.ts` stays the single source of truth.
import('tsx/esm').then(() => import('./server.ts'));
