import renderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  await renderer.act(() => {
    renderer.create(<App />);
  });
});
