/**
 * Firebase Analytics — initialized only when the web config is complete and the
 * environment supports it (no-op in dev/blocked contexts, per Firebase guidance).
 */
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { getFirebaseApp } from './firebaseApp';

let analytics: Analytics | null = null;

export function initAnalytics(): void {
  if (analytics) return;
  isSupported()
    .then((ok) => {
      if (ok && import.meta.env.PROD) analytics = getAnalytics(getFirebaseApp());
    })
    .catch(() => { /* analytics is optional */ });
}
