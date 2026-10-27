/**
 * MULTI-CORE BOOT (owner 27 Oct: "abhi cpu 1 hai, 6 cpu se speed increase hoga?").
 *
 * Node runs every request on ONE thread, so extra vCPUs do nothing unless we fork.
 * WEB_CONCURRENCY turns them into parallel request handlers sharing the same port
 * (cluster round-robin, no nginx change needed).
 *
 * Measured on this app: a cold product query costs ~0.14s of CPU and ~0.65s of
 * wall time — the rest is waiting on seller networks. So more workers raise
 * THROUGHPUT when many users arrive at once; they do not make one user's request
 * faster. That is why this is off by default (WEB_CONCURRENCY unset = 1 worker).
 *
 * Safe because background duties already run under the MySQL advisory lock
 * (runSingleton in server/index.ts): only one worker scrapes, warms or prunes, so
 * N workers never mean N times the seller traffic.
 */
import cluster from 'node:cluster';
import os from 'node:os';

export function workerCount(env: NodeJS.ProcessEnv = process.env): number {
  const raw = String(env.WEB_CONCURRENCY || '').trim().toLowerCase();
  if (!raw || raw === '1' || raw === 'off' || raw === 'false') return 1;
  if (raw === 'auto' || raw === 'true') return Math.max(1, os.cpus().length);
  const n = Number(raw);
  return Number.isFinite(n) && n > 1 ? Math.min(Math.floor(n), 32) : 1;
}

/**
 * Runs `start` in this process, or in N forked workers when WEB_CONCURRENCY > 1.
 * The primary never binds a port: the workers own it together.
 */
export async function boot(start: () => Promise<void>, label = 'Try1Second'): Promise<void> {
  const workers = workerCount();

  if (workers > 1 && cluster.isPrimary) {
    console.log(`[${label}] primary ${process.pid}: forking ${workers} workers (${os.cpus().length} vCPU, WEB_CONCURRENCY=${process.env.WEB_CONCURRENCY})`);
    let shuttingDown = false;
    const fork = () => cluster.fork();
    for (let i = 0; i < workers; i++) fork();

    // A worker that dies (watchdog exit on a starved event loop, OOM, crash) is replaced
    // after a short backoff, and the surviving workers keep serving meanwhile — the site
    // does not go down because one worker went down.
    cluster.on('exit', (worker, code, signal) => {
      if (shuttingDown) return;
      console.warn(`[${label}] worker ${worker.process.pid} exited (${signal || code}) — respawning in 2s`);
      setTimeout(fork, 2000);
    });

    const stop = () => {
      shuttingDown = true;
      for (const w of Object.values(cluster.workers || {})) w?.kill();
      process.exit(0);
    };
    process.on('SIGTERM', stop);
    process.on('SIGINT', stop);
    return;
  }

  await start();
}
