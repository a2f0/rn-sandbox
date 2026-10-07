/// <reference lib="dom" />
import { AppRegistry, type RootTag } from 'react-native';
import App from '../App';
import { name as appName } from '../app.json';
import { loadCxx } from './cxx';

// The web modules run on the WebAssembly module, so load it before rendering.
// If it fails, the app still renders, and the C++ cases fail with the reason.
await loadCxx().catch((error) =>
  console.error("The WebAssembly module didn't load.", error),
);

AppRegistry.registerComponent(appName, () => App);
AppRegistry.runApplication(appName, {
  initialProps: {},
  // react-native-web takes the root element where React Native takes a tag.
  rootTag: document.getElementById('root') as unknown as RootTag,
});
