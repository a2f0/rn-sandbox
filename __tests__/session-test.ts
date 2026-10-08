import { Platform } from 'react-native';
import type * as Session from '../src/auth/session';

// The native session (src/auth/session.ts) against mocks of Firebase and the
// Google and Apple libraries. It reads the platform when it loads, so each
// test loads it fresh for iOS or Android.

const mockAuth = { app: 'test' };

jest.mock('../src/auth/authConfig', () => ({
  authConfig: {
    firebase: {
      apiKey: 'key',
      authDomain: 'p.firebaseapp.com',
      projectId: 'p',
      appId: '1:2:web:3',
    },
    google: { webClientId: 'web-client', iosClientId: 'ios-client' },
    apple: {
      servicesId: 'net.a2f0.sandbox.rn.signin',
      redirectUri: 'https://p.firebaseapp.com/__/auth/handler',
    },
  },
}));

jest.mock('../src/auth/firebaseAuth', () => ({ firebaseAuth: () => mockAuth }));

jest.mock('@firebase/auth', () => ({
  GoogleAuthProvider: {
    credential: jest.fn((idToken: string) => ({ provider: 'google', idToken })),
  },
  OAuthProvider: jest.fn((providerId: string) => ({
    credential: (params: object) => ({ provider: providerId, ...params }),
  })),
  signInWithCredential: jest.fn(() => Promise.resolve({})),
  signOut: jest.fn(() => Promise.resolve()),
  onAuthStateChanged: jest.fn(),
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(),
    signOut: jest.fn(() => Promise.resolve(null)),
  },
}));

jest.mock('@invertase/react-native-apple-authentication', () => ({
  appleAuth: {
    isSupported: true,
    performRequest: jest.fn(),
    Operation: { LOGIN: 1 },
    Scope: { EMAIL: 0, FULL_NAME: 1 },
    Error: { CANCELED: '1001' },
  },
  appleAuthAndroid: {
    isSupported: true,
    configure: jest.fn(),
    signIn: jest.fn(),
    ResponseType: { ALL: 'ALL' },
    Scope: { ALL: 'ALL' },
    Error: { SIGNIN_CANCELLED: 'E_SIGNIN_CANCELLED_ERROR' },
  },
}));

type Modules = {
  session: typeof Session;
  firebase: {
    GoogleAuthProvider: { credential: jest.Mock };
    signInWithCredential: jest.Mock;
    signOut: jest.Mock;
  };
  google: {
    GoogleSignin: {
      configure: jest.Mock;
      signIn: jest.Mock;
      signOut: jest.Mock;
    };
  };
  apple: {
    appleAuth: { performRequest: jest.Mock };
    appleAuthAndroid: { configure: jest.Mock; signIn: jest.Mock };
  };
};

function load(os: 'ios' | 'android'): Modules {
  // Modules loaded in isolation resolve react-native from the main registry
  // once loading is done, so set the platform in both.
  jest.replaceProperty(Platform, 'OS', os);
  let modules: Modules | undefined;
  jest.isolateModules(() => {
    jest.replaceProperty(require('react-native').Platform, 'OS', os);
    modules = {
      session: require('../src/auth/session'),
      firebase: require('@firebase/auth'),
      google: require('@react-native-google-signin/google-signin'),
      apple: require('@invertase/react-native-apple-authentication'),
    };
  });
  return modules as Modules;
}

test('offers Google and Apple, and configures Google with both clients', () => {
  const { session, google } = load('ios');
  expect(session.providers).toEqual(['google', 'apple']);
  expect(google.GoogleSignin.configure).toHaveBeenCalledWith({
    webClientId: 'web-client',
    iosClientId: 'ios-client',
  });
});

test("hands Google's ID token to Firebase", async () => {
  const { session, firebase, google } = load('android');
  google.GoogleSignin.signIn.mockResolvedValue({
    type: 'success',
    data: { idToken: 'google-token' },
  });
  await session.signIn('google');
  expect(firebase.GoogleAuthProvider.credential).toHaveBeenCalledWith(
    'google-token',
  );
  expect(firebase.signInWithCredential).toHaveBeenCalledWith(mockAuth, {
    provider: 'google',
    idToken: 'google-token',
  });
});

test('does nothing when Google sign-in is cancelled', async () => {
  const { session, firebase, google } = load('ios');
  google.GoogleSignin.signIn.mockResolvedValue({
    type: 'cancelled',
    data: null,
  });
  await session.signIn('google');
  expect(firebase.signInWithCredential).not.toHaveBeenCalled();
});

test("hands Apple's ID token and raw nonce to Firebase on iOS", async () => {
  const { session, firebase, apple } = load('ios');
  apple.appleAuth.performRequest.mockResolvedValue({
    identityToken: 'apple-token',
    nonce: 'raw-nonce',
  });
  await session.signIn('apple');
  expect(firebase.signInWithCredential).toHaveBeenCalledWith(mockAuth, {
    provider: 'apple.com',
    idToken: 'apple-token',
    rawNonce: 'raw-nonce',
  });
});

test('does nothing when Apple sign-in is cancelled on iOS, and rethrows other errors', async () => {
  const { session, firebase, apple } = load('ios');
  apple.appleAuth.performRequest.mockRejectedValueOnce({ code: '1001' });
  await session.signIn('apple');
  expect(firebase.signInWithCredential).not.toHaveBeenCalled();

  const failure = Object.assign(new Error('The request failed.'), {
    code: '1004',
  });
  apple.appleAuth.performRequest.mockRejectedValueOnce(failure);
  await expect(session.signIn('apple')).rejects.toBe(failure);
});

test('signs in with Apple through the Services ID on Android', async () => {
  const { session, firebase, apple } = load('android');
  apple.appleAuthAndroid.signIn.mockResolvedValue({
    id_token: 'apple-token',
    nonce: 'raw-nonce',
  });
  await session.signIn('apple');
  expect(apple.appleAuthAndroid.configure).toHaveBeenCalledWith(
    expect.objectContaining({
      clientId: 'net.a2f0.sandbox.rn.signin',
      redirectUri: 'https://p.firebaseapp.com/__/auth/handler',
    }),
  );
  expect(firebase.signInWithCredential).toHaveBeenCalledWith(mockAuth, {
    provider: 'apple.com',
    idToken: 'apple-token',
    rawNonce: 'raw-nonce',
  });
});

test('does nothing when Apple sign-in is cancelled on Android', async () => {
  const { session, firebase, apple } = load('android');
  apple.appleAuthAndroid.signIn.mockRejectedValue({
    code: 'E_SIGNIN_CANCELLED_ERROR',
  });
  await session.signIn('apple');
  expect(firebase.signInWithCredential).not.toHaveBeenCalled();
});

test("signs out of Firebase even when clearing Google's session fails", async () => {
  const { session, firebase, google } = load('ios');
  const failure = new Error('Google sign-out failed.');
  google.GoogleSignin.signOut.mockRejectedValue(failure);
  await expect(session.signOut()).rejects.toBe(failure);
  expect(firebase.signOut).toHaveBeenCalledWith(mockAuth);
});
