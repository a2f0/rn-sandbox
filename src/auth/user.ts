import { onAuthStateChanged } from '@firebase/auth';
import { firebaseAuth } from './firebaseAuth';

export type Provider = 'google' | 'apple';

export type AuthUser = {
  uid: string;
  name: string | null;
  email: string | null;
  // The identity provider, such as google.com or apple.com.
  provider: string | null;
};

// Calls listener with the signed-in user, now and whenever it changes.
export function subscribe(
  listener: (user: AuthUser | null) => void,
): () => void {
  const auth = firebaseAuth();
  if (!auth) return () => {};
  return onAuthStateChanged(auth, (user) =>
    listener(
      user && {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        provider: user.providerData[0]?.providerId ?? null,
      },
    ),
  );
}
