import { initializeApp } from '@firebase/app';
import { type Auth, getAuth } from '@firebase/auth';
import { authConfig } from './authConfig';

let auth: Auth | null | undefined;

// Firebase Authentication for the provisioned project, or null before it's
// set up. The browser keeps the session in IndexedDB.
export function firebaseAuth(): Auth | null {
  if (auth === undefined) {
    auth = authConfig.firebase
      ? getAuth(initializeApp(authConfig.firebase))
      : null;
  }
  return auth;
}
