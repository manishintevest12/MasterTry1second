/**
 * Firebase (Google) sign-in for the main site.
 * Config comes from build-time env: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN,
 * VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID. If any is missing, sign-in stays
 * honestly unavailable instead of failing halfway through a popup.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, type Auth } from 'firebase/auth';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function firebaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID && import.meta.env.VITE_FIREBASE_APP_ID);
}

function getFirebaseAuth(): Auth {
  if (auth) return auth;
  app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  });
  auth = getAuth(app);
  return auth;
}

/** Opens the "Login with Google" popup and returns the Firebase ID token for the backend. */
export async function signInWithGoogleAndGetToken(): Promise<string> {
  const a = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(a, provider);
  return cred.user.getIdToken();
}
