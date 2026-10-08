import { initializeApp } from '@firebase/app';
import { type Auth, initializeAuth, inMemoryPersistence } from '@firebase/auth';
import { authConfig } from './authConfig';

let auth: Auth | null | undefined;

// Firebase Authentication for the provisioned project, or null before it's
// set up. The session lasts until the app quits: keeping it would take a
// storage module the app doesn't have yet.
export function firebaseAuth(): Auth | null {
  if (auth === undefined) {
    auth = authConfig.firebase
      ? initializeAuth(initializeApp(authConfig.firebase), {
          persistence: inMemoryPersistence,
        })
      : null;
  }
  return auth;
}
