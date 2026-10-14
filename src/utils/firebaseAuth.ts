/**
 * Firebase (Google) sign-in for the main site.
 * Config comes from build-time env: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN,
 * VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID. If any is missing, sign-in stays
 * honestly unavailable instead of failing halfway through a popup.
 */
import type { FirebaseApp } from 'firebase/app';
import { getFirebaseApp, firebaseWebConfigured } from './firebaseApp';
import { getAuth, GoogleAuthProvider, signInWithPopup, type Auth } from 'firebase/auth';

export function firebaseConfigured(): boolean {
  return firebaseWebConfigured;
}

function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

/** Opens the "Login with Google" popup and returns the Firebase ID token for the backend. */
export async function signInWithGoogleAndGetToken(): Promise<string> {
  const a = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(a, provider);
  return cred.user.getIdToken();
}
