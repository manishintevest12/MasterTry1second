/**
 * Firebase WEB config availability — extracted from firebaseApp.ts because
 * AppContext needs ONLY this boolean on the landing page. Importing it from
 * firebaseApp.ts would drag the whole 114KB firebase SDK chunk into the eager
 * graph (PageSpeed TBT fix, 15 Oct). This file imports nothing from firebase.
 *
 * Firebase WEB config is PUBLIC by design (the apiKey is an app identifier, not
 * a secret; usage is restricted by Firebase security rules + authorized domains).
 */
// Full fallback config — imported by firebaseApp.ts when the SDK actually inits.
export const FIREBASE_WEB_FALLBACK = {
  apiKey: 'AIzaSyBrq8rPJjSyqeYwGo3sa4fdMuz8o1ykR0U',
  authDomain: 'try1second-66273.firebaseapp.com',
  projectId: 'try1second-66273',
  appId: '1:49438102645:web:3e5d2c82f7be014e06543',
  messagingSenderId: '49438102645',
  measurementId: 'G-RV9M2SNQEF',
} as const;

export const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
export const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
export const envAppId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;

export const firebaseWebConfigured = Boolean(
  (envApiKey || FIREBASE_WEB_FALLBACK.apiKey) &&
  (envProjectId || FIREBASE_WEB_FALLBACK.projectId) &&
  (envAppId || FIREBASE_WEB_FALLBACK.appId),
);

export function firebaseConfigured(): boolean {
  return firebaseWebConfigured;
}
