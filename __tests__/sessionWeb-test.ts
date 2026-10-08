import {
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
} from '@firebase/auth';
import { providers, signIn, signOut } from '../src/auth/session.web';

// The web session (src/auth/session.web.ts) against a mock of Firebase.

const mockAuth = { app: 'test' };

jest.mock('../src/auth/authConfig', () => ({
  authConfig: {
    firebase: {
      apiKey: 'key',
      authDomain: 'p.firebaseapp.com',
      projectId: 'p',
      appId: '1:2:web:3',
    },
    google: { webClientId: 'web-client', iosClientId: null },
    apple: {
      servicesId: 'net.a2f0.sandbox.rn.signin',
      redirectUri: 'https://p.firebaseapp.com/__/auth/handler',
    },
  },
}));

jest.mock('../src/auth/firebaseAuth', () => ({ firebaseAuth: () => mockAuth }));

jest.mock('@firebase/auth', () => {
  class MockGoogleAuthProvider {
    providerId = 'google.com';
  }
  class MockOAuthProvider {
    providerId: string;
    scopes: string[] = [];
    constructor(mockProviderId: string) {
      this.providerId = mockProviderId;
    }
    addScope(scope: string) {
      this.scopes.push(scope);
    }
  }
  return {
    GoogleAuthProvider: MockGoogleAuthProvider,
    OAuthProvider: MockOAuthProvider,
    signInWithPopup: jest.fn(),
    signOut: jest.fn(() => Promise.resolve()),
    onAuthStateChanged: jest.fn(),
  };
});

const popup = signInWithPopup as jest.Mock;

beforeEach(() => {
  popup.mockReset().mockResolvedValue({});
});

test('offers Google and Apple', () => {
  expect(providers).toEqual(['google', 'apple']);
});

test('signs in with Google in a popup', async () => {
  await signIn('google');
  expect(popup).toHaveBeenCalledWith(mockAuth, expect.any(GoogleAuthProvider));
});

test("signs in with Apple in a popup, asking for the person's email and name", async () => {
  await signIn('apple');
  const provider = popup.mock.calls[0][1];
  expect(provider).toBeInstanceOf(OAuthProvider);
  expect(provider).toMatchObject({
    providerId: 'apple.com',
    scopes: ['email', 'name'],
  });
});

test('does nothing when the popup is closed, and rethrows other errors', async () => {
  popup.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });
  await expect(signIn('google')).resolves.toBeUndefined();

  const failure = { code: 'auth/unauthorized-domain' };
  popup.mockRejectedValueOnce(failure);
  await expect(signIn('google')).rejects.toBe(failure);
});

test('signs out of Firebase', async () => {
  await signOut();
  expect(firebaseSignOut).toHaveBeenCalledWith(mockAuth);
});
