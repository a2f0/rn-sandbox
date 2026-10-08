import {
  type AuthProvider,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
} from '@firebase/auth';
import { authConfig } from './authConfig';
import { firebaseAuth } from './firebaseAuth';
import type { Provider } from './user';

export { type AuthUser, type Provider, subscribe } from './user';

// Signs in with Firebase's popups, which handle both providers' redirects on
// the project's auth domain.

const { firebase, google, apple } = authConfig;

export const providers: Provider[] = firebase
  ? [
      ...(google ? (['google'] as const) : []),
      ...(apple ? (['apple'] as const) : []),
    ]
  : [];

// The person closed the popup, or opened another.
const cancelled = new Set([
  'auth/cancelled-popup-request',
  'auth/popup-closed-by-user',
  'auth/user-cancelled',
]);

export async function signIn(provider: Provider): Promise<void> {
  const auth = firebaseAuth();
  if (!auth) throw new Error("Sign-in isn't set up.");
  try {
    await signInWithPopup(auth, authProvider(provider));
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? error.code
        : undefined;
    if (typeof code === 'string' && cancelled.has(code)) return;
    throw error;
  }
}

export async function signOut(): Promise<void> {
  const auth = firebaseAuth();
  if (auth) await firebaseSignOut(auth);
}

function authProvider(provider: Provider): AuthProvider {
  if (provider === 'google') return new GoogleAuthProvider();
  const appleProvider = new OAuthProvider('apple.com');
  appleProvider.addScope('email');
  appleProvider.addScope('name');
  return appleProvider;
}
