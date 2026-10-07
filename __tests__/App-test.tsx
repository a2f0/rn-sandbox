import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';
import App from '../App';

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

// jest.setup.ts provides the web modules, which report the web platform.
beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

test('runs every round trip case', async () => {
  await render(<App />);
  expect(await screen.findByTestId('roundtrip-summary')).toBeOnTheScreen();
  expect(screen.getByTestId('roundtrip-status')).toHaveTextContent('passed');
});

test('pressing a case shows and hides what it does and what it sent', async () => {
  await render(<App />);
  await screen.findByTestId('roundtrip-summary');
  const row = screen.getByTestId('roundtrip-case-sync-string with NUL');
  const description = 'Sends a string with a NUL character in the middle.';
  expect(screen.queryByText(description)).toBeNull();

  await fireEvent.press(row);
  expect(screen.getByText(description)).toBeOnTheScreen();
  expect(screen.getAllByText('"a\\u0000b"')).toHaveLength(2);

  await fireEvent.press(row);
  expect(screen.queryByText(description)).toBeNull();
});

test('an expanded case shows a value that contains itself', async () => {
  await render(<App />);
  await screen.findByTestId('roundtrip-summary');
  await fireEvent.press(screen.getByTestId('roundtrip-case-c++-cyclic mixed'));
  expect(
    screen.getByText('{name: "cyclic", self: [circular]}'),
  ).toBeOnTheScreen();
});
