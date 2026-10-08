import type * as FirebaseAuth from '../src/auth/firebaseAuth';
import type * as User from '../src/auth/user';

// Firebase setup (src/auth/firebaseAuth.ts) and the signed-in user
// (src/auth/user.ts), against a mock of Firebase.

jest.mock('@firebase/app', () => ({
  initializeApp: jest.fn((options: object) => ({ options })),
}));

jest.mock('@firebase/auth', () => ({
  inMemoryPersistence: { type: 'NONE' },
  initializeAuth: jest.fn((app: object) => ({ app })),
  onAuthStateChanged: jest.fn(),
}));

const firebase = {
  apiKey: 'key',
  authDomain: 'p.firebaseapp.com',
  projectId: 'p',
  appId: '1:2:web:3',
};

type Modules = {
  firebaseAuth: typeof FirebaseAuth.firebaseAuth;
  subscribe: typeof User.subscribe;
  initializeAuth: jest.Mock;
  onAuthStateChanged: jest.Mock;
};

// Loads the modules fresh with the given config.
function load(config: { firebase: typeof firebase | null }): Modules {
  let modules: Modules | undefined;
  jest.isolateModules(() => {
    jest.doMock('../src/auth/authConfig', () => ({
      authConfig: { google: null, apple: null, ...config },
    }));
    const auth = require('@firebase/auth');
    modules = {
      firebaseAuth: require('../src/auth/firebaseAuth').firebaseAuth,
      subscribe: require('../src/auth/user').subscribe,
      initializeAuth: auth.initializeAuth,
      onAuthStateChanged: auth.onAuthStateChanged,
    };
  });
  return modules as Modules;
}

test('sets up Firebase once, keeping the session in memory', () => {
  const { firebaseAuth, initializeAuth } = load({ firebase });
  const auth = firebaseAuth();
  expect(auth).toEqual({ app: { options: firebase } });
  expect(initializeAuth).toHaveBeenCalledWith(
    { options: firebase },
    { persistence: { type: 'NONE' } },
  );
  expect(firebaseAuth()).toBe(auth);
  expect(initializeAuth).toHaveBeenCalledTimes(1);
});

test("doesn't set up Firebase before the project is provisioned", () => {
  const { firebaseAuth, subscribe, initializeAuth } = load({ firebase: null });
  expect(firebaseAuth()).toBeNull();
  expect(initializeAuth).not.toHaveBeenCalled();
  const listener = jest.fn();
  subscribe(listener)();
  expect(listener).not.toHaveBeenCalled();
});

test('reports the signed-in user, signing out, and stops when unsubscribed', () => {
  const { subscribe, onAuthStateChanged } = load({ firebase });
  const unsubscribe = jest.fn();
  onAuthStateChanged.mockReturnValue(unsubscribe);
  const listener = jest.fn();
  const stop = subscribe(listener);

  const [, notify] = onAuthStateChanged.mock.calls[0];
  notify({
    uid: 'u1',
    displayName: 'Ada Lovelace',
    email: 'ada@example.com',
    providerData: [{ providerId: 'google.com' }],
  });
  expect(listener).toHaveBeenLastCalledWith({
    uid: 'u1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    provider: 'google.com',
  });
  notify(null);
  expect(listener).toHaveBeenLastCalledWith(null);

  stop();
  expect(unsubscribe).toHaveBeenCalled();
});
