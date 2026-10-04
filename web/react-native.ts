// The web build resolves `react-native` here: react-native-web, plus the
// react-native exports it leaves out that the app's dependencies use.
import { version } from 'react-native-web/package.json';

export * from 'react-native-web';

export const ReactNativeVersion = {
  getVersionString: () => `react-native-web ${version}`,
};
