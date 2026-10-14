/**
 * Shared Firebase app instance (auth + analytics), configured from VITE_FIREBASE_*.
 * Kept separate so analytics can be loaded lazily and auth stays synchronous.
 *
 * Firebase WEB config is PUBLIC by design (the apiKey is an app identifier, not
 * a secret; usage is restricted by Firebase security rules + authorized domains).
 * The committed fallback below makes EVERY build fully configured — including a
 * `npm run build` run on the production host where the gitignored .env (and its
 * VITE_FIREBASE_* values) does not exist. Env vars still take precedence.
 */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';

const FIREBASE_WEB_FALLBACK = {
  apiKey: 'AIzaSyBrq8rPJjSyqeYwGo3sa4fdMuz8o1ykR0U',
  authDomain: 'try1second-66273.firebaseapp.com',
  projectId: 'try1second-66273',
  appId: '1:49438102645:web:3e5d2c82f7be014e06543',
  messagingSenderId: '49438102645',
  measurementId: 'G-RV9M2SNQEF',
} as const;

const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
const envAppId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;

export const firebaseWebConfigured = Boolean(
  (envApiKey || FIREBASE_WEB_FALLBACK.apiKey) &&
  (envProjectId || FIREBASE_WEB_FALLBACK.projectId) &&
  (envAppId || FIREBASE_WEB_FALLBACK.appId),
);

let app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps()[0] ?? initializeApp({
      apiKey: envApiKey || FIREBASE_WEB_FALLBACK.apiKey,
      authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) || FIREBASE_WEB_FALLBACK.authDomain,
      projectId: envProjectId || FIREBASE_WEB_FALLBACK.projectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
      messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined) || FIREBASE_WEB_FALLBACK.messagingSenderId,
      appId: envAppId || FIREBASE_WEB_FALLBACK.appId,
      measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined) || FIREBASE_WEB_FALLBACK.measurementId,
    });
  }
  return app;
}
