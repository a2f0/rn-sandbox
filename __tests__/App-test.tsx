import { render, screen } from '@testing-library/react-native';
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
