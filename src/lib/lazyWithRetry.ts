import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { markChunkFailure, reloadOnce } from './chunkRecovery';

/**
 * OWNER 31 Oct, mobile blank screen: a route chunk that the edge answered 429/403 for left the
 * whole vertical white, because React.lazy() remembers the first rejection forever.
 *
 * This wrapper re-runs the import a few times with backoff before giving up. A throttled chunk is
 * transient (the same URL answered 200 again seconds later in the live test), so one or two retries
 * normally restore the page with no visible effect. If every attempt fails we reload the document
 * once (guarded in chunkRecovery) and then rethrow so the error boundary can show a recovery card
 * rather than a blank screen.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  attempts = 3,
): LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await factory();
      } catch (error) {
        lastError = error;
        markChunkFailure();
        // 300ms, 900ms: short enough to look instant, long enough to clear an edge throttle burst.
        await new Promise((resolve) => setTimeout(resolve, 300 * Math.pow(3, attempt)));
      }
    }
    reloadOnce();
    throw lastError;
  });
}
