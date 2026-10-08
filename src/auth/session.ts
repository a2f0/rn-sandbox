import {
  type AuthCredential,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
} from '@firebase/auth';
import {
  appleAuth,
  appleAuthAndroid,
} from '@invertase/react-native-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import { authConfig } from './authConfig';
import { firebaseAuth } from './firebaseAuth';
import type { Provider } from './user';

export { type AuthUser, type Provider, subscribe } from './user';

// Signs in natively, then hands the provider's ID token to Firebase. The web
// signs in with Firebase's popups instead (session.web.ts).

const { firebase, google, apple } = authConfig;

// iOS needs its own OAuth client too.
const googleSupported =
  google !== null && (Platform.OS !== 'ios' || google.iosClientId !== null);

if (google && googleSupported) {
  GoogleSignin.configure({
    webClientId: google.webClientId,
    iosClientId: google.iosClientId ?? undefined,
  });
}

// iOS signs in with Apple natively, for the app's bundle ID. Android has no
// native Sign in with Apple, so it goes through the Services ID on the web.
const appleSupported =
  Platform.OS === 'ios'
    ? appleAuth.isSupported
    : apple !== null && appleAuthAndroid.isSupported === true;

export const providers: Provider[] = firebase
  ? [
      ...(googleSupported ? (['google'] as const) : []),
      ...(appleSupported ? (['apple'] as const) : []),
    ]
  : [];

export async function signIn(provider: Provider): Promise<void> {
  const auth = firebaseAuth();
  if (!auth) throw new Error("Sign-in isn't set up.");
  const credential =
    provider === 'google' ? await googleCredential() : await appleCredential();
  // Null when the person cancelled.
  if (credential) await signInWithCredential(auth, credential);
}

export async function signOut(): Promise<void> {
  if (googleSupported) await GoogleSignin.signOut();
  const auth = firebaseAuth();
  if (auth) await firebaseSignOut(auth);
}

async function googleCredential(): Promise<AuthCredential | null> {
  // Resolves at once on iOS.
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (response.type === 'cancelled') return null;
  if (!response.data.idToken) throw new Error('Google returned no ID token.');
  return GoogleAuthProvider.credential(response.data.idToken);
}

// The library sends Apple a hash of a nonce it generates, and returns the
// nonce, which Firebase checks against the ID token.
async function appleCredential(): Promise<AuthCredential | null> {
  let idToken: string | null | undefined;
  let rawNonce: string | undefined;
  if (Platform.OS === 'ios') {
    try {
      const response = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      });
      idToken = response.identityToken;
      rawNonce = response.nonce;
    } catch (error) {
      if (errorCode(error) === appleAuth.Error.CANCELED) return null;
      throw error;
    }
  } else {
    if (!apple) throw new Error("Sign in with Apple isn't set up.");
    appleAuthAndroid.configure({
      clientId: apple.servicesId,
      redirectUri: apple.redirectUri,
      responseType: appleAuthAndroid.ResponseType.ALL,
      scope: appleAuthAndroid.Scope.ALL,
    });
    try {
      const response = await appleAuthAndroid.signIn();
      idToken = response.id_token;
      rawNonce = response.nonce;
    } catch (error) {
      if (errorCode(error) === appleAuthAndroid.Error.SIGNIN_CANCELLED) {
        return null;
      }
      throw error;
    }
  }
  if (!idToken) throw new Error('Apple returned no ID token.');
  return new OAuthProvider('apple.com').credential({ idToken, rawNonce });
}

function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error
    ? error.code
    : undefined;
}
