import { fireEvent, render, screen } from '@testing-library/react-native';
import { act } from 'react';
import { SignInBar } from '../src/auth/SignInBar';
import type * as Session from '../src/auth/session';
import { light } from '../src/theme';

jest.mock('../src/auth/session', () => ({
  providers: [],
  signIn: jest.fn(),
  signOut: jest.fn(),
  subscribe: jest.fn(),
}));

const session = jest.requireMock<{
  providers: Session.Provider[];
  signIn: jest.Mock;
  signOut: jest.Mock;
  subscribe: jest.Mock;
}>('../src/auth/session');

let notify: (user: Session.AuthUser | null) => void = () => {};

beforeEach(() => {
  session.providers.splice(0, Infinity, 'google', 'apple');
  session.signIn.mockReset().mockResolvedValue(undefined);
  session.signOut.mockReset().mockResolvedValue(undefined);
  session.subscribe.mockReset().mockImplementation((listener) => {
    notify = listener;
    return () => {};
  });
});

test("says sign-in isn't set up before the project is provisioned", async () => {
  session.providers.splice(0, Infinity);
  await render(<SignInBar colors={light} />);
  expect(screen.getByTestId('signin-status')).toHaveTextContent(
    "Sign-in isn't set up",
  );
  expect(screen.queryByTestId('signin-google')).toBeNull();
  expect(screen.queryByTestId('signin-apple')).toBeNull();
});

test('signs in with a provider and out again', async () => {
  await render(<SignInBar colors={light} />);
  expect(screen.getByTestId('signin-status')).toHaveTextContent('Signed out');

  await fireEvent.press(screen.getByTestId('signin-google'));
  expect(session.signIn).toHaveBeenCalledWith('google');
  await act(() =>
    notify({
      uid: 'u1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      provider: 'google.com',
    }),
  );
  expect(screen.getByTestId('signin-status')).toHaveTextContent(
    'Signed in as Ada Lovelace',
  );
  expect(screen.getByText('ada@example.com · google.com')).toBeOnTheScreen();
  expect(screen.queryByTestId('signin-google')).toBeNull();

  await fireEvent.press(screen.getByTestId('signin-signout'));
  expect(session.signOut).toHaveBeenCalled();
  await act(() => notify(null));
  expect(screen.getByTestId('signin-status')).toHaveTextContent('Signed out');
});

test('names an Apple user by email when Apple shares no name', async () => {
  await render(<SignInBar colors={light} />);
  await act(() =>
    notify({
      uid: 'u2',
      name: null,
      email: 'relay@privaterelay.appleid.com',
      provider: 'apple.com',
    }),
  );
  expect(screen.getByTestId('signin-status')).toHaveTextContent(
    'Signed in as relay@privaterelay.appleid.com',
  );
});

test('shows why sign-in failed', async () => {
  session.signIn.mockRejectedValue(new Error('The network is offline.'));
  await render(<SignInBar colors={light} />);
  await fireEvent.press(screen.getByTestId('signin-apple'));
  expect(screen.getByTestId('signin-error')).toHaveTextContent(
    'The network is offline.',
  );
});
