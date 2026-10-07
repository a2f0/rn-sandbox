/// <reference lib="dom" />
import { AppRegistry, type RootTag } from 'react-native';
import App from '../App';
import { name as appName } from '../app.json';
import { loadCxx } from './cxx';

// The web modules run on the WebAssembly module, so load it before rendering.
await loadCxx();

AppRegistry.registerComponent(appName, () => App);
AppRegistry.runApplication(appName, {
  initialProps: {},
  // react-native-web takes the root element where React Native takes a tag.
  rootTag: document.getElementById('root') as unknown as RootTag,
});
