import { render, screen } from '@testing-library/react-native';
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';
import App from '../App';

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

test('renders the welcome screen', async () => {
  await render(<App />);
  expect(screen.getByText('Welcome to React Native')).toBeOnTheScreen();
});
