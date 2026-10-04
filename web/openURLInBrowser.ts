import { Linking } from 'react-native';

// On device, NewAppScreen asks the Metro dev server to open its links on the
// development machine. In a browser, open them in a new tab.
export default function openURLInBrowser(url: string): void {
  Linking.openURL(url);
}
